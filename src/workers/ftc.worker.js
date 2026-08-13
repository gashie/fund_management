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
        // The claim already moved us to FTC_PENDING, so nothing else would retry this row.
        // Hand it back to FTD_SUCCESS - the FTC was never sent.
        logger.error(`FTC initiation error: ${transaction.id}`, error);
        await TransactionModel.updateStatus(transaction.id, 'FTD_SUCCESS', {
            status_message: `FTC send failed, will retry: ${error.message}`
        });
    }
};

const processFtdSuccess = async () => {
    // Claim and flip to FTC_PENDING in one committed step - two workers cannot both send an FTC.
    const transactions = await TransactionModel.claimByStatus('FTD_SUCCESS', 'FTC_PENDING', 5);

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
