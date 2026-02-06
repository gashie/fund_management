/**
 * Monitoring Model
 * Database operations for system monitoring and insights
 */

const { query } = require('./db');

/**
 * Get real-time dashboard stats
 */
const getDashboardStats = async () => {
    const result = await query(`
        SELECT
            -- Today's counts
            (SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as today_total,
            (SELECT COUNT(*) FROM transactions WHERE status = 'COMPLETED' AND DATE(created_at) = CURRENT_DATE) as today_completed,
            (SELECT COUNT(*) FROM transactions WHERE status = 'FAILED' AND DATE(created_at) = CURRENT_DATE) as today_failed,
            (SELECT COUNT(*) FROM transactions WHERE status = 'TIMEOUT' AND DATE(created_at) = CURRENT_DATE) as today_timeout,

            -- Volume
            (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'COMPLETED' AND DATE(created_at) = CURRENT_DATE) as today_volume,

            -- Pending counts
            (SELECT COUNT(*) FROM transactions WHERE status IN ('INITIATED', 'NEC_PENDING', 'FTD_PENDING', 'FTC_PENDING')) as pending_total,
            (SELECT COUNT(*) FROM transactions WHERE status = 'FTD_PENDING') as pending_ftd,
            (SELECT COUNT(*) FROM transactions WHERE status = 'FTC_PENDING') as pending_ftc,
            (SELECT COUNT(*) FROM transactions WHERE status IN ('FTD_TSQ', 'FTC_TSQ')) as pending_tsq,
            (SELECT COUNT(*) FROM transactions WHERE status = 'REVERSAL_PENDING') as pending_reversals,

            -- Critical alerts
            (SELECT COUNT(*) FROM transactions WHERE status = 'REVERSAL_FAILED') as critical_reversal_failed,
            (SELECT COUNT(*) FROM transactions WHERE timeout_at < CURRENT_TIMESTAMP AND status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')) as critical_timed_out,

            -- Callbacks
            (SELECT COUNT(*) FROM gip_callbacks WHERE status = 'PENDING') as callbacks_pending,
            (SELECT COUNT(*) FROM client_callbacks WHERE status IN ('PENDING', 'FAILED') AND attempts < max_attempts) as webhooks_pending,

            -- Last hour
            (SELECT COUNT(*) FROM transactions WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour') as last_hour_count,
            (SELECT COUNT(*) FROM transactions WHERE status = 'COMPLETED' AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour') as last_hour_completed
    `);
    return result.rows[0];
};

/**
 * Get transaction status breakdown
 */
const getStatusBreakdown = async (dateFrom, dateTo) => {
    const result = await query(`
        SELECT
            status,
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as total_amount
        FROM transactions
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY status
        ORDER BY count DESC
    `, [dateFrom, dateTo]);
    return result.rows;
};

/**
 * Get hourly transaction trends
 */
const getHourlyTrends = async (hours = 24) => {
    const result = await query(`
        SELECT
            DATE_TRUNC('hour', created_at) as hour,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
            COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
            COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED'), 0) as volume
        FROM transactions
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour DESC
    `);
    return result.rows;
};

/**
 * Get institution stats
 */
const getInstitutionStats = async () => {
    const result = await query(`
        SELECT
            i.id,
            i.institution_code,
            i.institution_name,
            COUNT(t.id) as total_transactions,
            COUNT(t.id) FILTER (WHERE t.status = 'COMPLETED') as completed,
            COUNT(t.id) FILTER (WHERE t.status = 'FAILED') as failed,
            COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'COMPLETED'), 0) as total_volume,
            MAX(t.created_at) as last_transaction
        FROM institutions i
        LEFT JOIN transactions t ON i.id = t.institution_id
        WHERE i.deleted_at IS NULL
        GROUP BY i.id, i.institution_code, i.institution_name
        ORDER BY total_transactions DESC
    `);
    return result.rows;
};

/**
 * Get failed transactions needing attention
 */
const getFailedTransactions = async (limit = 50) => {
    const result = await query(`
        SELECT
            t.*,
            i.institution_name
        FROM transactions t
        JOIN institutions i ON t.institution_id = i.id
        WHERE t.status IN ('FAILED', 'TIMEOUT', 'REVERSAL_FAILED', 'FTD_FAILED', 'FTC_FAILED')
        ORDER BY t.created_at DESC
        LIMIT $1
    `, [limit]);
    return result.rows;
};

/**
 * Get stuck transactions (pending too long)
 */
const getStuckTransactions = async (minutesThreshold = 30) => {
    const result = await query(`
        SELECT
            t.*,
            i.institution_name,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.updated_at))/60 as minutes_stuck
        FROM transactions t
        JOIN institutions i ON t.institution_id = i.id
        WHERE t.status IN ('FTD_PENDING', 'FTC_PENDING', 'FTD_TSQ', 'FTC_TSQ', 'REVERSAL_PENDING')
          AND t.updated_at < CURRENT_TIMESTAMP - INTERVAL '${minutesThreshold} minutes'
        ORDER BY t.updated_at ASC
    `);
    return result.rows;
};

/**
 * Get GIP API response times
 */
const getApiResponseTimes = async (hours = 24) => {
    const result = await query(`
        SELECT
            event_type,
            COUNT(*) as count,
            AVG(duration_ms) as avg_duration,
            MIN(duration_ms) as min_duration,
            MAX(duration_ms) as max_duration,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration
        FROM gip_events
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
          AND duration_ms IS NOT NULL
        GROUP BY event_type
        ORDER BY count DESC
    `);
    return result.rows;
};

/**
 * Get recent audit log
 */
const getRecentAuditLog = async (limit = 100) => {
    const result = await query(`
        SELECT *
        FROM audit_log
        ORDER BY created_at DESC
        LIMIT $1
    `, [limit]);
    return result.rows;
};

/**
 * Get transaction timeline
 */
const getTransactionTimeline = async (transactionId) => {
    const result = await query(`
        SELECT
            'event' as type,
            event_type as name,
            action_code,
            status,
            created_at as timestamp,
            request_payload,
            response_payload
        FROM gip_events
        WHERE transaction_id = $1

        UNION ALL

        SELECT
            'callback' as type,
            'GIP_CALLBACK' as name,
            action_code,
            status,
            received_at as timestamp,
            raw_payload as request_payload,
            NULL as response_payload
        FROM gip_callbacks
        WHERE transaction_id = $1

        UNION ALL

        SELECT
            'audit' as type,
            action as name,
            NULL as action_code,
            NULL as status,
            created_at as timestamp,
            new_value as request_payload,
            old_value as response_payload
        FROM audit_log
        WHERE entity_id = $1

        ORDER BY timestamp ASC
    `, [transactionId]);
    return result.rows;
};

/**
 * Get worker health
 */
const getWorkerHealth = async () => {
    const result = await query(`
        SELECT
            -- Callback processing
            (SELECT COUNT(*) FROM gip_callbacks WHERE status = 'PENDING' AND received_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes') as stale_callbacks,

            -- TSQ queue
            (SELECT COUNT(*) FROM transactions WHERE tsq_required = true AND tsq_next_attempt_at < CURRENT_TIMESTAMP) as overdue_tsq,

            -- Client callbacks
            (SELECT COUNT(*) FROM client_callbacks WHERE status = 'PENDING' AND next_attempt_at < CURRENT_TIMESTAMP) as overdue_webhooks,

            -- Reversals
            (SELECT COUNT(*) FROM transactions WHERE status = 'REVERSAL_PENDING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes') as stale_reversals
    `);
    return result.rows[0];
};

module.exports = {
    getDashboardStats,
    getStatusBreakdown,
    getHourlyTrends,
    getInstitutionStats,
    getFailedTransactions,
    getStuckTransactions,
    getApiResponseTimes,
    getRecentAuditLog,
    getTransactionTimeline,
    getWorkerHealth
};
