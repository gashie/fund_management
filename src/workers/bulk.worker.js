/**
 * Bulk Batch Worker
 * Processes bulk transaction batches
 */

const { query } = require('../models/db');
const config = require('../config');
const TransactionService = require('../services/transaction.service');

const POLL_INTERVAL = 5000; // 5 seconds

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get pending batches to process
 */
const getPendingBatches = async () => {
    const result = await query(
        `UPDATE bulk_batches
         SET status = 'PROCESSING',
             started_at = NOW()
         WHERE id IN (
             SELECT id FROM bulk_batches
             WHERE status = 'PENDING'
             ORDER BY created_at
             LIMIT 1
             FOR UPDATE SKIP LOCKED
         )
         RETURNING *`
    );
    return result.rows;
};

/**
 * Get pending items in a batch
 */
const getPendingItems = async (batchId, limit = 10) => {
    const result = await query(
        `UPDATE bulk_batch_items
         SET status = 'PROCESSING'
         WHERE id IN (
             SELECT id FROM bulk_batch_items
             WHERE batch_id = $1
             AND status = 'PENDING'
             ORDER BY sequence_number
             LIMIT $2
             FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [batchId, limit]
    );
    return result.rows;
};

/**
 * Process a single batch item
 */
const processItem = async (item, institutionId) => {
    try {
        const payload = typeof item.payload === 'string'
            ? JSON.parse(item.payload)
            : item.payload;

        // Execute the transfer
        const result = await TransactionService.fundsTransfer(
            institutionId,
            payload
        );

        // Update item status
        await query(
            `UPDATE bulk_batch_items
             SET status = 'SUCCESS',
                 transaction_id = $2,
                 processed_at = NOW()
             WHERE id = $1`,
            [item.id, result.transactionId]
        );

        return { success: true, transactionId: result.transactionId };
    } catch (error) {
        // Update item status
        await query(
            `UPDATE bulk_batch_items
             SET status = 'FAILED',
                 error_message = $2,
                 processed_at = NOW()
             WHERE id = $1`,
            [item.id, error.message]
        );

        return { success: false, error: error.message };
    }
};

/**
 * Process a batch
 */
const processBatch = async (batch) => {
    logger.info(`Processing bulk batch: ${batch.id} (${batch.total_count} items)`);

    let hasMore = true;

    while (hasMore && isRunning) {
        const items = await getPendingItems(batch.id);

        if (items.length === 0) {
            hasMore = false;
            continue;
        }

        for (const item of items) {
            const result = await processItem(item, batch.institution_id);

            // Update batch counters
            if (result.success) {
                await query(
                    `UPDATE bulk_batches
                     SET successful_count = successful_count + 1,
                         pending_count = pending_count - 1
                     WHERE id = $1`,
                    [batch.id]
                );
            } else {
                await query(
                    `UPDATE bulk_batches
                     SET failed_count = failed_count + 1,
                         pending_count = pending_count - 1
                     WHERE id = $1`,
                    [batch.id]
                );
            }
        }

        // Small delay between item batches
        await sleep(100);
    }

    // Check final status
    const statusResult = await query(
        `SELECT successful_count, failed_count, pending_count, total_count
         FROM bulk_batches WHERE id = $1`,
        [batch.id]
    );

    const status = statusResult.rows[0];
    const processedCount = status.successful_count + status.failed_count;

    if (processedCount >= status.total_count || status.pending_count <= 0) {
        // Batch complete
        const finalStatus = status.failed_count === 0 ? 'COMPLETED' :
            status.failed_count === status.total_count ? 'FAILED' : 'PARTIAL';

        await query(
            `UPDATE bulk_batches
             SET status = $2,
                 completed_at = NOW()
             WHERE id = $1`,
            [batch.id, finalStatus]
        );

        logger.info(`Bulk batch completed: ${batch.id} - ${finalStatus}`);
    }
};

/**
 * Process pending batches
 */
const processPendingBatches = async () => {
    const batches = await getPendingBatches();

    for (const batch of batches) {
        await processBatch(batch);
    }

    return batches.length;
};

const start = async (customLogger) => {
    if (!config.features.bulkTransactions) {
        console.log('Bulk transactions feature is disabled');
        return;
    }

    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Bulk Batch Worker started');

    while (isRunning) {
        try {
            await processPendingBatches();
        } catch (error) {
            logger.error('Bulk Batch Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Bulk Batch Worker stopped');
};

const getStatus = () => ({ isRunning, feature: 'bulkTransactions' });

module.exports = {
    start,
    stop,
    getStatus,
    processItem,
    processBatch,
    processPendingBatches
};
