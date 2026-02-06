/**
 * Transaction Model
 * Database operations for transactions, events, and status management
 */

const { query, transaction } = require('./db');

const TransactionModel = {
    /**
     * Generate unique session_id and tracking_number
     */
    async generateIds() {
        const result = await query('SELECT * FROM generate_transaction_ids()');
        return {
            sessionId: result.rows[0].session_id,
            trackingNumber: result.rows[0].tracking_number
        };
    },

    /**
     * Create a new transaction
     */
    async create(data) {
        const result = await query(`
            INSERT INTO transactions (
                institution_id, credential_id, reference_number,
                session_id, tracking_number, transaction_type,
                amount, amount_formatted, src_bank_code, src_account_number,
                src_account_name, dest_bank_code, dest_account_number,
                dest_account_name, narration, status, client_callback_url,
                client_ip, user_agent, request_timestamp, timeout_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING *
        `, [
            data.institutionId,
            data.credentialId,
            data.referenceNumber,
            data.sessionId,
            data.trackingNumber,
            data.transactionType,
            data.amount || 0,
            data.amountFormatted,
            data.srcBankCode,
            data.srcAccountNumber,
            data.srcAccountName || null,
            data.destBankCode,
            data.destAccountNumber,
            data.destAccountName || null,
            data.narration || null,
            'INITIATED',
            data.callbackUrl || null,
            data.clientIp || null,
            data.userAgent || null,
            data.requestTimestamp || new Date(),
            data.timeoutAt
        ]);

        return result.rows[0];
    },

    /**
     * Find transaction by ID
     */
    async findById(id, institutionId = null) {
        let sql = 'SELECT * FROM transactions WHERE id = $1';
        const params = [id];

        if (institutionId) {
            sql += ' AND institution_id = $2';
            params.push(institutionId);
        }

        const result = await query(sql, params);
        return result.rows[0] || null;
    },

    /**
     * Find transaction by reference number
     */
    async findByReference(referenceNumber, institutionId = null) {
        let sql = 'SELECT * FROM transactions WHERE reference_number = $1';
        const params = [referenceNumber];

        if (institutionId) {
            sql += ' AND institution_id = $2';
            params.push(institutionId);
        }

        const result = await query(sql, params);
        return result.rows[0] || null;
    },

    /**
     * Find transaction by session ID (checks FTD, FTC, and Reversal sessions)
     */
    async findBySessionId(sessionId) {
        const result = await query(`
            SELECT * FROM transactions
            WHERE session_id = $1
               OR ftc_session_id = $1
               OR reversal_session_id = $1
        `, [sessionId]);
        return result.rows[0] || null;
    },

    /**
     * Update FTC session info
     */
    async updateFtcSession(id, sessionId, trackingNumber) {
        await query(`
            UPDATE transactions
            SET ftc_session_id = $2, ftc_tracking_number = $3
            WHERE id = $1
        `, [id, sessionId, trackingNumber]);
    },

    /**
     * Check if reference exists
     */
    async referenceExists(referenceNumber) {
        const result = await query(
            'SELECT id FROM transactions WHERE reference_number = $1',
            [referenceNumber]
        );
        return result.rowCount > 0;
    },

    /**
     * Update transaction status
     */
    async updateStatus(id, status, additionalFields = {}) {
        const setClauses = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
        const values = [id, status];
        let paramIndex = 3;

        for (const [key, value] of Object.entries(additionalFields)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            setClauses.push(`${snakeKey} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }

        // Add completed_at for terminal states
        if (['COMPLETED', 'FAILED', 'TIMEOUT'].includes(status)) {
            setClauses.push('completed_at = CURRENT_TIMESTAMP');
        }

        const result = await query(`
            UPDATE transactions SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *
        `, values);

        return result.rows[0] || null;
    },

    /**
     * List transactions with filters
     */
    async findAll(filters = {}) {
        const { institutionId, status, type, fromDate, toDate, referenceNumber, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        let sql = `
            SELECT id, reference_number, session_id, transaction_type, amount,
                   src_bank_code, dest_bank_code, status, status_message,
                   client_callback_sent, created_at, completed_at
            FROM transactions WHERE 1=1
        `;
        const params = [];

        if (institutionId) {
            params.push(institutionId);
            sql += ` AND institution_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            sql += ` AND status = $${params.length}`;
        }
        if (type) {
            params.push(type);
            sql += ` AND transaction_type = $${params.length}`;
        }
        if (fromDate) {
            params.push(fromDate);
            sql += ` AND created_at >= $${params.length}`;
        }
        if (toDate) {
            params.push(toDate);
            sql += ` AND created_at <= $${params.length}`;
        }
        if (referenceNumber) {
            params.push(`%${referenceNumber}%`);
            sql += ` AND reference_number LIKE $${params.length}`;
        }

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        // Get total count
        let countSql = 'SELECT COUNT(*) FROM transactions WHERE 1=1';
        const countParams = [];
        if (institutionId) {
            countParams.push(institutionId);
            countSql += ` AND institution_id = $${countParams.length}`;
        }
        const countResult = await query(countSql, countParams);

        return {
            data: result.rows,
            total: parseInt(countResult.rows[0].count),
            page,
            limit
        };
    },

    /**
     * Find transactions by status
     */
    async findByStatus(status, limit = 10) {
        const result = await query(`
            SELECT * FROM transactions
            WHERE status = $1
            ORDER BY updated_at ASC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
        `, [status, limit]);
        return result.rows;
    },

    /**
     * Find transactions needing TSQ
     */
    async findNeedingTsq(limit = 10) {
        const result = await query(`
            SELECT * FROM transactions
            WHERE tsq_required = true
              AND tsq_next_attempt_at <= CURRENT_TIMESTAMP
              AND status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')
            ORDER BY tsq_next_attempt_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        `, [limit]);
        return result.rows;
    },

    /**
     * Find transactions needing reversal
     */
    async findNeedingReversal(limit = 10) {
        const result = await query(`
            SELECT * FROM transactions
            WHERE reversal_required = true
              AND status = 'REVERSAL_PENDING'
              AND reversal_attempts < 3
            ORDER BY updated_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        `, [limit]);
        return result.rows;
    },

    /**
     * Find timed out transactions
     */
    async findTimedOut(limit = 10) {
        const result = await query(`
            SELECT * FROM transactions
            WHERE timeout_at < CURRENT_TIMESTAMP
              AND status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT', 'REVERSAL_PENDING', 'REVERSAL_SUCCESS', 'REVERSAL_FAILED')
            ORDER BY timeout_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        `, [limit]);
        return result.rows;
    },

    /**
     * Schedule TSQ check
     */
    async scheduleTsq(id, delayMinutes = 5) {
        const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000);
        await query(`
            UPDATE transactions
            SET tsq_required = true, tsq_next_attempt_at = $2, tsq_attempts = tsq_attempts + 1
            WHERE id = $1
        `, [id, nextAttempt]);
    },

    /**
     * Mark for reversal
     */
    async markForReversal(id) {
        await query(`
            UPDATE transactions
            SET reversal_required = true, status = 'REVERSAL_PENDING'
            WHERE id = $1
        `, [id]);
    },

    /**
     * Update reversal info
     */
    async updateReversalInfo(id, sessionId, trackingNumber) {
        await query(`
            UPDATE transactions
            SET reversal_session_id = $2, reversal_tracking_number = $3, reversal_attempts = reversal_attempts + 1
            WHERE id = $1
        `, [id, sessionId, trackingNumber]);
    },

    /**
     * Get transaction statistics (optimized single-pass query)
     */
    async getStats() {
        const result = await query(`
            SELECT
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
                COUNT(*) FILTER (WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE) as today_success,
                COUNT(*) FILTER (WHERE status = 'FAILED' AND created_at >= CURRENT_DATE) as today_failed,
                COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')) as pending_count,
                COUNT(*) FILTER (WHERE reversal_required = true AND status = 'REVERSAL_PENDING') as pending_reversals,
                COUNT(*) FILTER (WHERE tsq_required = true AND status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')) as pending_tsq,
                COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE), 0) as today_volume
            FROM transactions
            WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
               OR status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')
        `);
        return result.rows[0];
    },

    /**
     * Find FTD success transactions needing FTC (optimized)
     */
    async findNeedingFtc(limit = 10) {
        const result = await query(`
            SELECT id, institution_id, session_id, tracking_number,
                   src_bank_code, dest_bank_code, src_account_number, dest_account_number,
                   src_account_name, dest_account_name, amount_formatted, narration
            FROM transactions
            WHERE status = 'FTD_SUCCESS'
            ORDER BY updated_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        `, [limit]);
        return result.rows;
    }
};

module.exports = TransactionModel;
