/**
 * Timeout Worker
 * Monitors transactions that have exceeded their timeout period
 * and takes appropriate action (fail, TSQ, or escalate)
 */

const { Pool } = require('pg');
const {
    updateTransactionStatus,
    scheduleTsqCheck,
    scheduleReversal,
    queueClientCallback
} = require('../middleware/transaction');

class TimeoutWorker {
    constructor(pool, logger) {
        this.pool = pool;
        this.logger = logger || console;
        this.isRunning = false;
        this.pollInterval = 60000;  // 1 minute
    }

    async start() {
        this.isRunning = true;
        this.logger.info('Timeout Worker started');

        while (this.isRunning) {
            try {
                await this.processTimeouts();
            } catch (error) {
                this.logger.error('Error in Timeout worker:', error);
            }
            await this.sleep(this.pollInterval);
        }
    }

    stop() {
        this.isRunning = false;
        this.logger.info('Timeout Worker stopped');
    }

    async processTimeouts() {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Find transactions that have timed out
            const result = await client.query(`
                SELECT
                    t.*,
                    i.webhook_url
                FROM transactions t
                JOIN institutions i ON t.institution_id = i.id
                WHERE t.timeout_at < CURRENT_TIMESTAMP
                  AND t.status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT', 'REVERSAL_PENDING', 'REVERSAL_SUCCESS', 'REVERSAL_FAILED')
                ORDER BY t.timeout_at ASC
                LIMIT 10
                FOR UPDATE OF t SKIP LOCKED
            `);

            for (const transaction of result.rows) {
                await this.handleTimeout(client, transaction);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async handleTimeout(client, transaction) {
        const {
            id: transactionId,
            status,
            session_id: sessionId,
            tracking_number: trackingNumber,
            institution_id: institutionId,
            client_callback_url: callbackUrl
        } = transaction;

        this.logger.warn(`Transaction ${transactionId} timed out in status: ${status}`);

        switch (status) {
            case 'INITIATED':
            case 'NEC_PENDING':
                // Simple timeout - just fail it
                await this.failTransaction(client, transaction, 'Transaction timed out during initialization');
                break;

            case 'FTD_PENDING':
            case 'FTD_TSQ':
                // FTD timeout - try TSQ first, then fail
                if (status === 'FTD_PENDING') {
                    // Try TSQ to check status
                    await scheduleTsqCheck(client, transactionId, 'FTD', sessionId, trackingNumber, 0);
                    await updateTransactionStatus(client, transactionId, 'FTD_TSQ', {
                        status_message: 'FTD timeout - running TSQ verification'
                    }, 'timeout_worker');
                } else {
                    // Already in TSQ state but still timed out - fail it
                    await this.failTransaction(client, transaction, 'FTD verification timed out');
                }
                break;

            case 'FTC_PENDING':
            case 'FTC_TSQ':
                // FTC timeout - THIS IS CRITICAL - may need reversal
                if (status === 'FTC_PENDING') {
                    // Try TSQ first
                    await scheduleTsqCheck(client, transactionId, 'FTC', sessionId, trackingNumber, 0);
                    await updateTransactionStatus(client, transactionId, 'FTC_TSQ', {
                        status_message: 'FTC timeout - running TSQ verification'
                    }, 'timeout_worker');
                } else {
                    // FTC TSQ also timed out - initiate reversal for safety
                    this.logger.error(`FTC verification timed out for ${transactionId} - initiating reversal`);

                    await updateTransactionStatus(client, transactionId, 'FTC_FAILED', {
                        status_message: 'FTC verification timed out - initiating reversal'
                    }, 'timeout_worker');

                    await scheduleReversal(client, transactionId);
                }
                break;

            default:
                // Unknown state - log and create alert
                this.logger.error(`Unknown timeout state: ${status} for transaction ${transactionId}`);
                await this.createAlert(client, transactionId, `Unknown timeout state: ${status}`);
        }
    }

    async failTransaction(client, transaction, message) {
        const {
            id: transactionId,
            institution_id: institutionId,
            client_callback_url: callbackUrl
        } = transaction;

        await updateTransactionStatus(client, transactionId, 'TIMEOUT', {
            status_message: message
        }, 'timeout_worker');

        // Send failure callback
        if (callbackUrl) {
            const payload = {
                status: 'TIMEOUT',
                transactionId,
                message,
                timestamp: new Date().toISOString()
            };

            await queueClientCallback(client, transactionId, institutionId, callbackUrl, payload);
        }
    }

    async createAlert(client, transactionId, message) {
        await client.query(`
            INSERT INTO audit_log (entity_type, entity_id, action, details, triggered_by)
            VALUES ('transaction', $1, 'TIMEOUT_ALERT', $2, 'timeout_worker')
        `, [transactionId, JSON.stringify({ message, timestamp: new Date() })]);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TimeoutWorker;
