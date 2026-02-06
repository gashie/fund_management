/**
 * Request Queue Worker
 * Processes queued requests
 */

const { query } = require('../models/db');
const config = require('../config');
const TransactionService = require('../services/transaction.service');
const { ResilienceService } = require('../services/features');

const POLL_INTERVAL = 2000; // 2 seconds

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process a single queued request
 */
const processRequest = async (request) => {
    logger.info(`Processing queued request: ${request.id} (${request.request_type})`);

    try {
        const payload = typeof request.payload === 'string'
            ? JSON.parse(request.payload)
            : request.payload;

        let result;

        switch (request.request_type) {
            case 'FT':
                result = await TransactionService.fundsTransfer(
                    request.institution_id,
                    payload
                );
                break;

            case 'NEC':
                result = await TransactionService.nameEnquiry(
                    request.institution_id,
                    payload
                );
                break;

            case 'TSQ':
                result = await TransactionService.transactionStatusQuery(
                    request.institution_id,
                    payload
                );
                break;

            default:
                throw new Error(`Unknown request type: ${request.request_type}`);
        }

        // Mark as completed
        await ResilienceService.completeQueuedRequest(request.id, result);

        logger.info(`Queued request completed: ${request.id}`);
        return { success: true, result };
    } catch (error) {
        logger.error(`Queued request failed: ${request.id}`, error);

        // Mark as failed (will retry if attempts < max)
        await ResilienceService.failQueuedRequest(request.id, error.message, true);

        return { success: false, error: error.message };
    }
};

/**
 * Process pending requests from queue
 */
const processPendingRequests = async () => {
    const requests = await ResilienceService.getNextQueuedRequests(10);

    let processed = 0;

    for (const request of requests) {
        await processRequest(request);
        processed++;

        // Small delay between requests
        await sleep(100);
    }

    return processed;
};

const start = async (customLogger) => {
    if (!config.features.requestQueuing) {
        console.log('Request queuing feature is disabled');
        return;
    }

    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Request Queue Worker started');

    while (isRunning) {
        try {
            const processed = await processPendingRequests();
            if (processed > 0) {
                logger.info(`Processed ${processed} queued requests`);
            }
        } catch (error) {
            logger.error('Request Queue Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Request Queue Worker stopped');
};

const getStatus = () => ({ isRunning, feature: 'requestQueuing' });

module.exports = {
    start,
    stop,
    getStatus,
    processRequest,
    processPendingRequests
};
