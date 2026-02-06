/**
 * Callback Controller v2
 * Handles incoming callbacks from GIP
 */

const { toSnakeCase } = require('../../helper/func');

/**
 * Receive callback from GIP
 * This endpoint receives callbacks for FTD, FTC, and Reversal operations
 */
exports.receiveCallback = async (req, res) => {
    const pool = req.app.get('db');

    try {
        const payload = req.body;
        const snakePayload = toSnakeCase(payload);

        // Extract key fields from callback
        const callbackData = {
            session_id: snakePayload.session_id || payload.sessionId,
            tracking_number: snakePayload.tracking_number || payload.trackingNumber,
            function_code: snakePayload.function_code || payload.functionCode,
            action_code: snakePayload.action_code || payload.actionCode,
            approval_code: snakePayload.approval_code || payload.approvalCode,
            amount: snakePayload.amount || payload.amount,
            date_time: snakePayload.date_time || payload.dateTime,
            origin_bank: snakePayload.origin_bank || payload.originBank,
            dest_bank: snakePayload.dest_bank || payload.destBank,
            account_to_debit: snakePayload.account_to_debit || payload.accountToDebit,
            account_to_credit: snakePayload.account_to_credit || payload.accountToCredit,
            name_to_debit: snakePayload.name_to_debit || payload.nameToDebit,
            name_to_credit: snakePayload.name_to_credit || payload.nameToCredit,
            channel_code: snakePayload.channel_code || payload.channelCode,
            narration: snakePayload.narration || payload.narration
        };

        // Find matching transaction
        const transactionResult = await pool.query(`
            SELECT id, institution_id, client_callback_url
            FROM transactions
            WHERE session_id = $1
        `, [callbackData.session_id]);

        const transactionId = transactionResult.rows[0]?.id || null;
        const institutionId = transactionResult.rows[0]?.institution_id || null;
        const clientCallbackUrl = transactionResult.rows[0]?.client_callback_url || null;

        // Store callback in database
        const result = await pool.query(`
            INSERT INTO gip_callbacks (
                transaction_id,
                session_id,
                tracking_number,
                function_code,
                action_code,
                approval_code,
                amount,
                date_time,
                origin_bank,
                dest_bank,
                account_to_debit,
                account_to_credit,
                name_to_debit,
                name_to_credit,
                channel_code,
                narration,
                raw_payload,
                received_from_ip,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'PENDING')
            RETURNING id
        `, [
            transactionId,
            callbackData.session_id,
            callbackData.tracking_number,
            callbackData.function_code,
            callbackData.action_code,
            callbackData.approval_code,
            callbackData.amount,
            callbackData.date_time,
            callbackData.origin_bank,
            callbackData.dest_bank,
            callbackData.account_to_debit,
            callbackData.account_to_credit,
            callbackData.name_to_debit,
            callbackData.name_to_credit,
            callbackData.channel_code,
            callbackData.narration,
            JSON.stringify(payload),
            req.ip || req.connection.remoteAddress
        ]);

        const callbackId = result.rows[0].id;

        // Log to audit
        await pool.query(`
            INSERT INTO audit_log (entity_type, entity_id, action, new_value, triggered_by, ip_address)
            VALUES ('callback', $1, 'received', $2, 'gip', $3)
        `, [
            callbackId,
            JSON.stringify({
                functionCode: callbackData.function_code,
                actionCode: callbackData.action_code,
                sessionId: callbackData.session_id
            }),
            req.ip
        ]);

        console.log(`Callback received: ${callbackId} - Function: ${callbackData.function_code}, Action: ${callbackData.action_code}, Session: ${callbackData.session_id}`);

        // Return success to GIP
        res.json({
            success: true,
            message: 'Callback received',
            callbackId: callbackId
        });

    } catch (error) {
        console.error('Callback receive error:', error);

        // Still return 200 to GIP to acknowledge receipt
        // but log the error for investigation
        res.json({
            success: false,
            message: 'Callback received with errors',
            error: error.message
        });
    }
};

/**
 * List callbacks (admin endpoint)
 */
exports.listCallbacks = async (req, res) => {
    const pool = req.app.get('db');
    const {
        page = 1,
        limit = 20,
        status,
        functionCode,
        sessionId
    } = req.query;

    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT
                c.*,
                t.reference_number,
                t.status as transaction_status
            FROM gip_callbacks c
            LEFT JOIN transactions t ON c.transaction_id = t.id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            params.push(status);
            query += ` AND c.status = $${params.length}`;
        }

        if (functionCode) {
            params.push(functionCode);
            query += ` AND c.function_code = $${params.length}`;
        }

        if (sessionId) {
            params.push(sessionId);
            query += ` AND c.session_id = $${params.length}`;
        }

        query += ` ORDER BY c.received_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('List callbacks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list callbacks'
        });
    }
};
