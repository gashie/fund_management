/**
 * FTC (Funds Transfer Credit) Worker
 * Initiates FTC after successful FTD
 *
 * Flow: FTD Success → FTC Request → Wait for Callback
 */

const { Pool } = require('pg');
const axios = require('axios');
const {
    updateTransactionStatus,
    logGipEvent,
    scheduleTsqCheck
} = require('../middleware/transaction');
const { gipFtcUrl, CHANNEL_CODE, FTC_CODE } = require('../config/config');
const { convertTimestampToCustomFormat } = require('../helper/func');

class FtcWorker {
    constructor(pool, logger) {
        this.pool = pool;
        this.logger = logger || console;
        this.isRunning = false;
        this.pollInterval = 3000;  // 3 seconds
    }

    async start() {
        this.isRunning = true;
        this.logger.info('FTC Worker started');

        while (this.isRunning) {
            try {
                await this.processFtdSuccess();
            } catch (error) {
                this.logger.error('Error in FTC worker:', error);
            }
            await this.sleep(this.pollInterval);
        }
    }

    stop() {
        this.isRunning = false;
        this.logger.info('FTC Worker stopped');
    }

    async processFtdSuccess() {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Fetch transactions with successful FTD that need FTC
            const result = await client.query(`
                SELECT
                    t.*
                FROM transactions t
                WHERE t.status = 'FTD_SUCCESS'
                ORDER BY t.updated_at ASC
                LIMIT 5
                FOR UPDATE OF t SKIP LOCKED
            `);

            for (const transaction of result.rows) {
                await this.initiateFtc(client, transaction);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async initiateFtc(client, transaction) {
        const {
            id: transactionId,
            session_id: sessionId,
            tracking_number: trackingNumber,
            src_bank_code: srcBankCode,
            dest_bank_code: destBankCode,
            src_account_number: srcAccountNumber,
            dest_account_number: destAccountNumber,
            src_account_name: srcAccountName,
            dest_account_name: destAccountName,
            amount_formatted: amount,
            narration
        } = transaction;

        this.logger.info(`Initiating FTC for transaction ${transactionId}`);

        try {
            // Generate new session/tracking for FTC
            const idsResult = await client.query('SELECT * FROM generate_transaction_ids()');
            const ftcSessionId = idsResult.rows[0].session_id;
            const ftcTrackingNumber = idsResult.rows[0].tracking_number;

            // Build FTC payload
            const ftcPayload = {
                dateTime: convertTimestampToCustomFormat(),
                sessionId: ftcSessionId,
                trackingNumber: ftcTrackingNumber,
                functionCode: FTC_CODE,  // 240
                channelCode: CHANNEL_CODE,
                originBank: srcBankCode,
                destBank: destBankCode,
                accountToCredit: srcAccountNumber,
                accountToDebit: destAccountNumber,
                nameToCredit: srcAccountName,
                nameToDebit: destAccountName,
                amount: amount,
                narration: narration
            };

            // Log FTC request
            await logGipEvent(
                client,
                transactionId,
                'FTC_REQUEST',
                3,  // FTC is event #3
                ftcSessionId,
                ftcTrackingNumber,
                FTC_CODE,
                ftcPayload,
                null,
                null,
                'PENDING'
            );

            // Update transaction status to FTC_PENDING
            await updateTransactionStatus(client, transactionId, 'FTC_PENDING', {
                status_message: 'FTC request sent, waiting for callback'
            }, 'ftc_worker');

            // Make FTC request to GIP
            const response = await this.makeFtcRequest(ftcPayload);

            this.logger.info(`FTC response for ${transactionId}:`, response);

            // Update event with response
            await client.query(`
                UPDATE gip_events
                SET response_payload = $2,
                    action_code = $3,
                    response_received_at = CURRENT_TIMESTAMP,
                    status = $4
                WHERE transaction_id = $1 AND event_type = 'FTC_REQUEST'
                ORDER BY created_at DESC LIMIT 1
            `, [
                transactionId,
                JSON.stringify(response),
                response?.actionCode,
                response?.actionCode === '000' ? 'SUCCESS' : 'PENDING'
            ]);

            // Handle immediate response
            if (response?.actionCode && !['000', '001', '909', '912', '990'].includes(response.actionCode)) {
                // Immediate rejection - FTC failed
                this.logger.error(`FTC immediately rejected for ${transactionId}: ${response.actionCode}`);

                await updateTransactionStatus(client, transactionId, 'FTC_FAILED', {
                    ftc_action_code: response.actionCode,
                    status_message: `FTC failed: ${response?.actionCode}`
                }, 'ftc_worker');

                // Schedule reversal
                const { scheduleReversal } = require('../middleware/transaction');
                await scheduleReversal(client, transactionId);
            }
            // Otherwise, we wait for callback (normal flow)

        } catch (error) {
            this.logger.error(`FTC request failed for ${transactionId}:`, error);

            // Keep in FTD_SUCCESS state to retry
            await client.query(`
                UPDATE transactions
                SET status_message = $2
                WHERE id = $1
            `, [transactionId, `FTC request error: ${error.message}`]);
        }
    }

    async makeFtcRequest(payload) {
        try {
            const response = await axios.post(gipFtcUrl, payload, {
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

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = FtcWorker;
