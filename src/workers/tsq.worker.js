/**
 * TSQ Worker
 * Transaction Status Query with GhIPSS rules - Functional style
 */

const TransactionModel = require('../models/transaction.model');
const TransactionService = require('../services/transaction.service');
const CallbackService = require('../services/callback.service');
const config = require('../config');

const POLL_INTERVAL = 10000;
const INITIAL_DELAY = 60000;

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const handleTsqSuccess = async (transaction, type) => {
    if (type === 'FTD') {
        await TransactionModel.updateStatus(transaction.id, 'FTD_SUCCESS', { tsq_required: false });
    } else if (type === 'FTC') {
        await TransactionModel.updateStatus(transaction.id, 'FTC_SUCCESS', { tsq_required: false });
        await TransactionModel.updateStatus(transaction.id, 'COMPLETED', {
            status_message: 'Transaction completed (confirmed via TSQ)'
        });
        await CallbackService.queueClientCallback(transaction, 'SUCCESS', 'Transaction completed');
    } else if (type === 'REVERSAL') {
        await TransactionModel.updateStatus(transaction.id, 'REVERSAL_SUCCESS', { tsq_required: false });
        await TransactionModel.updateStatus(transaction.id, 'FAILED', {
            status_message: 'Transaction failed - funds returned (confirmed via TSQ)'
        });
        await CallbackService.queueClientCallback(transaction, 'FAILED', 'Transaction failed - funds reversed');
    }
};

const handleTsqFail = async (transaction, type) => {
    if (type === 'FTD') {
        await TransactionModel.updateStatus(transaction.id, 'FTD_FAILED', { tsq_required: false });
        await TransactionModel.updateStatus(transaction.id, 'FAILED');
        await CallbackService.queueClientCallback(transaction, 'FAILED', 'FTD failed (confirmed via TSQ)');
    } else if (type === 'FTC') {
        // FTC failed - need reversal
        await TransactionModel.updateStatus(transaction.id, 'FTC_FAILED', { tsq_required: false });
        await TransactionModel.markForReversal(transaction.id);
    } else if (type === 'REVERSAL') {
        // CRITICAL
        await TransactionModel.updateStatus(transaction.id, 'REVERSAL_FAILED', {
            tsq_required: false,
            status_message: 'CRITICAL: Reversal failed via TSQ'
        });
    }
};

const handleTsqMaxAttempts = async (transaction) => {
    const type = transaction.status.includes('FTD') ? 'FTD' :
                 transaction.status.includes('FTC') ? 'FTC' : 'REVERSAL';

    logger.warn(`TSQ max attempts reached: ${transaction.id}`);

    if (type === 'FTC') {
        // Safer to reverse on inconclusive FTC
        await TransactionModel.updateStatus(transaction.id, 'FTC_FAILED', {
            tsq_required: false,
            status_message: 'FTC inconclusive - initiating reversal'
        });
        await TransactionModel.markForReversal(transaction.id);
    } else {
        await TransactionModel.updateStatus(transaction.id, 'FAILED', {
            tsq_required: false,
            status_message: 'Transaction failed - TSQ inconclusive after max attempts'
        });
        await CallbackService.queueClientCallback(transaction, 'FAILED', 'Transaction status inconclusive');
    }
};

const handleTsqRetry = async (transaction, retryMinutes) => {
    if (transaction.tsq_attempts >= config.tsq.maxAttempts) {
        await handleTsqMaxAttempts(transaction);
    } else {
        await TransactionModel.scheduleTsq(transaction.id, retryMinutes);
    }
};

const handleTsqManual = async (transaction) => {
    await TransactionModel.updateStatus(transaction.id, 'FAILED', {
        tsq_required: false,
        status_message: 'Manual verification required'
    });
};

const processTsq = async (transaction) => {
    const type = transaction.status.includes('FTD') ? 'FTD' :
                 transaction.status.includes('FTC') ? 'FTC' : 'REVERSAL';

    logger.info(`Processing TSQ for: ${transaction.id}, Type: ${type}`);

    try {
        const result = await TransactionService.processTsq(transaction, type);

        logger.info(`TSQ result: ${result.actionCode}/${result.statusCode}, Action: ${result.action}`);

        switch (result.action) {
            case 'SUCCESS':
                await handleTsqSuccess(transaction, type);
                break;
            case 'FAIL':
                await handleTsqFail(transaction, type);
                break;
            case 'RETRY':
                await handleTsqRetry(transaction, result.retryMinutes);
                break;
            case 'MANUAL':
                await handleTsqManual(transaction);
                break;
            default:
                await handleTsqRetry(transaction, 5);
        }
    } catch (error) {
        logger.error(`TSQ error: ${transaction.id}`, error);
        await handleTsqRetry(transaction, 5);
    }
};

const processPendingTsq = async () => {
    const transactions = await TransactionModel.findNeedingTsq(5);

    for (const transaction of transactions) {
        await processTsq(transaction);
    }
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('TSQ Worker started');

    // Initial delay before starting
    await sleep(INITIAL_DELAY);

    while (isRunning) {
        try {
            await processPendingTsq();
        } catch (error) {
            logger.error('TSQ Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('TSQ Worker stopped');
};

const getStatus = () => ({ isRunning });

module.exports = {
    start,
    stop,
    getStatus,
    processTsq,
    processPendingTsq,
    handleTsqSuccess,
    handleTsqFail,
    handleTsqRetry
};
