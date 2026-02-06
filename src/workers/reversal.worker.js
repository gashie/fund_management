/**
 * Reversal Worker
 * Handles FTD reversal when FTC fails - Functional style
 */

const TransactionModel = require('../models/transaction.model');
const TransactionService = require('../services/transaction.service');
const EventModel = require('../models/event.model');

const POLL_INTERVAL = 5000;

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processReversal = async (transaction) => {
    logger.info(`Processing reversal for: ${transaction.id}`);

    try {
        const result = await TransactionService.processReversal(transaction);

        if (result.actionCode === '000') {
            logger.info(`Reversal accepted for: ${transaction.id}`);
        } else {
            logger.warn(`Reversal response: ${result.actionCode}`);

            if (transaction.reversal_attempts >= 3) {
                await EventModel.createAuditLog({
                    entityType: 'transaction',
                    entityId: transaction.id,
                    action: 'CRITICAL_REVERSAL_MAX_ATTEMPTS',
                    triggeredBy: 'reversal_worker'
                });
            }
        }
    } catch (error) {
        logger.error(`Reversal error: ${transaction.id}`, error);
    }
};

const processPendingReversals = async () => {
    const transactions = await TransactionModel.findNeedingReversal(5);

    for (const transaction of transactions) {
        await processReversal(transaction);
    }
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Reversal Worker started');

    while (isRunning) {
        try {
            await processPendingReversals();
        } catch (error) {
            logger.error('Reversal Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Reversal Worker stopped');
};

const getStatus = () => ({ isRunning });

module.exports = {
    start,
    stop,
    getStatus,
    processReversal,
    processPendingReversals
};
