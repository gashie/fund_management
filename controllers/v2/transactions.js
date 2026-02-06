/**
 * Transaction Controller v2
 * Handles NEC, FT, and TSQ requests
 */

const axios = require('axios');
const {
    updateTransactionStatus,
    logGipEvent,
    queueClientCallback,
    INCONCLUSIVE_CODES
} = require('../../middleware/transaction');
const {
    gipNedUrl,
    gipFtdUrl,
    gipTsqUrl,
    CHANNEL_CODE,
    NEC_CODE,
    FTD_CODE,
    FTC_CODE
} = require('../../config/config');
const { toSnakeCase, convertTimestampToCustomFormat } = require('../../helper/func');

/**
 * Name Enquiry (NEC) - Synchronous
 * Calls GIP and returns account name immediately
 */
exports.nameEnquiry = async (req, res) => {
    const pool = req.app.get('db');
    const transaction = req.transaction;

    try {
        // Build NEC payload for GIP
        const necPayload = {
            dateTime: convertTimestampToCustomFormat(),
            sessionId: transaction.session_id,
            trackingNumber: transaction.tracking_number,
            functionCode: NEC_CODE.toString(),  // 230
            channelCode: CHANNEL_CODE.toString(),
            originBank: transaction.src_bank_code,
            destBank: transaction.dest_bank_code,
            accountToCredit: transaction.src_account_number,
            accountToDebit: transaction.dest_account_number,
            amount: '000000000000',  // NEC has no amount
            narration: 'Name Enquiry'
        };

        // Update status to NEC_PENDING
        await updateTransactionStatus(pool, transaction.id, 'NEC_PENDING', {}, 'api');

        // Log the NEC request
        await logGipEvent(
            pool,
            transaction.id,
            'NEC_REQUEST',
            1,
            transaction.session_id,
            transaction.tracking_number,
            NEC_CODE.toString(),
            necPayload,
            null,
            null,
            'PENDING'
        );

        // Make NEC request to GIP
        const response = await makeGipRequest(necPayload, gipNedUrl);

        // Log the NEC response
        await logGipEvent(
            pool,
            transaction.id,
            'NEC_RESPONSE',
            1,
            transaction.session_id,
            transaction.tracking_number,
            NEC_CODE.toString(),
            necPayload,
            response,
            response?.actionCode,
            response?.actionCode === '000' ? 'SUCCESS' : 'FAILED'
        );

        const actionCode = response?.actionCode;
        const accountName = response?.nameToDebit || response?.nameToCredit;

        if (actionCode === '000') {
            // NEC Success
            await updateTransactionStatus(pool, transaction.id, 'NEC_SUCCESS', {
                nec_action_code: actionCode,
                dest_account_name: accountName
            }, 'api');

            // For NEC-only transactions, mark as completed
            if (transaction.transaction_type === 'NEC') {
                await updateTransactionStatus(pool, transaction.id, 'COMPLETED', {
                    status_message: 'Name enquiry completed successfully'
                }, 'api');
            }

            return res.json({
                responseCode: '000',
                responseMessage: 'SUCCESS',
                status: 'SUCCESS',
                sessionId: transaction.session_id,
                referenceNumber: transaction.reference_number,
                destBankCode: transaction.dest_bank_code,
                destAccountNumber: transaction.dest_account_number,
                destAccountName: accountName
            });

        } else {
            // NEC Failed
            await updateTransactionStatus(pool, transaction.id, 'NEC_FAILED', {
                nec_action_code: actionCode,
                status_message: `NEC failed: ${actionCode}`
            }, 'api');

            await updateTransactionStatus(pool, transaction.id, 'FAILED', {
                status_message: `Name enquiry failed with code: ${actionCode}`
            }, 'api');

            return res.json({
                responseCode: actionCode || '999',
                responseMessage: 'FAILED',
                status: 'FAILED',
                sessionId: transaction.session_id,
                referenceNumber: transaction.reference_number,
                error: `Name enquiry failed with action code: ${actionCode}`
            });
        }

    } catch (error) {
        console.error('NEC error:', error);

        await updateTransactionStatus(pool, transaction.id, 'FAILED', {
            status_message: `NEC error: ${error.message}`
        }, 'api');

        return res.status(500).json({
            responseCode: '999',
            responseMessage: 'ERROR',
            status: 'ERROR',
            sessionId: transaction.session_id,
            referenceNumber: transaction.reference_number,
            error: 'Name enquiry service error'
        });
    }
};

/**
 * Funds Transfer (FT) - Asynchronous
 * Initiates FTD and returns immediately
 * Result will be sent via callback
 */
exports.fundsTransfer = async (req, res) => {
    const pool = req.app.get('db');
    const transaction = req.transaction;

    try {
        // Build FTD payload for GIP
        const ftdPayload = {
            dateTime: convertTimestampToCustomFormat(),
            sessionId: transaction.session_id,
            trackingNumber: transaction.tracking_number,
            functionCode: FTD_CODE.toString(),  // 241
            channelCode: CHANNEL_CODE.toString(),
            originBank: transaction.src_bank_code,
            destBank: transaction.dest_bank_code,
            accountToCredit: transaction.src_account_number,
            accountToDebit: transaction.dest_account_number,
            nameToCredit: transaction.src_account_name,
            nameToDebit: transaction.dest_account_name,
            amount: transaction.amount_formatted,
            narration: transaction.narration
        };

        // Update status to FTD_PENDING
        await updateTransactionStatus(pool, transaction.id, 'FTD_PENDING', {
            status_message: 'FTD request sent, waiting for callback'
        }, 'api');

        // Log the FTD request
        await logGipEvent(
            pool,
            transaction.id,
            'FTD_REQUEST',
            1,
            transaction.session_id,
            transaction.tracking_number,
            FTD_CODE.toString(),
            ftdPayload,
            null,
            null,
            'PENDING'
        );

        // Make FTD request to GIP (async - don't wait for callback)
        makeGipRequest(ftdPayload, gipFtdUrl)
            .then(async (response) => {
                // Log the initial response
                await logGipEvent(
                    pool,
                    transaction.id,
                    'FTD_REQUEST',
                    1,
                    transaction.session_id,
                    transaction.tracking_number,
                    FTD_CODE.toString(),
                    ftdPayload,
                    response,
                    response?.actionCode,
                    'SENT'
                );
            })
            .catch(async (error) => {
                console.error('FTD request error:', error);
                // Will be handled by timeout worker
            });

        // Return immediately - callback will come later
        return res.status(202).json({
            responseCode: '000',
            responseMessage: 'ACCEPTED',
            status: 'PENDING',
            sessionId: transaction.session_id,
            referenceNumber: transaction.reference_number,
            transactionId: transaction.id,
            message: 'Transfer request accepted. You will receive a callback when complete.'
        });

    } catch (error) {
        console.error('FT error:', error);

        await updateTransactionStatus(pool, transaction.id, 'FAILED', {
            status_message: `FT error: ${error.message}`
        }, 'api');

        return res.status(500).json({
            responseCode: '999',
            responseMessage: 'ERROR',
            status: 'ERROR',
            sessionId: transaction.session_id,
            referenceNumber: transaction.reference_number,
            error: 'Transfer service error'
        });
    }
};

/**
 * Transaction Status Query (TSQ)
 * Query status of a previous transaction
 */
exports.statusQuery = async (req, res) => {
    const pool = req.app.get('db');
    const payload = toSnakeCase(req.body);

    try {
        // Find the original transaction
        const result = await pool.query(`
            SELECT *
            FROM transactions
            WHERE reference_number = $1
              AND institution_id = $2
        `, [payload.reference_number, req.institution.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                responseCode: '381',
                responseMessage: 'NOT_FOUND',
                status: 'NOT_FOUND',
                referenceNumber: payload.reference_number,
                error: 'Transaction not found'
            });
        }

        const transaction = result.rows[0];

        // If transaction is in a terminal state, return stored status
        if (['COMPLETED', 'FAILED', 'TIMEOUT'].includes(transaction.status)) {
            return res.json({
                responseCode: transaction.status === 'COMPLETED' ? '000' : '999',
                responseMessage: transaction.status,
                status: transaction.status,
                referenceNumber: transaction.reference_number,
                sessionId: transaction.session_id,
                amount: transaction.amount,
                srcBankCode: transaction.src_bank_code,
                destBankCode: transaction.dest_bank_code,
                statusMessage: transaction.status_message,
                completedAt: transaction.completed_at
            });
        }

        // For pending transactions, make TSQ request to GIP
        const tsqPayload = {
            dateTime: convertTimestampToCustomFormat(),
            sessionId: transaction.session_id,
            trackingNumber: transaction.tracking_number,
            functionCode: '230',  // TSQ function code
            channelCode: CHANNEL_CODE.toString(),
            originBank: transaction.src_bank_code,
            destBank: transaction.dest_bank_code,
            accountToCredit: transaction.src_account_number,
            accountToDebit: transaction.dest_account_number,
            amount: transaction.amount_formatted,
            narration: transaction.narration
        };

        const response = await makeGipRequest(tsqPayload, gipTsqUrl);

        // Log TSQ
        await logGipEvent(
            pool,
            transaction.id,
            `${transaction.status.replace('_PENDING', '').replace('_TSQ', '')}_TSQ_RESPONSE`,
            99,
            transaction.session_id,
            transaction.tracking_number,
            '230',
            tsqPayload,
            response,
            response?.actionCode,
            'MANUAL_TSQ'
        );

        return res.json({
            responseCode: response?.actionCode || '990',
            responseMessage: response?.actionCode === '000' ? 'SUCCESS' : 'PENDING',
            status: transaction.status,
            referenceNumber: transaction.reference_number,
            sessionId: transaction.session_id,
            gipActionCode: response?.actionCode,
            gipStatusCode: response?.statusCode || response?.statusQuery,
            amount: transaction.amount,
            statusMessage: transaction.status_message
        });

    } catch (error) {
        console.error('TSQ error:', error);
        return res.status(500).json({
            responseCode: '999',
            responseMessage: 'ERROR',
            status: 'ERROR',
            error: 'Status query service error'
        });
    }
};

/**
 * Get transaction by ID
 */
exports.getTransaction = async (req, res) => {
    const pool = req.app.get('db');
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT
                t.*,
                (
                    SELECT json_agg(e ORDER BY e.event_sequence)
                    FROM gip_events e
                    WHERE e.transaction_id = t.id
                ) as events
            FROM transactions t
            WHERE t.id = $1 AND t.institution_id = $2
        `, [id, req.institution.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transaction'
        });
    }
};

/**
 * List transactions with filters
 */
exports.listTransactions = async (req, res) => {
    const pool = req.app.get('db');
    const {
        page = 1,
        limit = 20,
        status,
        type,
        fromDate,
        toDate,
        referenceNumber
    } = req.query;

    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT
                id,
                reference_number,
                session_id,
                transaction_type,
                amount,
                src_bank_code,
                dest_bank_code,
                status,
                status_message,
                client_callback_sent,
                created_at,
                completed_at
            FROM transactions
            WHERE institution_id = $1
        `;

        const params = [req.institution.id];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (type) {
            params.push(type);
            query += ` AND transaction_type = $${params.length}`;
        }

        if (fromDate) {
            params.push(fromDate);
            query += ` AND created_at >= $${params.length}`;
        }

        if (toDate) {
            params.push(toDate);
            query += ` AND created_at <= $${params.length}`;
        }

        if (referenceNumber) {
            params.push(`%${referenceNumber}%`);
            query += ` AND reference_number LIKE $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM transactions WHERE institution_id = $1';
        const countParams = [req.institution.id];
        // Note: For simplicity, using same filters would require building the query dynamically
        const countResult = await pool.query(countQuery, countParams);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count)
            }
        });

    } catch (error) {
        console.error('List transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list transactions'
        });
    }
};

/**
 * Get system stats (admin)
 */
exports.getStats = async (req, res) => {
    const pool = req.app.get('db');

    try {
        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as today_count,
                (SELECT COUNT(*) FROM transactions WHERE status = 'COMPLETED' AND DATE(created_at) = CURRENT_DATE) as today_success,
                (SELECT COUNT(*) FROM transactions WHERE status = 'FAILED' AND DATE(created_at) = CURRENT_DATE) as today_failed,
                (SELECT COUNT(*) FROM transactions WHERE status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')) as pending_count,
                (SELECT COUNT(*) FROM transactions WHERE reversal_required = true AND status = 'REVERSAL_PENDING') as pending_reversals,
                (SELECT COUNT(*) FROM tsq_queue WHERE status = 'PENDING') as pending_tsq,
                (SELECT COUNT(*) FROM client_callbacks WHERE status = 'PENDING') as pending_callbacks,
                (SELECT SUM(amount) FROM transactions WHERE status = 'COMPLETED' AND DATE(created_at) = CURRENT_DATE) as today_volume
        `);

        res.json({
            success: true,
            data: stats.rows[0]
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get stats'
        });
    }
};

/**
 * Make GIP request helper
 */
async function makeGipRequest(payload, url) {
    try {
        const response = await axios.post(url, payload, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            return error.response.data;
        }
        throw error;
    }
}
