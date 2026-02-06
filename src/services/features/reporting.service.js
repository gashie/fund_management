/**
 * Reporting Service
 * Handles settlement reports, fee calculation, export, billing, trend analysis
 */

const config = require('../../config');
const { query } = require('../../models/db');

// ============================================================================
// SETTLEMENT REPORTS
// ============================================================================

/**
 * Generate settlement report for a specific date
 */
const generateSettlementReport = async (date, institutionId = null) => {
    if (!config.features.settlementReports) {
        throw { status: 400, message: 'Settlement reports feature is disabled' };
    }

    const reportDate = new Date(date).toISOString().split('T')[0];

    // Get transaction summary
    const summaryResult = await query(`
        SELECT
            COUNT(*) as total_transactions,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as successful_transactions,
            COUNT(*) FILTER (WHERE status IN ('FAILED', 'TIMEOUT')) as failed_transactions,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED'), 0) as successful_amount,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('FAILED', 'TIMEOUT')), 0) as failed_amount,
            COUNT(*) FILTER (WHERE transaction_type = 'NEC') as nec_count,
            COUNT(*) FILTER (WHERE transaction_type = 'FT') as ft_count,
            COUNT(*) FILTER (WHERE status LIKE '%REVERSAL%') as reversal_count
        FROM transactions
        WHERE DATE(created_at) = $1
        ${institutionId ? 'AND institution_id = $2' : ''}
    `, institutionId ? [reportDate, institutionId] : [reportDate]);

    const summary = summaryResult.rows[0];

    // Get status breakdown
    const statusResult = await query(`
        SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
        FROM transactions
        WHERE DATE(created_at) = $1
        ${institutionId ? 'AND institution_id = $2' : ''}
        GROUP BY status
        ORDER BY count DESC
    `, institutionId ? [reportDate, institutionId] : [reportDate]);

    // Get hourly breakdown
    const hourlyResult = await query(`
        SELECT
            EXTRACT(HOUR FROM created_at) as hour,
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as amount
        FROM transactions
        WHERE DATE(created_at) = $1
        ${institutionId ? 'AND institution_id = $2' : ''}
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
    `, institutionId ? [reportDate, institutionId] : [reportDate]);

    // Calculate fees if enabled
    let totalFees = 0;
    if (config.features.feeCalculation) {
        const feesResult = await query(`
            SELECT COALESCE(SUM(fee_amount), 0) as total_fees
            FROM transaction_fees tf
            JOIN transactions t ON tf.transaction_id = t.id
            WHERE DATE(t.created_at) = $1
            ${institutionId ? 'AND t.institution_id = $2' : ''}
        `, institutionId ? [reportDate, institutionId] : [reportDate]);
        totalFees = parseFloat(feesResult.rows[0].total_fees);
    }

    // Save report
    const reportResult = await query(`
        INSERT INTO settlement_reports (
            report_date, institution_id,
            total_transactions, successful_transactions, failed_transactions,
            total_amount, successful_amount, failed_amount,
            total_fees, nec_count, ft_count, reversal_count,
            status_breakdown, hourly_breakdown,
            generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'system')
        ON CONFLICT (report_date, institution_id) WHERE institution_id IS NOT NULL
        DO UPDATE SET
            total_transactions = $3,
            successful_transactions = $4,
            failed_transactions = $5,
            total_amount = $6,
            successful_amount = $7,
            failed_amount = $8,
            total_fees = $9,
            status_breakdown = $13,
            hourly_breakdown = $14,
            generated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [
        reportDate, institutionId,
        summary.total_transactions, summary.successful_transactions, summary.failed_transactions,
        summary.total_amount, summary.successful_amount, summary.failed_amount,
        totalFees, summary.nec_count, summary.ft_count, summary.reversal_count,
        JSON.stringify(statusResult.rows), JSON.stringify(hourlyResult.rows)
    ]);

    return reportResult.rows[0];
};

/**
 * Get settlement report
 */
const getSettlementReport = async (date, institutionId = null) => {
    const reportDate = new Date(date).toISOString().split('T')[0];

    const result = await query(`
        SELECT * FROM settlement_reports
        WHERE report_date = $1 ${institutionId ? 'AND institution_id = $2' : 'AND institution_id IS NULL'}
    `, institutionId ? [reportDate, institutionId] : [reportDate]);

    if (result.rows.length === 0) {
        // Generate if not exists
        return generateSettlementReport(date, institutionId);
    }

    return result.rows[0];
};

// ============================================================================
// FEE CALCULATION
// ============================================================================

/**
 * Get fee configuration for institution and transaction type
 */
const getFeeConfiguration = async (institutionId, transactionType) => {
    if (!config.features.feeCalculation) return null;

    // Try institution-specific first, then default
    const result = await query(`
        SELECT * FROM fee_configurations
        WHERE is_active = true
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
          AND (transaction_type = $1 OR transaction_type = 'ALL')
          AND (institution_id = $2 OR institution_id IS NULL)
        ORDER BY institution_id NULLS LAST, transaction_type DESC
        LIMIT 1
    `, [transactionType, institutionId]);

    if (result.rows.length === 0) {
        // Return default config
        return {
            fee_type: 'PERCENTAGE',
            fee_percent: config.reporting.defaultFeePercent / 100,
            fee_min: config.reporting.defaultFeeMin,
            fee_max: config.reporting.defaultFeeMax,
            fee_cap: config.reporting.defaultFeeCap
        };
    }

    return result.rows[0];
};

/**
 * Calculate fee for a transaction
 */
const calculateFee = async (transactionId, amount, institutionId, transactionType) => {
    if (!config.features.feeCalculation) return { feeAmount: 0 };

    const feeConfig = await getFeeConfiguration(institutionId, transactionType);
    if (!feeConfig) return { feeAmount: 0 };

    let feeAmount = 0;

    switch (feeConfig.fee_type) {
        case 'FIXED':
            feeAmount = parseFloat(feeConfig.fee_fixed) || 0;
            break;

        case 'PERCENTAGE':
            feeAmount = amount * (parseFloat(feeConfig.fee_percent) || 0);
            break;

        case 'TIERED':
            if (feeConfig.tiers) {
                const tiers = typeof feeConfig.tiers === 'string' ? JSON.parse(feeConfig.tiers) : feeConfig.tiers;
                for (const tier of tiers) {
                    if (amount >= tier.min_amount && amount <= (tier.max_amount || Infinity)) {
                        if (tier.fee_percent) {
                            feeAmount = amount * tier.fee_percent;
                        } else if (tier.fee_fixed) {
                            feeAmount = tier.fee_fixed;
                        }
                        break;
                    }
                }
            }
            break;
    }

    // Apply min/max/cap
    if (feeConfig.fee_min && feeAmount < parseFloat(feeConfig.fee_min)) {
        feeAmount = parseFloat(feeConfig.fee_min);
    }
    if (feeConfig.fee_max && feeAmount > parseFloat(feeConfig.fee_max)) {
        feeAmount = parseFloat(feeConfig.fee_max);
    }
    if (feeConfig.fee_cap && feeAmount > parseFloat(feeConfig.fee_cap)) {
        feeAmount = parseFloat(feeConfig.fee_cap);
    }

    // Round to 2 decimal places
    feeAmount = Math.round(feeAmount * 100) / 100;

    // Save fee record
    if (transactionId) {
        await query(`
            INSERT INTO transaction_fees (transaction_id, fee_config_id, transaction_amount, fee_amount, fee_type, fee_calculation)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [transactionId, feeConfig.id, amount, feeAmount, feeConfig.fee_type, JSON.stringify({ config: feeConfig, calculatedFee: feeAmount })]);
    }

    return {
        feeAmount,
        feeType: feeConfig.fee_type,
        feeConfigId: feeConfig.id
    };
};

// ============================================================================
// EXPORT REPORTS
// ============================================================================

/**
 * Export transactions to CSV format
 */
const exportTransactionsCsv = async (filters) => {
    if (!config.features.exportReports) {
        throw { status: 400, message: 'Export reports feature is disabled' };
    }

    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (filters.institutionId) {
        conditions.push(`t.institution_id = $${paramIndex++}`);
        params.push(filters.institutionId);
    }
    if (filters.dateFrom) {
        conditions.push(`t.created_at >= $${paramIndex++}`);
        params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push(`t.created_at <= $${paramIndex++}`);
        params.push(filters.dateTo);
    }
    if (filters.status) {
        conditions.push(`t.status = $${paramIndex++}`);
        params.push(filters.status);
    }

    const result = await query(`
        SELECT
            t.id,
            t.reference_number,
            t.session_id,
            t.transaction_type,
            t.status,
            t.amount,
            t.src_bank_code,
            t.src_account_number,
            t.dest_bank_code,
            t.dest_account_number,
            t.dest_account_name,
            t.narration,
            t.created_at,
            t.updated_at,
            i.institution_name
        FROM transactions t
        LEFT JOIN institutions i ON t.institution_id = i.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex}
    `, [...params, config.reporting.maxExportRows]);

    // Convert to CSV
    if (result.rows.length === 0) {
        return { csv: '', count: 0 };
    }

    const headers = Object.keys(result.rows[0]);
    const csvLines = [headers.join(',')];

    for (const row of result.rows) {
        const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        csvLines.push(values.join(','));
    }

    return {
        csv: csvLines.join('\n'),
        count: result.rows.length,
        headers
    };
};

/**
 * Export transactions to JSON
 */
const exportTransactionsJson = async (filters) => {
    if (!config.features.exportReports) {
        throw { status: 400, message: 'Export reports feature is disabled' };
    }

    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (filters.institutionId) {
        conditions.push(`t.institution_id = $${paramIndex++}`);
        params.push(filters.institutionId);
    }
    if (filters.dateFrom) {
        conditions.push(`t.created_at >= $${paramIndex++}`);
        params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push(`t.created_at <= $${paramIndex++}`);
        params.push(filters.dateTo);
    }

    const result = await query(`
        SELECT t.*, i.institution_name, i.institution_code
        FROM transactions t
        LEFT JOIN institutions i ON t.institution_id = i.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex}
    `, [...params, config.reporting.maxExportRows]);

    return {
        data: result.rows,
        count: result.rows.length,
        exportedAt: new Date().toISOString()
    };
};

// ============================================================================
// INSTITUTION BILLING
// ============================================================================

/**
 * Generate invoice for institution
 */
const generateInvoice = async (institutionId, periodStart, periodEnd) => {
    if (!config.features.institutionBilling) {
        throw { status: 400, message: 'Institution billing feature is disabled' };
    }

    // Get transactions and fees for period
    const transactionsResult = await query(`
        SELECT
            COUNT(*) as total_transactions,
            COALESCE(SUM(amount), 0) as total_volume
        FROM transactions
        WHERE institution_id = $1
          AND created_at BETWEEN $2 AND $3
          AND status = 'COMPLETED'
    `, [institutionId, periodStart, periodEnd]);

    const feesResult = await query(`
        SELECT COALESCE(SUM(fee_amount), 0) as total_fees
        FROM transaction_fees tf
        JOIN transactions t ON tf.transaction_id = t.id
        WHERE t.institution_id = $1
          AND t.created_at BETWEEN $2 AND $3
          AND tf.is_billed = false
    `, [institutionId, periodStart, periodEnd]);

    const txnSummary = transactionsResult.rows[0];
    const feesSummary = feesResult.rows[0];
    const totalFees = parseFloat(feesSummary.total_fees);
    const taxAmount = 0; // Can be configured
    const totalAmount = totalFees + taxAmount;

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create invoice
    const invoiceResult = await query(`
        INSERT INTO institution_invoices (
            institution_id, invoice_number,
            period_start, period_end,
            total_transactions, total_volume, total_fees,
            tax_amount, total_amount,
            due_date, status,
            line_items
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', $11)
        RETURNING *
    `, [
        institutionId, invoiceNumber,
        periodStart, periodEnd,
        txnSummary.total_transactions, txnSummary.total_volume, totalFees,
        taxAmount, totalAmount,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days due
        JSON.stringify([{
            description: 'Transaction Fees',
            quantity: txnSummary.total_transactions,
            amount: totalFees
        }])
    ]);

    // Mark fees as billed
    await query(`
        UPDATE transaction_fees tf
        SET is_billed = true, billed_at = CURRENT_TIMESTAMP, invoice_id = $1
        FROM transactions t
        WHERE tf.transaction_id = t.id
          AND t.institution_id = $2
          AND t.created_at BETWEEN $3 AND $4
          AND tf.is_billed = false
    `, [invoiceResult.rows[0].id, institutionId, periodStart, periodEnd]);

    return invoiceResult.rows[0];
};

/**
 * Get invoices for institution
 */
const getInstitutionInvoices = async (institutionId, status = null) => {
    const result = await query(`
        SELECT * FROM institution_invoices
        WHERE institution_id = $1 ${status ? 'AND status = $2' : ''}
        ORDER BY created_at DESC
    `, status ? [institutionId, status] : [institutionId]);
    return result.rows;
};

/**
 * Mark invoice as paid
 */
const markInvoicePaid = async (invoiceId, paymentReference, paidAmount) => {
    const result = await query(`
        UPDATE institution_invoices
        SET status = 'PAID', paid_at = CURRENT_TIMESTAMP, payment_reference = $1, paid_amount = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
    `, [paymentReference, paidAmount, invoiceId]);
    return result.rows[0];
};

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Get transaction trends (optimized with parameterized query)
 */
const getTransactionTrends = async (days = 30, institutionId = null) => {
    if (!config.features.trendAnalysis) {
        throw { status: 400, message: 'Trend analysis feature is disabled' };
    }

    const params = institutionId ? [days, institutionId] : [days];
    const result = await query(`
        SELECT
            DATE(created_at) as date,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as success_count,
            COUNT(*) FILTER (WHERE status IN ('FAILED', 'TIMEOUT')) as failed_count,
            COALESCE(SUM(amount), 0) as total_volume,
            COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED'), 0) as success_volume,
            COALESCE(AVG(amount), 0) as avg_amount
        FROM transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
        ${institutionId ? 'AND institution_id = $2' : ''}
        GROUP BY DATE(created_at)
        ORDER BY date
    `, params);

    return result.rows;
};

/**
 * Get peak hours analysis (optimized with parameterized query)
 */
const getPeakHoursAnalysis = async (days = 7, institutionId = null) => {
    const params = institutionId ? [days, institutionId] : [days];
    const result = await query(`
        SELECT
            EXTRACT(HOUR FROM created_at) as hour,
            COUNT(*) as transaction_count,
            COALESCE(SUM(amount), 0) as total_volume,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') * 100.0 / NULLIF(COUNT(*), 0) as success_rate
        FROM transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
        ${institutionId ? 'AND institution_id = $2' : ''}
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
    `, params);

    return result.rows;
};

/**
 * Get institution comparison (optimized with parameterized query)
 */
const getInstitutionComparison = async (days = 30) => {
    const result = await query(`
        SELECT
            i.id,
            i.institution_code,
            i.institution_name,
            COUNT(t.id) as total_transactions,
            COUNT(t.id) FILTER (WHERE t.status = 'COMPLETED') as successful,
            COUNT(t.id) FILTER (WHERE t.status IN ('FAILED', 'TIMEOUT')) as failed,
            COALESCE(SUM(t.amount), 0) as total_volume,
            COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'COMPLETED'), 0) as success_volume,
            COUNT(t.id) FILTER (WHERE t.status = 'COMPLETED') * 100.0 / NULLIF(COUNT(t.id), 0) as success_rate
        FROM institutions i
        LEFT JOIN transactions t ON i.id = t.institution_id
            AND t.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
        WHERE i.deleted_at IS NULL
        GROUP BY i.id, i.institution_code, i.institution_name
        ORDER BY total_transactions DESC
    `, [days]);

    return result.rows;
};

module.exports = {
    // Settlement Reports
    generateSettlementReport,
    getSettlementReport,

    // Fee Calculation
    getFeeConfiguration,
    calculateFee,

    // Export
    exportTransactionsCsv,
    exportTransactionsJson,

    // Billing
    generateInvoice,
    getInstitutionInvoices,
    markInvoicePaid,

    // Trend Analysis
    getTransactionTrends,
    getPeakHoursAnalysis,
    getInstitutionComparison
};
