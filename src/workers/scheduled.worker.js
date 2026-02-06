/**
 * Scheduled Transfer Worker
 * Processes scheduled transfers that are due
 */

const { query } = require('../models/db');
const config = require('../config');
const TransactionService = require('../services/transaction.service');

const POLL_INTERVAL = 60000; // 1 minute

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get due scheduled transfers
 */
const getDueTransfers = async () => {
    const result = await query(
        `UPDATE scheduled_transfers
         SET status = 'PROCESSING'
         WHERE id IN (
             SELECT id FROM scheduled_transfers
             WHERE status = 'PENDING'
             AND scheduled_at <= NOW()
             ORDER BY scheduled_at
             LIMIT 10
             FOR UPDATE SKIP LOCKED
         )
         RETURNING *`
    );
    return result.rows;
};

/**
 * Process a single scheduled transfer
 */
const processTransfer = async (transfer) => {
    logger.info(`Processing scheduled transfer: ${transfer.id}`);

    try {
        const payload = typeof transfer.payload === 'string'
            ? JSON.parse(transfer.payload)
            : transfer.payload;

        // Execute the transfer
        const result = await TransactionService.fundsTransfer(
            transfer.institution_id,
            payload
        );

        // Update status
        await query(
            `UPDATE scheduled_transfers
             SET status = 'COMPLETED',
                 transaction_id = $2,
                 executed_at = NOW()
             WHERE id = $1`,
            [transfer.id, result.transactionId]
        );

        logger.info(`Scheduled transfer completed: ${transfer.id} -> ${result.transactionId}`);
    } catch (error) {
        logger.error(`Scheduled transfer failed: ${transfer.id}`, error);

        await query(
            `UPDATE scheduled_transfers
             SET status = 'FAILED',
                 error_message = $2
             WHERE id = $1`,
            [transfer.id, error.message]
        );
    }
};

/**
 * Process all due transfers
 */
const processDueTransfers = async () => {
    const transfers = await getDueTransfers();

    for (const transfer of transfers) {
        await processTransfer(transfer);
    }

    return transfers.length;
};

const start = async (customLogger) => {
    if (!config.features.scheduledTransfers) {
        console.log('Scheduled transfers feature is disabled');
        return;
    }

    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Scheduled Transfer Worker started');

    while (isRunning) {
        try {
            const processed = await processDueTransfers();
            if (processed > 0) {
                logger.info(`Processed ${processed} scheduled transfers`);
            }
        } catch (error) {
            logger.error('Scheduled Transfer Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Scheduled Transfer Worker stopped');
};

const getStatus = () => ({ isRunning, feature: 'scheduledTransfers' });

module.exports = {
    start,
    stop,
    getStatus,
    processTransfer,
    processDueTransfers
};
