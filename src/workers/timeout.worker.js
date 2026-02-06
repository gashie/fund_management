/**
 * Timeout Worker
 * Monitors and handles transaction timeouts - Functional style
 */

const TransactionModel = require('../models/transaction.model');
const CallbackService = require('../services/callback.service');

const POLL_INTERVAL = 60000;  // 1 minute

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const handleTimeout = async (transaction) => {
    logger.warn(`Transaction timeout: ${transaction.id}, Status: ${transaction.status}`);

    const status = transaction.status;

    if (status === 'INITIATED' || status === 'NEC_PENDING') {
        // Simple timeout
        await TransactionModel.updateStatus(transaction.id, 'TIMEOUT', {
            status_message: 'Transaction timed out'
        });
        await CallbackService.queueClientCallback(transaction, 'TIMEOUT', 'Transaction timed out');

    } else if (status === 'FTD_PENDING') {
        // Schedule TSQ
        await TransactionModel.updateStatus(transaction.id, 'FTD_TSQ');
        await TransactionModel.scheduleTsq(transaction.id, 0);

    } else if (status === 'FTC_PENDING') {
        // Schedule TSQ (critical - may need reversal)
        await TransactionModel.updateStatus(transaction.id, 'FTC_TSQ');
        await TransactionModel.scheduleTsq(transaction.id, 0);

    } else if (status === 'FTD_TSQ') {
        // TSQ timed out - fail
        await TransactionModel.updateStatus(transaction.id, 'FAILED', {
            tsq_required: false,
            status_message: 'FTD verification timed out'
        });
        await CallbackService.queueClientCallback(transaction, 'FAILED', 'Transaction verification timed out');

    } else if (status === 'FTC_TSQ') {
        // FTC TSQ timed out - reversal needed
        await TransactionModel.updateStatus(transaction.id, 'FTC_FAILED', {
            tsq_required: false,
            status_message: 'FTC verification timed out - reversal required'
        });
        await TransactionModel.markForReversal(transaction.id);
    }
};

const processTimeouts = async () => {
    const transactions = await TransactionModel.findTimedOut(10);

    for (const transaction of transactions) {
        await handleTimeout(transaction);
    }
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Timeout Worker started');

    while (isRunning) {
        try {
            await processTimeouts();
        } catch (error) {
            logger.error('Timeout Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Timeout Worker stopped');
};

const getStatus = () => ({ isRunning });

module.exports = {
    start,
    stop,
    getStatus,
    handleTimeout,
    processTimeouts
};
