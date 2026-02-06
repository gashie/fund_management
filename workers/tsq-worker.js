/**
 * TSQ (Transaction Status Query) Worker
 * Implements the TSQ rules as specified by GhIPSS
 *
 * TSQ RULES:
 * 1. actionCode=000, statusCode=000 → Transaction successful
 * 2. actionCode=381, statusCode=null → Mismatched values - retry with correct values
 * 3. actionCode=381, statusCode=null → Previous day transaction - check settlement/manual
 * 4. actionCode=999, statusCode=null → Field validation error - fix and retry
 * 5. actionCode=000, statusCode=990 → Being processed - retry at 5 min intervals
 * 6. actionCode=000, statusCode=381 → Found at GhIPSS but not receiver - FAIL
 * 7. actionCode=990, statusCode=null → Exception - retry at 5 min intervals
 */

const { Pool } = require('pg');
const axios = require('axios');
const {
    determineTsqAction,
    updateTransactionStatus,
    scheduleReversal,
    queueClientCallback,
    logGipEvent,
    TSQ_RULES
} = require('../middleware/transaction');
const { gipTsqUrl, CHANNEL_CODE } = require('../config/config');
const { convertTimestampToCustomFormat } = require('../helper/func');

class TsqWorker {
    constructor(pool, logger) {
        this.pool = pool;
        this.logger = logger || console;
        this.isRunning = false;
        this.pollInterval = 10000;  // 10 seconds
        this.maxAttempts = 3;
        this.retryIntervalMinutes = 5;
    }

    async start() {
        this.isRunning = true;
        this.logger.info('TSQ Worker started');

        // Initial delay before starting
        await this.sleep(60000);  // 1 minute delay

        while (this.isRunning) {
            try {
                await this.processPendingTsq();
            } catch (error) {
                this.logger.error('Error in TSQ worker:', error);
            }
            await this.sleep(this.pollInterval);
        }
    }

    stop() {
        this.isRunning = false;
        this.logger.info('TSQ Worker stopped');
    }

    async processPendingTsq() {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Fetch pending TSQ items that are due
            const result = await client.query(`
                SELECT
                    q.*,
                    t.src_bank_code,
                    t.dest_bank_code,
                    t.src_account_number,
                    t.dest_account_number,
                    t.src_account_name,
                    t.dest_account_name,
                    t.amount_formatted,
                    t.narration,
                    t.status as transaction_status,
                    t.institution_id,
                    t.client_callback_url
                FROM tsq_queue q
                JOIN transactions t ON q.transaction_id = t.id
                WHERE q.status = 'PENDING'
                  AND q.scheduled_for <= CURRENT_TIMESTAMP
                  AND q.attempts < q.max_attempts
                ORDER BY q.scheduled_for ASC
                LIMIT 5
                FOR UPDATE OF q SKIP LOCKED
            `);

            for (const tsqItem of result.rows) {
                await this.processTsqItem(client, tsqItem);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async processTsqItem(client, tsqItem) {
        const {
            id: tsqId,
            transaction_id: transactionId,
            tsq_type: tsqType,
            target_session_id: sessionId,
            target_tracking_number: trackingNumber,
            attempts
        } = tsqItem;

        this.logger.info(`Processing TSQ ${tsqId} - Type: ${tsqType}, Attempt: ${attempts + 1}`);

        try {
            // Build TSQ request payload
            const tsqPayload = this.buildTsqPayload(tsqItem);

            // Make TSQ request to GIP
            const response = await this.makeTsqRequest(tsqPayload);

            // Log the TSQ event
            const eventType = `${tsqType}_TSQ_RESPONSE`;
            await logGipEvent(
                client,
                transactionId,
                eventType,
                attempts + 10,  // TSQ events use higher sequence numbers
                sessionId,
                trackingNumber,
                '230',  // TSQ function code
                tsqPayload,
                response,
                response?.actionCode,
                response?.actionCode === '000' ? 'SUCCESS' : 'RECEIVED'
            );

            // Determine action based on response
            const actionCode = response?.actionCode;
            const statusCode = response?.statusCode || response?.statusQuery;
            const tsqAction = determineTsqAction(actionCode, statusCode);

            this.logger.info(`TSQ Response - Action: ${actionCode}, Status: ${statusCode}, Decision: ${tsqAction.action}`);

            // Update attempt count
            await client.query(`
                UPDATE tsq_queue
                SET attempts = attempts + 1,
                    last_attempt_at = CURRENT_TIMESTAMP,
                    last_action_code = $2,
                    last_status_code = $3
                WHERE id = $1
            `, [tsqId, actionCode, statusCode]);

            // Handle based on TSQ action
            await this.handleTsqResult(client, tsqItem, tsqAction, response);

        } catch (error) {
            this.logger.error(`TSQ request failed for ${tsqId}:`, error);

            // Update attempt count and reschedule
            await client.query(`
                UPDATE tsq_queue
                SET attempts = attempts + 1,
                    last_attempt_at = CURRENT_TIMESTAMP,
                    scheduled_for = CURRENT_TIMESTAMP + INTERVAL '${this.retryIntervalMinutes} minutes'
                WHERE id = $1
            `, [tsqId]);

            // Check if max attempts reached
            if (attempts + 1 >= this.maxAttempts) {
                await this.handleMaxAttemptsReached(client, tsqItem);
            }
        }
    }

    buildTsqPayload(tsqItem) {
        const dateTime = convertTimestampToCustomFormat();

        return {
            dateTime: dateTime,
            sessionId: tsqItem.target_session_id,
            trackingNumber: tsqItem.target_tracking_number,
            functionCode: '230',  // TSQ function code
            channelCode: CHANNEL_CODE,
            originBank: tsqItem.src_bank_code,
            destBank: tsqItem.dest_bank_code,
            accountToCredit: tsqItem.src_account_number,
            accountToDebit: tsqItem.dest_account_number,
            nameToCredit: tsqItem.src_account_name,
            nameToDebit: tsqItem.dest_account_name,
            amount: tsqItem.amount_formatted,
            narration: tsqItem.narration
        };
    }

    async makeTsqRequest(payload) {
        try {
            const response = await axios.post(gipTsqUrl, payload, {
                timeout: 30000,  // 30 second timeout
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

    async handleTsqResult(client, tsqItem, tsqAction, response) {
        const {
            id: tsqId,
            transaction_id: transactionId,
            tsq_type: tsqType,
            attempts
        } = tsqItem;

        switch (tsqAction.action) {
            case 'SUCCESS':
                // Transaction found and successful
                await this.handleTsqSuccess(client, tsqItem);
                break;

            case 'FAIL':
                // Transaction should be failed (Scenario 6)
                await this.handleTsqFail(client, tsqItem);
                break;

            case 'RETRY_LATER':
                // Still processing - schedule retry (Scenarios 5, 7)
                if (attempts + 1 < this.maxAttempts) {
                    await this.scheduleRetry(client, tsqId, this.retryIntervalMinutes);
                } else {
                    await this.handleMaxAttemptsReached(client, tsqItem);
                }
                break;

            case 'RETRY':
            case 'FIX_REQUEST':
                // Mismatched values or validation error (Scenarios 2, 4)
                // These typically indicate a configuration issue - fail the TSQ
                this.logger.warn(`TSQ requires manual fix: ${tsqAction.message}`);
                await this.handleTsqFail(client, tsqItem, tsqAction.message);
                break;

            case 'MANUAL_CHECK':
                // Previous day transaction (Scenario 3) - needs manual check
                await this.handleManualCheck(client, tsqItem);
                break;

            default:
                // Unknown action
                this.logger.warn(`Unknown TSQ action: ${tsqAction.action}`);
                if (attempts + 1 < this.maxAttempts) {
                    await this.scheduleRetry(client, tsqId, this.retryIntervalMinutes);
                } else {
                    await this.handleMaxAttemptsReached(client, tsqItem);
                }
        }
    }

    async handleTsqSuccess(client, tsqItem) {
        const {
            id: tsqId,
            transaction_id: transactionId,
            tsq_type: tsqType
        } = tsqItem;

        this.logger.info(`TSQ Success for ${tsqType} - Transaction ${transactionId}`);

        // Mark TSQ as resolved
        await client.query(`
            UPDATE tsq_queue
            SET status = 'RESOLVED', resolution = 'SUCCESS'
            WHERE id = $1
        `, [tsqId]);

        if (tsqType === 'FTD') {
            // FTD TSQ success - proceed to FTC
            await updateTransactionStatus(client, transactionId, 'FTD_SUCCESS', {
                tsq_required: false
            }, 'tsq_worker');

        } else if (tsqType === 'FTC') {
            // FTC TSQ success - Transaction complete!
            await updateTransactionStatus(client, transactionId, 'FTC_SUCCESS', {
                tsq_required: false
            }, 'tsq_worker');

            await updateTransactionStatus(client, transactionId, 'COMPLETED', {
                status_message: 'Transaction completed (confirmed via TSQ)'
            }, 'tsq_worker');

            // Queue success callback
            await this.queueCallback(client, tsqItem, 'SUCCESS', 'Transaction completed successfully');

        } else if (tsqType === 'REVERSAL') {
            // Reversal TSQ success
            await updateTransactionStatus(client, transactionId, 'REVERSAL_SUCCESS', {
                tsq_required: false
            }, 'tsq_worker');

            await updateTransactionStatus(client, transactionId, 'FAILED', {
                status_message: 'Transaction failed - funds returned (confirmed via TSQ)'
            }, 'tsq_worker');

            await this.queueCallback(client, tsqItem, 'FAILED', 'Transaction failed - funds reversed');
        }
    }

    async handleTsqFail(client, tsqItem, message = null) {
        const {
            id: tsqId,
            transaction_id: transactionId,
            tsq_type: tsqType
        } = tsqItem;

        this.logger.info(`TSQ Fail for ${tsqType} - Transaction ${transactionId}`);

        await client.query(`
            UPDATE tsq_queue
            SET status = 'RESOLVED', resolution = 'FAILED'
            WHERE id = $1
        `, [tsqId]);

        if (tsqType === 'FTD') {
            // FTD failed via TSQ
            await updateTransactionStatus(client, transactionId, 'FTD_FAILED', {
                tsq_required: false,
                status_message: message || 'FTD failed (confirmed via TSQ)'
            }, 'tsq_worker');

            await this.queueCallback(client, tsqItem, 'FAILED', 'Transaction failed at debit stage');

        } else if (tsqType === 'FTC') {
            // FTC failed via TSQ - NEED TO REVERSE!
            this.logger.error(`FTC FAILED via TSQ - Transaction ${transactionId} - INITIATING REVERSAL`);

            await updateTransactionStatus(client, transactionId, 'FTC_FAILED', {
                tsq_required: false,
                status_message: message || 'FTC failed (confirmed via TSQ) - reversal required'
            }, 'tsq_worker');

            await scheduleReversal(client, transactionId);

        } else if (tsqType === 'REVERSAL') {
            // Reversal failed - CRITICAL!
            this.logger.error(`REVERSAL FAILED via TSQ - Transaction ${transactionId} - MANUAL INTERVENTION REQUIRED`);

            await updateTransactionStatus(client, transactionId, 'REVERSAL_FAILED', {
                tsq_required: false,
                status_message: 'CRITICAL: Reversal failed - manual intervention required'
            }, 'tsq_worker');

            await this.createCriticalAlert(client, transactionId, 'REVERSAL_TSQ_FAILED');
        }
    }

    async handleMaxAttemptsReached(client, tsqItem) {
        const {
            id: tsqId,
            transaction_id: transactionId,
            tsq_type: tsqType
        } = tsqItem;

        this.logger.warn(`TSQ Max attempts reached for ${tsqType} - Transaction ${transactionId}`);

        await client.query(`
            UPDATE tsq_queue
            SET status = 'MAX_ATTEMPTS', resolution = 'INCONCLUSIVE'
            WHERE id = $1
        `, [tsqId]);

        // For inconclusive TSQ after max attempts, fail the transaction
        // and request manual verification
        if (tsqType === 'FTD') {
            await updateTransactionStatus(client, transactionId, 'FTD_FAILED', {
                tsq_required: false,
                status_message: 'FTD status inconclusive after max TSQ attempts - manual verification required'
            }, 'tsq_worker');

            await this.queueCallback(client, tsqItem, 'FAILED', 'Transaction status inconclusive - please verify manually');

        } else if (tsqType === 'FTC') {
            // FTC inconclusive - safer to initiate reversal
            this.logger.warn(`FTC inconclusive after max TSQ - Transaction ${transactionId} - INITIATING REVERSAL`);

            await updateTransactionStatus(client, transactionId, 'FTC_FAILED', {
                tsq_required: false,
                status_message: 'FTC status inconclusive - initiating reversal for safety'
            }, 'tsq_worker');

            await scheduleReversal(client, transactionId);
        }

        await this.createCriticalAlert(client, transactionId, `${tsqType}_TSQ_INCONCLUSIVE`);
    }

    async handleManualCheck(client, tsqItem) {
        const { id: tsqId, transaction_id: transactionId, tsq_type: tsqType } = tsqItem;

        await client.query(`
            UPDATE tsq_queue
            SET status = 'RESOLVED', resolution = 'MANUAL_CHECK'
            WHERE id = $1
        `, [tsqId]);

        await this.createCriticalAlert(client, transactionId, `${tsqType}_MANUAL_CHECK_REQUIRED`);
    }

    async scheduleRetry(client, tsqId, delayMinutes) {
        await client.query(`
            UPDATE tsq_queue
            SET scheduled_for = CURRENT_TIMESTAMP + INTERVAL '${delayMinutes} minutes'
            WHERE id = $1
        `, [tsqId]);
    }

    async queueCallback(client, tsqItem, status, message) {
        const { transaction_id, institution_id, client_callback_url } = tsqItem;

        if (!client_callback_url) return;

        const payload = {
            status,
            transactionId: transaction_id,
            message,
            verifiedVia: 'TSQ'
        };

        await queueClientCallback(client, transaction_id, institution_id, client_callback_url, payload);
    }

    async createCriticalAlert(client, transactionId, alertType) {
        await client.query(`
            INSERT INTO audit_log (entity_type, entity_id, action, details, triggered_by)
            VALUES ('transaction', $1, $2, $3, 'tsq_worker')
        `, [transactionId, `CRITICAL_${alertType}`, JSON.stringify({ timestamp: new Date() })]);

        this.logger.error(`CRITICAL ALERT: ${alertType} for transaction ${transactionId}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TsqWorker;
