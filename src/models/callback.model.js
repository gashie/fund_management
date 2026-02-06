/**
 * Callback Model
 * Database operations for GIP callbacks and client webhooks
 */

const { query } = require('./db');

const CallbackModel = {
    // ============== GIP CALLBACKS (Incoming) ==============

    /**
     * Save incoming GIP callback
     */
    async saveGipCallback(data) {
        const result = await query(`
            INSERT INTO gip_callbacks (
                transaction_id, session_id, tracking_number, function_code,
                action_code, approval_code, amount, date_time, origin_bank,
                dest_bank, account_to_debit, account_to_credit, name_to_debit,
                name_to_credit, channel_code, narration, raw_payload, received_from_ip
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `, [
            data.transactionId,
            data.sessionId,
            data.trackingNumber,
            data.functionCode,
            data.actionCode,
            data.approvalCode,
            data.amount,
            data.dateTime,
            data.originBank,
            data.destBank,
            data.accountToDebit,
            data.accountToCredit,
            data.nameToDebit,
            data.nameToCredit,
            data.channelCode,
            data.narration,
            JSON.stringify(data.rawPayload),
            data.clientIp
        ]);

        return result.rows[0];
    },

    /**
     * Find pending GIP callbacks
     */
    async findPendingGipCallbacks(limit = 10) {
        const result = await query(`
            SELECT c.*, t.client_callback_url, t.institution_id
            FROM gip_callbacks c
            LEFT JOIN transactions t ON c.session_id = t.session_id
            WHERE c.status = 'PENDING'
            ORDER BY c.received_at ASC
            LIMIT $1
            FOR UPDATE OF c SKIP LOCKED
        `, [limit]);
        return result.rows;
    },

    /**
     * Find GIP callback by session ID and function code
     */
    async findGipCallbackBySession(sessionId, functionCode) {
        const result = await query(`
            SELECT * FROM gip_callbacks
            WHERE session_id = $1 AND function_code = $2
            ORDER BY received_at DESC LIMIT 1
        `, [sessionId, functionCode]);
        return result.rows[0] || null;
    },

    /**
     * Update GIP callback status
     */
    async updateGipCallbackStatus(id, status, error = null) {
        await query(`
            UPDATE gip_callbacks
            SET status = $2, processed_at = CURRENT_TIMESTAMP, processing_error = $3
            WHERE id = $1
        `, [id, status, error]);
    },

    // ============== CLIENT CALLBACKS (Outgoing) ==============

    /**
     * Create client callback
     */
    async createClientCallback(data) {
        const result = await query(`
            INSERT INTO client_callbacks (
                transaction_id, institution_id, callback_url, callback_payload, next_attempt_at
            ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            data.transactionId,
            data.institutionId,
            data.callbackUrl,
            JSON.stringify(data.payload)
        ]);
        return result.rows[0];
    },

    /**
     * Find pending client callbacks (optimized with specific columns)
     */
    async findPendingClientCallbacks(limit = 10) {
        const result = await query(`
            SELECT c.id, c.transaction_id, c.institution_id, c.callback_url,
                   c.callback_payload, c.attempts, c.max_attempts,
                   i.webhook_secret, t.reference_number
            FROM client_callbacks c
            JOIN transactions t ON c.transaction_id = t.id
            JOIN institutions i ON c.institution_id = i.id
            WHERE c.status IN ('PENDING', 'FAILED')
              AND c.next_attempt_at <= CURRENT_TIMESTAMP
              AND c.attempts < c.max_attempts
            ORDER BY c.next_attempt_at ASC
            LIMIT $1
            FOR UPDATE OF c SKIP LOCKED
        `, [limit]);
        return result.rows;
    },

    /**
     * Mark client callback as delivered
     */
    async markClientCallbackDelivered(id, statusCode, responseBody) {
        await query(`
            UPDATE client_callbacks
            SET status = 'DELIVERED',
                attempts = attempts + 1,
                last_attempt_at = CURRENT_TIMESTAMP,
                response_status_code = $2,
                response_body = $3,
                response_received_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [id, statusCode, responseBody?.substring(0, 1000)]);
    },

    /**
     * Schedule client callback retry
     */
    async scheduleClientCallbackRetry(id, delaySeconds, statusCode, error) {
        const nextAttempt = new Date(Date.now() + delaySeconds * 1000);
        await query(`
            UPDATE client_callbacks
            SET status = 'FAILED',
                attempts = attempts + 1,
                last_attempt_at = CURRENT_TIMESTAMP,
                next_attempt_at = $2,
                response_status_code = $3,
                last_error = $4
            WHERE id = $1
        `, [id, nextAttempt, statusCode, error?.substring(0, 500)]);
    },

    /**
     * Mark client callback as permanently failed
     */
    async markClientCallbackFailed(id, statusCode, error) {
        await query(`
            UPDATE client_callbacks
            SET status = 'FAILED',
                attempts = attempts + 1,
                last_attempt_at = CURRENT_TIMESTAMP,
                response_status_code = $2,
                last_error = $3
            WHERE id = $1
        `, [id, statusCode, error?.substring(0, 500)]);
    },

    /**
     * Update transaction callback sent status
     */
    async markTransactionCallbackSent(transactionId, response) {
        await query(`
            UPDATE transactions
            SET client_callback_sent = true,
                client_callback_sent_at = CURRENT_TIMESTAMP,
                client_callback_response = $2
            WHERE id = $1
        `, [transactionId, JSON.stringify(response)]);
    }
};

module.exports = CallbackModel;
