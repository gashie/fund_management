/**
 * Callback Worker
 * Processes incoming GIP callbacks - Functional style
 */

const CallbackModel = require('../models/callback.model');
const TransactionModel = require('../models/transaction.model');
const CallbackService = require('../services/callback.service');

const POLL_INTERVAL = 2000;

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processCallback = async (callback) => {
    const transaction = await TransactionModel.findBySessionId(callback.session_id);

    if (!transaction) {
        await CallbackModel.updateGipCallbackStatus(callback.id, 'IGNORED', 'No matching transaction');
        return;
    }

    logger.info(`Processing callback: ${callback.function_code}, Action: ${callback.action_code}`);

    try {
        let result;
        switch (callback.function_code) {
            case '241':  // FTD
                result = await CallbackService.processFtdCallback(callback, transaction);
                break;
            case '240':  // FTC
                result = await CallbackService.processFtcCallback(callback, transaction);
                break;
            case '242':  // Reversal
                result = await CallbackService.processReversalCallback(callback, transaction);
                break;
            default:
                await CallbackModel.updateGipCallbackStatus(callback.id, 'IGNORED', `Unknown function: ${callback.function_code}`);
                return;
        }

        logger.info(`Callback processed: ${callback.id}, Action: ${result?.action}`);
    } catch (error) {
        logger.error(`Callback processing error: ${callback.id}`, error);
        await CallbackModel.updateGipCallbackStatus(callback.id, 'ERROR', error.message);
    }
};

const processPendingCallbacks = async () => {
    const callbacks = await CallbackModel.findPendingGipCallbacks(10);

    for (const callback of callbacks) {
        await processCallback(callback);
    }
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Callback Worker started');

    while (isRunning) {
        try {
            await processPendingCallbacks();
        } catch (error) {
            logger.error('Callback Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Callback Worker stopped');
};

const getStatus = () => ({ isRunning });

module.exports = {
    start,
    stop,
    getStatus,
    processCallback,
    processPendingCallbacks
};
