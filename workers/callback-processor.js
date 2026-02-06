/**
 * GIP Callback Processor Worker
 * Processes incoming callbacks from GIP and updates transaction state
 */

const { Pool } = require('pg');
const {
    determineTsqAction,
    updateTransactionStatus,
    scheduleTsqCheck,
    scheduleReversal,
    queueClientCallback,
    logGipEvent,
    INCONCLUSIVE_CODES
} = require('../middleware/transaction');

class CallbackProcessor {
    constructor(pool, logger) {
        this.pool = pool;
        this.logger = logger || console;
        this.isRunning = false;
        this.pollInterval = 2000;  // 2 seconds
    }

    async start() {
        this.isRunning = true;
        this.logger.info('Callback Processor started');

        while (this.isRunning) {
            try {
                await this.processPendingCallbacks();
            } catch (error) {
                this.logger.error('Error in callback processor:', error);
            }
            await this.sleep(this.pollInterval);
        }
    }

    stop() {
        this.isRunning = false;
        this.logger.info('Callback Processor stopped');
    }

    async processPendingCallbacks() {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Fetch pending callbacks with FOR UPDATE SKIP LOCKED to prevent race conditions
            const result = await client.query(`
                SELECT
                    c.*,
                    t.id as transaction_id,
                    t.status as transaction_status,
                    t.session_id as transaction_session_id,
                    t.tracking_number as transaction_tracking_number,
                    t.institution_id,
                    t.client_callback_url
                FROM gip_callbacks c
                LEFT JOIN transactions t ON c.session_id = t.session_id
                WHERE c.status = 'PENDING'
                ORDER BY c.received_at ASC
                LIMIT 10
                FOR UPDATE OF c SKIP LOCKED
            `);

            for (const callback of result.rows) {
                await this.processCallback(client, callback);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async processCallback(client, callback) {
        const {
            id: callbackId,
            function_code: functionCode,
            action_code: actionCode,
            session_id: sessionId,
            transaction_id: transactionId,
            transaction_status: currentStatus
        } = callback;

        this.logger.info(`Processing callback ${callbackId} - Function: ${functionCode}, Action: ${actionCode}`);

        if (!transactionId) {
            // Orphan callback - no matching transaction
            await this.markCallbackProcessed(client, callbackId, 'IGNORED', 'No matching transaction found');
            return;
        }

        try {
            // Route based on function code
            switch (functionCode) {
                case '241':  // FTD callback
                    await this.processFtdCallback(client, callback);
                    break;
                case '240':  // FTC callback
                    await this.processFtcCallback(client, callback);
                    break;
                case '242':  // Reversal callback
                    await this.processReversalCallback(client, callback);
                    break;
                default:
                    this.logger.warn(`Unknown function code: ${functionCode}`);
                    await this.markCallbackProcessed(client, callbackId, 'IGNORED', `Unknown function code: ${functionCode}`);
            }
        } catch (error) {
            this.logger.error(`Error processing callback ${callbackId}:`, error);
            await this.markCallbackProcessed(client, callbackId, 'ERROR', error.message);
        }
    }

    /**
     * Process FTD (Funds Transfer Debit) callback
     */
    async processFtdCallback(client, callback) {
        const {
            id: callbackId,
            action_code: actionCode,
            transaction_id: transactionId,
            transaction_status: currentStatus,
            session_id: sessionId,
            tracking_number: trackingNumber
        } = callback;

        // Log the GIP event
        await logGipEvent(
            client,
            transactionId,
            'FTD_CALLBACK',
            2,  // FTD callback is typically event #2
            sessionId,
            trackingNumber,
            '241',
            null,
            callback.raw_payload,
            actionCode,
            actionCode === '000' ? 'SUCCESS' : 'RECEIVED'
        );

        if (actionCode === '000') {
            // FTD Successful - proceed to FTC
            this.logger.info(`FTD Success for transaction ${transactionId} - proceeding to FTC`);

            await updateTransactionStatus(client, transactionId, 'FTD_SUCCESS', {
                ftd_action_code: actionCode
            }, 'callback_processor');

            // The FTC request will be initiated by the FTC worker
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');

        } else if (INCONCLUSIVE_CODES.includes(actionCode)) {
            // Inconclusive - schedule TSQ
            this.logger.info(`FTD Inconclusive (${actionCode}) for transaction ${transactionId} - scheduling TSQ`);

            await updateTransactionStatus(client, transactionId, 'FTD_TSQ', {
                ftd_action_code: actionCode,
                tsq_required: true
            }, 'callback_processor');

            await scheduleTsqCheck(client, transactionId, 'FTD', sessionId, trackingNumber, 5);
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');

        } else {
            // FTD Failed
            this.logger.info(`FTD Failed (${actionCode}) for transaction ${transactionId}`);

            await updateTransactionStatus(client, transactionId, 'FTD_FAILED', {
                ftd_action_code: actionCode,
                status_message: `FTD failed with action code: ${actionCode}`
            }, 'callback_processor');

            // Queue client callback with failure
            await this.queueFailureCallback(client, callback, 'FTD_FAILED');
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');
        }
    }

    /**
     * Process FTC (Funds Transfer Credit) callback
     */
    async processFtcCallback(client, callback) {
        const {
            id: callbackId,
            action_code: actionCode,
            transaction_id: transactionId,
            session_id: sessionId,
            tracking_number: trackingNumber
        } = callback;

        // Log the GIP event
        await logGipEvent(
            client,
            transactionId,
            'FTC_CALLBACK',
            4,  // FTC callback is typically event #4
            sessionId,
            trackingNumber,
            '240',
            null,
            callback.raw_payload,
            actionCode,
            actionCode === '000' ? 'SUCCESS' : 'RECEIVED'
        );

        if (actionCode === '000') {
            // FTC Successful - Transaction complete!
            this.logger.info(`FTC Success for transaction ${transactionId} - Transaction COMPLETED`);

            await updateTransactionStatus(client, transactionId, 'FTC_SUCCESS', {
                ftc_action_code: actionCode
            }, 'callback_processor');

            // Immediately transition to COMPLETED
            await updateTransactionStatus(client, transactionId, 'COMPLETED', {
                status_message: 'Transaction completed successfully'
            }, 'callback_processor');

            // Queue success callback to client
            await this.queueSuccessCallback(client, callback);
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');

        } else if (INCONCLUSIVE_CODES.includes(actionCode)) {
            // Inconclusive - schedule TSQ
            this.logger.info(`FTC Inconclusive (${actionCode}) for transaction ${transactionId} - scheduling TSQ`);

            await updateTransactionStatus(client, transactionId, 'FTC_TSQ', {
                ftc_action_code: actionCode,
                tsq_required: true
            }, 'callback_processor');

            await scheduleTsqCheck(client, transactionId, 'FTC', sessionId, trackingNumber, 5);
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');

        } else {
            // FTC Failed - CRITICAL: Must initiate reversal!
            this.logger.error(`FTC FAILED (${actionCode}) for transaction ${transactionId} - INITIATING REVERSAL`);

            await updateTransactionStatus(client, transactionId, 'FTC_FAILED', {
                ftc_action_code: actionCode,
                status_message: `FTC failed with action code: ${actionCode} - reversal required`
            }, 'callback_processor');

            // Schedule reversal to return funds
            await scheduleReversal(client, transactionId);
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');
        }
    }

    /**
     * Process Reversal callback
     */
    async processReversalCallback(client, callback) {
        const {
            id: callbackId,
            action_code: actionCode,
            transaction_id: transactionId,
            session_id: sessionId,
            tracking_number: trackingNumber
        } = callback;

        // Log the GIP event
        await logGipEvent(
            client,
            transactionId,
            'REVERSAL_CALLBACK',
            6,
            sessionId,
            trackingNumber,
            '242',
            null,
            callback.raw_payload,
            actionCode,
            actionCode === '000' ? 'SUCCESS' : 'RECEIVED'
        );

        if (actionCode === '000') {
            // Reversal successful
            this.logger.info(`Reversal Success for transaction ${transactionId}`);

            await updateTransactionStatus(client, transactionId, 'REVERSAL_SUCCESS', {
                reversal_action_code: actionCode
            }, 'callback_processor');

            // Final status: FAILED (but funds returned)
            await updateTransactionStatus(client, transactionId, 'FAILED', {
                status_message: 'Transaction failed - funds returned via reversal'
            }, 'callback_processor');

            await this.queueFailureCallback(client, callback, 'REVERSED');
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');

        } else {
            // Reversal failed - CRITICAL: Needs manual intervention!
            this.logger.error(`REVERSAL FAILED (${actionCode}) for transaction ${transactionId} - MANUAL INTERVENTION REQUIRED`);

            await updateTransactionStatus(client, transactionId, 'REVERSAL_FAILED', {
                reversal_action_code: actionCode,
                status_message: `CRITICAL: Reversal failed - manual intervention required`
            }, 'callback_processor');

            // Alert for manual intervention
            await this.createCriticalAlert(client, transactionId, 'REVERSAL_FAILED', actionCode);
            await this.markCallbackProcessed(client, callbackId, 'PROCESSED');
        }
    }

    async markCallbackProcessed(client, callbackId, status, error = null) {
        await client.query(`
            UPDATE gip_callbacks
            SET status = $2, processed_at = CURRENT_TIMESTAMP, processing_error = $3
            WHERE id = $1
        `, [callbackId, status, error]);
    }

    async queueSuccessCallback(client, callback) {
        const { transaction_id, institution_id, client_callback_url } = callback;

        if (!client_callback_url) {
            this.logger.warn(`No callback URL for transaction ${transaction_id}`);
            return;
        }

        const payload = {
            status: 'SUCCESS',
            transactionId: transaction_id,
            referenceNumber: callback.reference_number,
            sessionId: callback.session_id,
            actionCode: callback.action_code,
            amount: callback.amount,
            message: 'Transaction completed successfully'
        };

        await queueClientCallback(client, transaction_id, institution_id, client_callback_url, payload);
    }

    async queueFailureCallback(client, callback, reason) {
        const { transaction_id, institution_id, client_callback_url } = callback;

        if (!client_callback_url) return;

        const payload = {
            status: 'FAILED',
            transactionId: transaction_id,
            referenceNumber: callback.reference_number,
            sessionId: callback.session_id,
            actionCode: callback.action_code,
            reason: reason,
            message: `Transaction failed: ${reason}`
        };

        await queueClientCallback(client, transaction_id, institution_id, client_callback_url, payload);
    }

    async createCriticalAlert(client, transactionId, alertType, details) {
        await client.query(`
            INSERT INTO audit_log (entity_type, entity_id, action, details, triggered_by)
            VALUES ('transaction', $1, $2, $3, 'system_alert')
        `, [transactionId, `CRITICAL_${alertType}`, JSON.stringify({ details, timestamp: new Date() })]);

        // TODO: Implement email/SMS alert here
        this.logger.error(`CRITICAL ALERT: ${alertType} for transaction ${transactionId}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CallbackProcessor;
