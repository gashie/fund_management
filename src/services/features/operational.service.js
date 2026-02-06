/**
 * Operational Service
 * Handles bulk transactions, scheduled transfers, recurring payments,
 * templates, transaction limits, and business hours
 */

const config = require('../../config');
const { query, transaction } = require('../../models/db');
const TransactionService = require('../transaction.service');
const GipService = require('../gip.service');

// ============================================================================
// BULK TRANSACTIONS
// ============================================================================

/**
 * Create bulk transaction batch
 */
const createBulkBatch = async (institution, items, callbackUrl = null) => {
    if (!config.features.bulkTransactions) {
        throw { status: 400, message: 'Bulk transactions feature is disabled' };
    }

    if (items.length > config.operational.bulkMaxSize) {
        throw { status: 400, message: `Maximum ${config.operational.bulkMaxSize} items per batch` };
    }

    const referenceNumber = `BULK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    // Create batch
    const batchResult = await query(`
        INSERT INTO bulk_batches (
            institution_id, credential_id, reference_number,
            total_count, total_amount, pending_count,
            callback_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
        RETURNING *
    `, [institution.id, institution.credentialId, referenceNumber, items.length, totalAmount, items.length, callbackUrl]);

    const batch = batchResult.rows[0];

    // Create batch items
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await query(`
            INSERT INTO bulk_batch_items (
                batch_id, sequence_number, amount,
                src_bank_code, src_account_number,
                dest_bank_code, dest_account_number, dest_account_name,
                narration, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
        `, [
            batch.id, i + 1, item.amount,
            item.srcBankCode, item.srcAccountNumber,
            item.destBankCode, item.destAccountNumber, item.destAccountName || null,
            item.narration || null
        ]);
    }

    return {
        batchId: batch.id,
        referenceNumber,
        totalCount: items.length,
        totalAmount,
        status: 'PENDING'
    };
};

/**
 * Process bulk batch
 */
const processBulkBatch = async (batchId) => {
    const batchResult = await query(`
        SELECT b.*, i.institution_code, i.webhook_url
        FROM bulk_batches b
        JOIN institutions i ON b.institution_id = i.id
        WHERE b.id = $1
    `, [batchId]);

    if (batchResult.rows.length === 0) {
        throw { status: 404, message: 'Batch not found' };
    }

    const batch = batchResult.rows[0];

    // Update batch status
    await query(`
        UPDATE bulk_batches SET status = 'PROCESSING', started_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [batchId]);

    // Get pending items
    const itemsResult = await query(`
        SELECT * FROM bulk_batch_items WHERE batch_id = $1 AND status = 'PENDING' ORDER BY sequence_number
    `, [batchId]);

    const items = itemsResult.rows;
    let successCount = 0;
    let failedCount = 0;
    let successAmount = 0;
    let failedAmount = 0;

    // Process based on mode
    if (config.operational.bulkProcessingMode === 'parallel') {
        const results = await Promise.allSettled(
            items.map(item => processOneBulkItem(item, batch))
        );

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                successCount++;
                successAmount += parseFloat(items[index].amount);
            } else {
                failedCount++;
                failedAmount += parseFloat(items[index].amount);
            }
        });
    } else {
        for (const item of items) {
            const result = await processOneBulkItem(item, batch);
            if (result.success) {
                successCount++;
                successAmount += parseFloat(item.amount);
            } else {
                failedCount++;
                failedAmount += parseFloat(item.amount);
            }
        }
    }

    // Update batch summary
    const finalStatus = failedCount === 0 ? 'COMPLETED' : (successCount === 0 ? 'FAILED' : 'PARTIAL');
    await query(`
        UPDATE bulk_batches SET
            status = $1,
            successful_count = $2,
            failed_count = $3,
            successful_amount = $4,
            failed_amount = $5,
            pending_count = 0,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
    `, [finalStatus, successCount, failedCount, successAmount, failedAmount, batchId]);

    return {
        batchId,
        status: finalStatus,
        successCount,
        failedCount,
        successAmount,
        failedAmount
    };
};

const processOneBulkItem = async (item, batch) => {
    try {
        await query(`UPDATE bulk_batch_items SET status = 'PROCESSING' WHERE id = $1`, [item.id]);

        // Create transaction
        const txnData = {
            referenceNumber: `${batch.reference_number}-${item.sequence_number}`,
            amount: item.amount,
            srcBankCode: item.src_bank_code,
            srcAccountNumber: item.src_account_number,
            destBankCode: item.dest_bank_code,
            destAccountNumber: item.dest_account_number,
            destAccountName: item.dest_account_name,
            narration: item.narration || `Bulk transfer ${item.sequence_number}`
        };

        const txn = await TransactionService.createTransaction(
            txnData,
            { id: batch.institution_id, credentialId: batch.credential_id },
            'FT'
        );

        await TransactionService.initiateFundsTransfer(txn);

        await query(`
            UPDATE bulk_batch_items SET status = 'SUCCESS', transaction_id = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [txn.id, item.id]);

        return { success: true, transactionId: txn.id };
    } catch (error) {
        await query(`
            UPDATE bulk_batch_items SET status = 'FAILED', error_message = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [error.message || 'Unknown error', item.id]);

        return { success: false, error: error.message };
    }
};

/**
 * Get batch status
 */
const getBatchStatus = async (batchId, institutionId) => {
    const result = await query(`
        SELECT b.*,
            (SELECT json_agg(bi.*) FROM bulk_batch_items bi WHERE bi.batch_id = b.id) as items
        FROM bulk_batches b
        WHERE b.id = $1 AND b.institution_id = $2
    `, [batchId, institutionId]);

    if (result.rows.length === 0) {
        throw { status: 404, message: 'Batch not found' };
    }

    return result.rows[0];
};

// ============================================================================
// SCHEDULED TRANSFERS
// ============================================================================

/**
 * Schedule a transfer
 */
const scheduleTransfer = async (institution, data) => {
    if (!config.features.scheduledTransfers) {
        throw { status: 400, message: 'Scheduled transfers feature is disabled' };
    }

    const scheduledAt = new Date(data.scheduledAt);
    const now = new Date();
    const maxDate = new Date(now.getTime() + config.operational.scheduledMaxDaysAhead * 24 * 60 * 60 * 1000);

    if (scheduledAt <= now) {
        throw { status: 400, message: 'Scheduled time must be in the future' };
    }

    if (scheduledAt > maxDate) {
        throw { status: 400, message: `Cannot schedule more than ${config.operational.scheduledMaxDaysAhead} days ahead` };
    }

    const result = await query(`
        INSERT INTO scheduled_transfers (
            institution_id, credential_id, reference_number, scheduled_at,
            amount, src_bank_code, src_account_number, src_account_name,
            dest_bank_code, dest_account_number, dest_account_name,
            narration, callback_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING')
        RETURNING *
    `, [
        institution.id, institution.credentialId, data.referenceNumber, scheduledAt,
        data.amount, data.srcBankCode, data.srcAccountNumber, data.srcAccountName || null,
        data.destBankCode, data.destAccountNumber, data.destAccountName || null,
        data.narration || null, data.callbackUrl || null
    ]);

    return result.rows[0];
};

/**
 * Process due scheduled transfers (called by worker)
 */
const processDueScheduledTransfers = async () => {
    if (!config.features.scheduledTransfers) return [];

    const dueResult = await query(`
        SELECT s.*, i.institution_code
        FROM scheduled_transfers s
        JOIN institutions i ON s.institution_id = i.id
        WHERE s.status = 'PENDING' AND s.scheduled_at <= CURRENT_TIMESTAMP
        LIMIT 10
        FOR UPDATE SKIP LOCKED
    `);

    const results = [];

    for (const scheduled of dueResult.rows) {
        try {
            await query(`UPDATE scheduled_transfers SET status = 'PROCESSING' WHERE id = $1`, [scheduled.id]);

            const txn = await TransactionService.createTransaction({
                referenceNumber: scheduled.reference_number,
                amount: scheduled.amount,
                srcBankCode: scheduled.src_bank_code,
                srcAccountNumber: scheduled.src_account_number,
                srcAccountName: scheduled.src_account_name,
                destBankCode: scheduled.dest_bank_code,
                destAccountNumber: scheduled.dest_account_number,
                destAccountName: scheduled.dest_account_name,
                narration: scheduled.narration,
                callbackUrl: scheduled.callback_url
            }, { id: scheduled.institution_id, credentialId: scheduled.credential_id }, 'FT');

            await TransactionService.initiateFundsTransfer(txn);

            await query(`
                UPDATE scheduled_transfers SET status = 'COMPLETED', transaction_id = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2
            `, [txn.id, scheduled.id]);

            results.push({ id: scheduled.id, success: true, transactionId: txn.id });
        } catch (error) {
            await query(`
                UPDATE scheduled_transfers SET status = 'FAILED', error_message = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2
            `, [error.message, scheduled.id]);

            results.push({ id: scheduled.id, success: false, error: error.message });
        }
    }

    return results;
};

/**
 * Cancel scheduled transfer
 */
const cancelScheduledTransfer = async (scheduledId, institutionId, cancelledBy) => {
    const result = await query(`
        UPDATE scheduled_transfers
        SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND institution_id = $3 AND status = 'PENDING'
        RETURNING *
    `, [cancelledBy, scheduledId, institutionId]);

    if (result.rows.length === 0) {
        throw { status: 404, message: 'Scheduled transfer not found or already processed' };
    }

    return result.rows[0];
};

// ============================================================================
// RECURRING PAYMENTS
// ============================================================================

/**
 * Create recurring payment
 */
const createRecurringPayment = async (institution, data) => {
    if (!config.features.recurringPayments) {
        throw { status: 400, message: 'Recurring payments feature is disabled' };
    }

    const startDate = new Date(data.startDate);
    const nextExecution = calculateNextExecution(data.frequency, data.dayOfWeek, data.dayOfMonth, startDate);

    const result = await query(`
        INSERT INTO recurring_payments (
            institution_id, credential_id, name,
            amount, src_bank_code, src_account_number, src_account_name,
            dest_bank_code, dest_account_number, dest_account_name,
            narration, callback_url,
            frequency, day_of_week, day_of_month, start_date, end_date, max_occurrences,
            next_execution_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'ACTIVE')
        RETURNING *
    `, [
        institution.id, institution.credentialId, data.name,
        data.amount, data.srcBankCode, data.srcAccountNumber, data.srcAccountName || null,
        data.destBankCode, data.destAccountNumber, data.destAccountName || null,
        data.narration || null, data.callbackUrl || null,
        data.frequency, data.dayOfWeek || null, data.dayOfMonth || null,
        startDate, data.endDate || null, data.maxOccurrences || config.operational.recurringMaxOccurrences,
        nextExecution
    ]);

    return result.rows[0];
};

/**
 * Calculate next execution date
 */
const calculateNextExecution = (frequency, dayOfWeek, dayOfMonth, fromDate) => {
    const date = new Date(fromDate);

    switch (frequency) {
        case 'DAILY':
            date.setDate(date.getDate() + 1);
            break;
        case 'WEEKLY':
            date.setDate(date.getDate() + 7);
            if (dayOfWeek !== null && dayOfWeek !== undefined) {
                while (date.getDay() !== dayOfWeek) {
                    date.setDate(date.getDate() + 1);
                }
            }
            break;
        case 'BIWEEKLY':
            date.setDate(date.getDate() + 14);
            break;
        case 'MONTHLY':
            date.setMonth(date.getMonth() + 1);
            if (dayOfMonth) {
                date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
            }
            break;
        case 'QUARTERLY':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'YEARLY':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            date.setMonth(date.getMonth() + 1);
    }

    return date;
};

/**
 * Process due recurring payments (called by worker)
 */
const processDueRecurringPayments = async () => {
    if (!config.features.recurringPayments) return [];

    const dueResult = await query(`
        SELECT r.*, i.institution_code
        FROM recurring_payments r
        JOIN institutions i ON r.institution_id = i.id
        WHERE r.status = 'ACTIVE'
          AND r.next_execution_at <= CURRENT_TIMESTAMP
          AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE)
          AND r.total_occurrences < COALESCE(r.max_occurrences, 999999)
        LIMIT 10
        FOR UPDATE SKIP LOCKED
    `);

    const results = [];

    for (const recurring of dueResult.rows) {
        const occurrenceNumber = recurring.total_occurrences + 1;

        try {
            const txn = await TransactionService.createTransaction({
                referenceNumber: `${recurring.id}-${occurrenceNumber}`,
                amount: recurring.amount,
                srcBankCode: recurring.src_bank_code,
                srcAccountNumber: recurring.src_account_number,
                srcAccountName: recurring.src_account_name,
                destBankCode: recurring.dest_bank_code,
                destAccountNumber: recurring.dest_account_number,
                destAccountName: recurring.dest_account_name,
                narration: recurring.narration || `Recurring payment ${occurrenceNumber}`,
                callbackUrl: recurring.callback_url
            }, { id: recurring.institution_id, credentialId: recurring.credential_id }, 'FT');

            await TransactionService.initiateFundsTransfer(txn);

            // Log execution
            await query(`
                INSERT INTO recurring_executions (recurring_payment_id, occurrence_number, scheduled_at, executed_at, transaction_id, status)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'SUCCESS')
            `, [recurring.id, occurrenceNumber, recurring.next_execution_at, txn.id]);

            // Update recurring payment
            const nextExecution = calculateNextExecution(recurring.frequency, recurring.day_of_week, recurring.day_of_month, new Date());
            const shouldComplete = occurrenceNumber >= recurring.max_occurrences || (recurring.end_date && nextExecution > new Date(recurring.end_date));

            await query(`
                UPDATE recurring_payments SET
                    total_occurrences = total_occurrences + 1,
                    total_successful = total_successful + 1,
                    total_amount_transferred = total_amount_transferred + $1,
                    last_execution_at = CURRENT_TIMESTAMP,
                    next_execution_at = $2,
                    status = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
            `, [recurring.amount, shouldComplete ? null : nextExecution, shouldComplete ? 'COMPLETED' : 'ACTIVE', recurring.id]);

            results.push({ id: recurring.id, success: true, transactionId: txn.id });
        } catch (error) {
            // Log failed execution
            await query(`
                INSERT INTO recurring_executions (recurring_payment_id, occurrence_number, scheduled_at, status, error_message)
                VALUES ($1, $2, $3, 'FAILED', $4)
            `, [recurring.id, occurrenceNumber, recurring.next_execution_at, error.message]);

            // Update failure count
            await query(`
                UPDATE recurring_payments SET total_failed = total_failed + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [recurring.id]);

            results.push({ id: recurring.id, success: false, error: error.message });
        }
    }

    return results;
};

// ============================================================================
// TRANSACTION TEMPLATES
// ============================================================================

/**
 * Create template
 */
const createTemplate = async (institutionId, data) => {
    if (!config.features.transactionTemplates) {
        throw { status: 400, message: 'Transaction templates feature is disabled' };
    }

    const result = await query(`
        INSERT INTO transaction_templates (
            institution_id, name, description,
            src_bank_code, src_account_number, src_account_name,
            dest_bank_code, dest_account_number, dest_account_name,
            default_amount, default_narration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    `, [
        institutionId, data.name, data.description || null,
        data.srcBankCode || null, data.srcAccountNumber || null, data.srcAccountName || null,
        data.destBankCode || null, data.destAccountNumber || null, data.destAccountName || null,
        data.defaultAmount || null, data.defaultNarration || null
    ]);

    return result.rows[0];
};

/**
 * List templates
 */
const listTemplates = async (institutionId) => {
    const result = await query(`
        SELECT * FROM transaction_templates WHERE institution_id = $1 AND is_active = true ORDER BY usage_count DESC
    `, [institutionId]);
    return result.rows;
};

/**
 * Use template (increment usage)
 */
const useTemplate = async (templateId, institutionId) => {
    await query(`
        UPDATE transaction_templates SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = $1 AND institution_id = $2
    `, [templateId, institutionId]);
};

// ============================================================================
// TRANSACTION LIMITS
// ============================================================================

/**
 * Check transaction limits
 */
const checkTransactionLimits = async (institutionId, amount) => {
    if (!config.features.transactionLimits) return { allowed: true };

    // Get or create limits
    let limitsResult = await query(`SELECT * FROM institution_limits WHERE institution_id = $1`, [institutionId]);

    if (limitsResult.rows.length === 0) {
        // Create default limits
        await query(`
            INSERT INTO institution_limits (institution_id, daily_limit, monthly_limit, per_transaction_limit)
            VALUES ($1, $2, $3, $4)
        `, [
            institutionId,
            config.operational.limits.defaultDailyLimit,
            config.operational.limits.defaultMonthlyLimit,
            config.operational.limits.defaultPerTransactionLimit
        ]);
        limitsResult = await query(`SELECT * FROM institution_limits WHERE institution_id = $1`, [institutionId]);
    }

    const limits = limitsResult.rows[0];

    // Reset if needed
    if (new Date(limits.daily_reset_at) < new Date().setHours(0, 0, 0, 0)) {
        await query(`UPDATE institution_limits SET daily_used = 0, daily_reset_at = CURRENT_DATE WHERE id = $1`, [limits.id]);
        limits.daily_used = 0;
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    if (limits.monthly_reset_at && limits.monthly_reset_at.toISOString().slice(0, 7) !== currentMonth) {
        await query(`UPDATE institution_limits SET monthly_used = 0, monthly_reset_at = DATE_TRUNC('month', CURRENT_DATE)::DATE WHERE id = $1`, [limits.id]);
        limits.monthly_used = 0;
    }

    const violations = [];

    // Check per-transaction limit
    if (limits.per_transaction_limit && amount > parseFloat(limits.per_transaction_limit)) {
        violations.push(`Amount ${amount} exceeds per-transaction limit of ${limits.per_transaction_limit}`);
    }

    // Check daily limit
    if (limits.daily_limit && (parseFloat(limits.daily_used) + amount) > parseFloat(limits.daily_limit)) {
        violations.push(`Daily limit of ${limits.daily_limit} would be exceeded. Current: ${limits.daily_used}`);
    }

    // Check monthly limit
    if (limits.monthly_limit && (parseFloat(limits.monthly_used) + amount) > parseFloat(limits.monthly_limit)) {
        violations.push(`Monthly limit of ${limits.monthly_limit} would be exceeded. Current: ${limits.monthly_used}`);
    }

    return {
        allowed: violations.length === 0,
        violations,
        limits: {
            daily: { limit: limits.daily_limit, used: limits.daily_used },
            monthly: { limit: limits.monthly_limit, used: limits.monthly_used },
            perTransaction: limits.per_transaction_limit
        }
    };
};

/**
 * Update limits after successful transaction
 */
const updateLimitsUsage = async (institutionId, amount) => {
    if (!config.features.transactionLimits) return;

    await query(`
        UPDATE institution_limits
        SET daily_used = daily_used + $1,
            monthly_used = monthly_used + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE institution_id = $2
    `, [amount, institutionId]);
};

// ============================================================================
// BUSINESS HOURS
// ============================================================================

/**
 * Check if within business hours
 */
const checkBusinessHours = () => {
    if (!config.features.businessHours) return { allowed: true };

    const { businessHours } = config.operational;
    const now = new Date();

    // Simple hour check (timezone handling would need moment-timezone in production)
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    const isWorkDay = businessHours.workDays.includes(currentDay);
    const isWorkHour = currentHour >= businessHours.startHour && currentHour < businessHours.endHour;

    if (!isWorkDay) {
        return {
            allowed: false,
            message: `Transactions not allowed on non-business days. Business days: ${businessHours.workDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
        };
    }

    if (!isWorkHour) {
        return {
            allowed: false,
            message: `Transactions only allowed between ${businessHours.startHour}:00 and ${businessHours.endHour}:00`
        };
    }

    return { allowed: true };
};

module.exports = {
    // Bulk Transactions
    createBulkBatch,
    processBulkBatch,
    getBatchStatus,

    // Scheduled Transfers
    scheduleTransfer,
    processDueScheduledTransfers,
    cancelScheduledTransfer,

    // Recurring Payments
    createRecurringPayment,
    processDueRecurringPayments,
    calculateNextExecution,

    // Templates
    createTemplate,
    listTemplates,
    useTemplate,

    // Limits
    checkTransactionLimits,
    updateLimitsUsage,

    // Business Hours
    checkBusinessHours
};
