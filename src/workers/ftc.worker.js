/**
 * FTC Worker
 * Initiates FTC after successful FTD - Functional style
 */

const TransactionModel = require('../models/transaction.model');
const TransactionService = require('../services/transaction.service');

const POLL_INTERVAL = 3000;

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const initiateFtc = async (transaction) => {
    logger.info(`Initiating FTC for transaction: ${transaction.id}`);

    try {
        await TransactionService.processFtc(transaction);
    } catch (error) {
        logger.error(`FTC initiation error: ${transaction.id}`, error);
    }
};

const processFtdSuccess = async () => {
    const transactions = await TransactionModel.findByStatus('FTD_SUCCESS', 5);

    for (const transaction of transactions) {
        await initiateFtc(transaction);
    }
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('FTC Worker started');

    while (isRunning) {
        try {
            await processFtdSuccess();
        } catch (error) {
            logger.error('FTC Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('FTC Worker stopped');
};

const getStatus = () => ({ isRunning });

module.exports = {
    start,
    stop,
    getStatus,
    initiateFtc,
    processFtdSuccess
};
