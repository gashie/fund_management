/**
 * Event Model
 * Database operations for GIP events and audit logging
 */

const { query } = require('./db');

const EventModel = {
    /**
     * Log a GIP event
     * Uses ON CONFLICT to handle duplicate event_sequence gracefully
     */
    async logGipEvent(data) {
        const result = await query(`
            INSERT INTO gip_events (
                transaction_id, event_type, event_sequence, session_id,
                tracking_number, function_code, request_payload, response_payload,
                action_code, status, request_sent_at, response_received_at, duration_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (transaction_id, event_sequence) DO UPDATE SET
                event_type = EXCLUDED.event_type,
                session_id = COALESCE(EXCLUDED.session_id, gip_events.session_id),
                tracking_number = COALESCE(EXCLUDED.tracking_number, gip_events.tracking_number),
                function_code = COALESCE(EXCLUDED.function_code, gip_events.function_code),
                request_payload = COALESCE(EXCLUDED.request_payload, gip_events.request_payload),
                response_payload = COALESCE(EXCLUDED.response_payload, gip_events.response_payload),
                action_code = COALESCE(EXCLUDED.action_code, gip_events.action_code),
                status = EXCLUDED.status,
                response_received_at = COALESCE(EXCLUDED.response_received_at, gip_events.response_received_at)
            RETURNING *
        `, [
            data.transactionId,
            data.eventType,
            data.eventSequence,
            data.sessionId,
            data.trackingNumber,
            data.functionCode,
            JSON.stringify(data.requestPayload),
            data.responsePayload ? JSON.stringify(data.responsePayload) : null,
            data.actionCode,
            data.status || 'PENDING',
            data.requestSentAt || new Date(),
            data.responseReceivedAt || null,
            data.durationMs || null
        ]);
        return result.rows[0];
    },

    /**
     * Update GIP event with response
     */
    async updateGipEvent(transactionId, eventType, responsePayload, actionCode, status) {
        await query(`
            UPDATE gip_events
            SET response_payload = $3,
                action_code = $4,
                status = $5,
                response_received_at = CURRENT_TIMESTAMP
            WHERE id = (
                SELECT id FROM gip_events
                WHERE transaction_id = $1 AND event_type = $2
                ORDER BY created_at DESC LIMIT 1
            )
        `, [transactionId, eventType, JSON.stringify(responsePayload), actionCode, status]);
    },

    /**
     * Find events for transaction
     */
    async findByTransactionId(transactionId) {
        const result = await query(`
            SELECT * FROM gip_events
            WHERE transaction_id = $1
            ORDER BY event_sequence ASC, created_at ASC
        `, [transactionId]);
        return result.rows;
    },

    /**
     * Get latest event for transaction
     */
    async getLatestEvent(transactionId, eventType = null) {
        let sql = 'SELECT * FROM gip_events WHERE transaction_id = $1';
        const params = [transactionId];

        if (eventType) {
            params.push(eventType);
            sql += ` AND event_type = $${params.length}`;
        }

        sql += ' ORDER BY created_at DESC LIMIT 1';

        const result = await query(sql, params);
        return result.rows[0] || null;
    },

    // ============== AUDIT LOG ==============

    /**
     * Create audit log entry
     */
    async createAuditLog(data) {
        await query(`
            INSERT INTO audit_log (
                entity_type, entity_id, action, old_value, new_value,
                triggered_by, triggered_by_id, details, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            data.entityType,
            data.entityId,
            data.action,
            data.oldValue ? JSON.stringify(data.oldValue) : null,
            data.newValue ? JSON.stringify(data.newValue) : null,
            data.triggeredBy || 'system',
            data.triggeredById || null,
            data.details ? JSON.stringify(data.details) : null,
            data.ipAddress || null
        ]);
    },

    /**
     * Find audit logs for entity
     */
    async findAuditLogs(entityType, entityId, limit = 50) {
        const result = await query(`
            SELECT * FROM audit_log
            WHERE entity_type = $1 AND entity_id = $2
            ORDER BY created_at DESC
            LIMIT $3
        `, [entityType, entityId, limit]);
        return result.rows;
    }
};

module.exports = EventModel;
