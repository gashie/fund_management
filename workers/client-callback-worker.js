/**
 * Client Callback Worker
 * Sends callbacks to institution webhook URLs with retry logic
 *
 * Features:
 * - Exponential backoff retry
 * - Webhook signature for verification
 * - Response tracking
 */

const { Pool } = require('pg');
const axios = require('axios');
const crypto = require('crypto');

class ClientCallbackWorker {
    constructor(pool, logger) {
        this.pool = pool;
        this.logger = logger || console;
        this.isRunning = false;
        this.pollInterval = 5000;  // 5 seconds
        this.baseDelay = 5;  // 5 seconds initial delay
        this.maxDelay = 3600;  // 1 hour max delay
        this.backoffMultiplier = 2;
    }

    async start() {
        this.isRunning = true;
        this.logger.info('Client Callback Worker started');

        while (this.isRunning) {
            try {
                await this.processPendingCallbacks();
            } catch (error) {
                this.logger.error('Error in Client Callback worker:', error);
            }
            await this.sleep(this.pollInterval);
        }
    }

    stop() {
        this.isRunning = false;
        this.logger.info('Client Callback Worker stopped');
    }

    async processPendingCallbacks() {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Fetch pending callbacks that are due
            const result = await client.query(`
                SELECT
                    c.*,
                    i.webhook_secret,
                    t.reference_number,
                    t.session_id
                FROM client_callbacks c
                JOIN transactions t ON c.transaction_id = t.id
                JOIN institutions i ON c.institution_id = i.id
                WHERE c.status IN ('PENDING', 'FAILED')
                  AND c.next_attempt_at <= CURRENT_TIMESTAMP
                  AND c.attempts < c.max_attempts
                ORDER BY c.next_attempt_at ASC
                LIMIT 10
                FOR UPDATE OF c SKIP LOCKED
            `);

            for (const callback of result.rows) {
                await this.sendCallback(client, callback);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async sendCallback(client, callback) {
        const {
            id: callbackId,
            transaction_id: transactionId,
            callback_url: callbackUrl,
            callback_payload: payload,
            webhook_secret: webhookSecret,
            attempts,
            reference_number: referenceNumber
        } = callback;

        this.logger.info(`Sending callback ${callbackId} to ${callbackUrl} - Attempt ${attempts + 1}`);

        try {
            // Generate webhook signature
            const timestamp = Date.now();
            const signature = this.generateSignature(payload, timestamp, webhookSecret);

            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature,
                'X-Webhook-Timestamp': timestamp.toString(),
                'X-Transaction-Reference': referenceNumber,
                'User-Agent': 'FundManagement-Webhook/1.0'
            };

            // Send callback
            const response = await axios.post(callbackUrl, payload, {
                headers,
                timeout: 30000,  // 30 seconds
                validateStatus: (status) => status < 500  // Don't throw on 4xx
            });

            const statusCode = response.status;

            // Update callback record
            if (statusCode >= 200 && statusCode < 300) {
                // Success!
                await client.query(`
                    UPDATE client_callbacks
                    SET status = 'DELIVERED',
                        attempts = attempts + 1,
                        last_attempt_at = CURRENT_TIMESTAMP,
                        response_status_code = $2,
                        response_body = $3,
                        response_received_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [callbackId, statusCode, JSON.stringify(response.data).substring(0, 1000)]);

                // Update transaction
                await client.query(`
                    UPDATE transactions
                    SET client_callback_sent = true,
                        client_callback_sent_at = CURRENT_TIMESTAMP,
                        client_callback_response = $2
                    WHERE id = $1
                `, [transactionId, JSON.stringify({ status: statusCode, body: response.data })]);

                this.logger.info(`Callback ${callbackId} delivered successfully`);

            } else {
                // Client error (4xx) - schedule retry
                await this.scheduleRetry(client, callbackId, attempts, statusCode, `HTTP ${statusCode}`);
            }

        } catch (error) {
            const errorMessage = error.response?.data || error.message;
            this.logger.error(`Callback ${callbackId} failed:`, errorMessage);

            await this.scheduleRetry(client, callbackId, attempts, null, errorMessage.toString().substring(0, 500));
        }
    }

    async scheduleRetry(client, callbackId, attempts, statusCode, errorMessage) {
        const nextAttempt = attempts + 1;

        if (nextAttempt >= 5) {  // Max attempts
            // Mark as failed permanently
            await client.query(`
                UPDATE client_callbacks
                SET status = 'FAILED',
                    attempts = $2,
                    last_attempt_at = CURRENT_TIMESTAMP,
                    response_status_code = $3,
                    last_error = $4
                WHERE id = $1
            `, [callbackId, nextAttempt, statusCode, errorMessage]);

            this.logger.warn(`Callback ${callbackId} permanently failed after ${nextAttempt} attempts`);

        } else {
            // Calculate next retry time with exponential backoff
            const delay = Math.min(
                this.baseDelay * Math.pow(this.backoffMultiplier, attempts),
                this.maxDelay
            );

            await client.query(`
                UPDATE client_callbacks
                SET status = 'FAILED',
                    attempts = $2,
                    last_attempt_at = CURRENT_TIMESTAMP,
                    next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '${delay} seconds',
                    response_status_code = $3,
                    last_error = $4
                WHERE id = $1
            `, [callbackId, nextAttempt, statusCode, errorMessage]);

            this.logger.info(`Callback ${callbackId} scheduled for retry in ${delay} seconds`);
        }
    }

    generateSignature(payload, timestamp, secret) {
        if (!secret) {
            return 'unsigned';
        }

        const data = `${timestamp}.${JSON.stringify(payload)}`;
        return crypto
            .createHmac('sha256', secret)
            .update(data)
            .digest('hex');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ClientCallbackWorker;
