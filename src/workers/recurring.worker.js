/**
 * Recurring Payment Worker
 * Processes recurring payments that are due
 */

const { query } = require('../models/db');
const config = require('../config');
const TransactionService = require('../services/transaction.service');
const { OperationalService } = require('../services/features');

const POLL_INTERVAL = 60000; // 1 minute

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get due recurring payments
 */
const getDuePayments = async () => {
    const result = await query(
        `SELECT * FROM recurring_payments
         WHERE status = 'ACTIVE'
         AND next_execution_at <= NOW()
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND (max_occurrences IS NULL OR total_occurrences < max_occurrences)
         ORDER BY next_execution_at
         LIMIT 10`
    );
    return result.rows;
};

/**
 * Process a single recurring payment
 */
const processPayment = async (payment) => {
    logger.info(`Processing recurring payment: ${payment.id}`);

    // Create execution record
    const executionResult = await query(
        `INSERT INTO recurring_executions
         (recurring_payment_id, occurrence_number, scheduled_at, status)
         VALUES ($1, $2, $3, 'PROCESSING')
         RETURNING id`,
        [payment.id, (payment.total_occurrences || 0) + 1, payment.next_execution_at]
    );
    const executionId = executionResult.rows[0].id;

    try {
        const payload = typeof payment.payload === 'string'
            ? JSON.parse(payment.payload)
            : payment.payload;

        // Execute the transfer
        const result = await TransactionService.fundsTransfer(
            payment.institution_id,
            payload
        );

        // Update execution record
        await query(
            `UPDATE recurring_executions
             SET status = 'SUCCESS',
                 transaction_id = $2,
                 executed_at = NOW()
             WHERE id = $1`,
            [executionId, result.transactionId]
        );

        // Calculate next execution date
        const nextExecution = calculateNextExecution(
            payment.frequency,
            payment.next_execution_at
        );

        // Update recurring payment
        await query(
            `UPDATE recurring_payments
             SET total_occurrences = total_occurrences + 1,
                 total_successful = total_successful + 1,
                 last_execution_at = NOW(),
                 next_execution_at = $2
             WHERE id = $1`,
            [payment.id, nextExecution]
        );

        logger.info(`Recurring payment executed: ${payment.id} -> ${result.transactionId}`);
    } catch (error) {
        logger.error(`Recurring payment failed: ${payment.id}`, error);

        // Update execution record
        await query(
            `UPDATE recurring_executions
             SET status = 'FAILED',
                 error_message = $2,
                 executed_at = NOW()
             WHERE id = $1`,
            [executionId, error.message]
        );

        // Increment failure count
        const failureResult = await query(
            `UPDATE recurring_payments
             SET total_failed = total_failed + 1,
                 total_occurrences = total_occurrences + 1
             WHERE id = $1
             RETURNING total_failed`,
            [payment.id]
        );

        // Pause if too many consecutive failures
        if (failureResult.rows[0].total_failed >= 3) {
            await query(
                `UPDATE recurring_payments
                 SET status = 'PAUSED'
                 WHERE id = $1`,
                [payment.id]
            );
            logger.warn(`Recurring payment paused due to failures: ${payment.id}`);
        }
    }
};

/**
 * Calculate next execution date based on frequency
 */
const calculateNextExecution = (frequency, currentDate) => {
    const date = new Date(currentDate);

    switch (frequency) {
        case 'DAILY':
            date.setDate(date.getDate() + 1);
            break;
        case 'WEEKLY':
            date.setDate(date.getDate() + 7);
            break;
        case 'BIWEEKLY':
            date.setDate(date.getDate() + 14);
            break;
        case 'MONTHLY':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'QUARTERLY':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'YEARLY':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            date.setMonth(date.getMonth() + 1);
    }

    return date;
};

/**
 * Process all due payments
 */
const processDuePayments = async () => {
    const payments = await getDuePayments();

    for (const payment of payments) {
        await processPayment(payment);
    }

    return payments.length;
};

const start = async (customLogger) => {
    if (!config.features.recurringPayments) {
        console.log('Recurring payments feature is disabled');
        return;
    }

    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Recurring Payment Worker started');

    while (isRunning) {
        try {
            const processed = await processDuePayments();
            if (processed > 0) {
                logger.info(`Processed ${processed} recurring payments`);
            }
        } catch (error) {
            logger.error('Recurring Payment Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Recurring Payment Worker stopped');
};

const getStatus = () => ({ isRunning, feature: 'recurringPayments' });

module.exports = {
    start,
    stop,
    getStatus,
    processPayment,
    processDuePayments
};
