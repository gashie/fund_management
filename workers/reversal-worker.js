/**
 * Reversal Worker
 * Handles FTD reversal when FTC fails
 *
 * CRITICAL: This worker ensures funds are returned when FTC fails
 * After successful FTD but failed FTC, we must reverse the debit
 */

const { Pool } = require('pg');
const axios = require('axios');
const {
    updateTransactionStatus,
    logGipEvent,
    scheduleTsqCheck,
    queueClientCallback
} = require('../middleware/transaction');
const { gipFtdUrl, CHANNEL_CODE, FTD_CODE } = require('../config/config');
const { convertTimestampToCustomFormat } = require('../helper/func');

class ReversalWorker {
    constructor(pool, logger) {
        this.pool = pool;
        this.logger = logger || console;
        this.isRunning = false;
        this.pollInterval = 5000;  // 5 seconds
        this.maxAttempts = 3;
    }

    async start() {
        this.isRunning = true;
        this.logger.info('Reversal Worker started');

        while (this.isRunning) {
            try {
                await this.processPendingReversals();
            } catch (error) {
                this.logger.error('Error in Reversal worker:', error);
            }
            await this.sleep(this.pollInterval);
        }
    }

    stop() {
        this.isRunning = false;
        this.logger.info('Reversal Worker stopped');
    }

    async processPendingReversals() {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Fetch transactions needing reversal
            const result = await client.query(`
                SELECT
                    t.*,
                    i.webhook_url as institution_webhook
                FROM transactions t
                JOIN institutions i ON t.institution_id = i.id
                WHERE t.reversal_required = true
                  AND t.status = 'REVERSAL_PENDING'
                  AND t.reversal_attempts < $1
                ORDER BY t.updated_at ASC
                LIMIT 5
                FOR UPDATE OF t SKIP LOCKED
            `, [this.maxAttempts]);

            for (const transaction of result.rows) {
                await this.processReversal(client, transaction);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async processReversal(client, transaction) {
        const {
            id: transactionId,
            session_id: originalSessionId,
            tracking_number: originalTrackingNumber,
            src_bank_code: srcBankCode,
            dest_bank_code: destBankCode,
            src_account_number: srcAccountNumber,
            dest_account_number: destAccountNumber,
            src_account_name: srcAccountName,
            dest_account_name: destAccountName,
            amount_formatted: amount,
            narration,
            reversal_attempts: attempts
        } = transaction;

        this.logger.info(`Processing reversal for transaction ${transactionId} - Attempt ${attempts + 1}`);

        try {
            // Generate new session/tracking for reversal
            const idsResult = await client.query('SELECT * FROM generate_transaction_ids()');
            const reversalSessionId = idsResult.rows[0].session_id;
            const reversalTrackingNumber = idsResult.rows[0].tracking_number;

            // Build reversal payload
            // For reversal, we SWAP source and destination to credit back the original debited account
            const reversalPayload = {
                dateTime: convertTimestampToCustomFormat(),
                sessionId: reversalSessionId,
                trackingNumber: reversalTrackingNumber,
                functionCode: FTD_CODE,  // 241 - Same as FTD but with swapped accounts
                channelCode: CHANNEL_CODE,
                // SWAP: Credit back to original source (which was debited)
                originBank: destBankCode,
                destBank: srcBankCode,
                accountToCredit: destAccountNumber,  // Was accountToDebit in original
                accountToDebit: srcAccountNumber,    // Was accountToCredit in original
                nameToCredit: destAccountName,
                nameToDebit: srcAccountName,
                amount: amount,
                narration: `REVERSAL: ${narration || 'FTC Failed'}`
            };

            // Log the reversal request
            await logGipEvent(
                client,
                transactionId,
                'REVERSAL_REQUEST',
                5,
                reversalSessionId,
                reversalTrackingNumber,
                '241',
                reversalPayload,
                null,
                null,
                'PENDING'
            );

            // Update transaction with reversal IDs
            await client.query(`
                UPDATE transactions
                SET reversal_session_id = $2,
                    reversal_tracking_number = $3,
                    reversal_attempts = reversal_attempts + 1
                WHERE id = $1
            `, [transactionId, reversalSessionId, reversalTrackingNumber]);

            // Make reversal request to GIP
            const response = await this.makeReversalRequest(reversalPayload);

            this.logger.info(`Reversal response for ${transactionId}:`, response);

            // Log the response
            await logGipEvent(
                client,
                transactionId,
                'REVERSAL_REQUEST',
                5,
                reversalSessionId,
                reversalTrackingNumber,
                '241',
                reversalPayload,
                response,
                response?.actionCode,
                response?.actionCode === '000' ? 'SUCCESS' : 'PENDING'
            );

            // If response indicates processing, we wait for callback
            // The callback will be handled by callback-processor.js
            if (response?.actionCode === '000' || response?.actionCode === '001') {
                // Reversal accepted - waiting for callback
                this.logger.info(`Reversal accepted for ${transactionId} - waiting for callback`);
            } else if (['909', '912', '990', null, undefined].includes(response?.actionCode)) {
                // Inconclusive - schedule TSQ
                await scheduleTsqCheck(client, transactionId, 'REVERSAL', reversalSessionId, reversalTrackingNumber, 5);
            } else {
                // Reversal rejected - this is CRITICAL
                this.logger.error(`Reversal rejected for ${transactionId}: ${response?.actionCode}`);

                if (attempts + 1 >= this.maxAttempts) {
                    await this.handleReversalMaxAttempts(client, transaction);
                }
            }

        } catch (error) {
            this.logger.error(`Reversal request failed for ${transactionId}:`, error);

            // Update attempt count
            await client.query(`
                UPDATE transactions
                SET reversal_attempts = reversal_attempts + 1
                WHERE id = $1
            `, [transactionId]);

            if (attempts + 1 >= this.maxAttempts) {
                await this.handleReversalMaxAttempts(client, transaction);
            }
        }
    }

    async makeReversalRequest(payload) {
        try {
            const response = await axios.post(gipFtdUrl, payload, {
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

    async handleReversalMaxAttempts(client, transaction) {
        const { id: transactionId, institution_id, client_callback_url } = transaction;

        this.logger.error(`CRITICAL: Reversal max attempts reached for transaction ${transactionId}`);

        await updateTransactionStatus(client, transactionId, 'REVERSAL_FAILED', {
            status_message: 'CRITICAL: Reversal failed after max attempts - MANUAL INTERVENTION REQUIRED'
        }, 'reversal_worker');

        // Create critical alert
        await client.query(`
            INSERT INTO audit_log (entity_type, entity_id, action, details, triggered_by)
            VALUES ('transaction', $1, 'CRITICAL_REVERSAL_MAX_ATTEMPTS', $2, 'reversal_worker')
        `, [transactionId, JSON.stringify({
            timestamp: new Date(),
            message: 'Reversal failed after maximum attempts - funds may be stuck'
        })]);

        // Queue failure callback to client
        if (client_callback_url) {
            const payload = {
                status: 'FAILED',
                transactionId,
                message: 'Transaction failed - reversal unsuccessful. Please contact support.',
                requiresManualIntervention: true
            };

            await queueClientCallback(client, transactionId, institution_id, client_callback_url, payload);
        }

        // TODO: Send email/SMS alert to operations team
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ReversalWorker;
