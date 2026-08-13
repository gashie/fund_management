/**
 * FTC Worker
 * Sends the FTC once the FTD has succeeded.

 */

const TransactionModel = require('../models/transaction.model');
const TransactionService = require('../services/transaction.service');
const EventModel = require('../models/event.model');

const POLL_INTERVAL = 3000;
const MAX_FTC_ATTEMPTS = 3;

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const initiateFtc = async (transaction) => {
    logger.info(`Initiating FTC for transaction: ${transaction.id}`);

    try {
        await TransactionService.processFtc(transaction);
    } catch (error) {
        logger.error(`FTC initiation error: ${transaction.id}`, error);

        // The FTC never went out. Count the try and decide whether to go again.
        const attempts = await TransactionModel.countFtcAttempt(transaction.id);

        if (attempts >= MAX_FTC_ATTEMPTS) {
            // The customer's money is already gone and we cannot deliver it.
            // Stop trying and put it in front of a person.
            await TransactionModel.updateStatus(transaction.id, 'MANUAL_REVERSAL_REQUIRED', {
                status_message: `FTC could not be sent after ${attempts} tries: ${error.message}`
            });
            await EventModel.createAuditLog({
                entityType: 'transaction',
                entityId: transaction.id,
                action: 'FTC_SEND_FAILED_MAX_ATTEMPTS',
                details: { attempts, error: error.message },
                triggeredBy: 'ftc_worker'
            });
            logger.error(`FTC gave up after ${attempts} tries: ${transaction.id}`);
        } else {
            // Put it back so the next pass tries again.
            await TransactionModel.updateStatus(transaction.id, 'FTD_SUCCESS', {
                status_message: `FTC send failed, try ${attempts} of ${MAX_FTC_ATTEMPTS}: ${error.message}`
            });
        }
    }
};

const processFtdSuccess = async () => {
    // Take the rows and change their status in one locked step.
    // Two workers can never pick up the same transaction.
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
    processFtdSuccess,
    MAX_FTC_ATTEMPTS
};
