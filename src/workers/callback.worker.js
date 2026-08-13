/**
 * Callback Worker
 * Processes incoming  callbacks - Functional style
 */

const CallbackModel = require('../models/callback.model');
const TransactionModel = require('../models/transaction.model');
const CallbackService = require('../services/callback.service');

const POLL_INTERVAL = 2000;

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processCallback = async (callback) => {
    // Match on session id, which also tells us which leg it belongs to.
    const transaction = await TransactionModel.findBySessionIdWithLeg(callback.session_id);

    if (!transaction) {
        await CallbackModel.updateGipCallbackStatus(callback.id, 'IGNORED', 'No matching transaction');
        return;
    }

    // Route by the leg whose session matched, NOT by the echoed function code.
    // Reversals are sent as 241, so function-code routing mistakes them for FTD.
    const leg = transaction.matched_leg;
    logger.info(`Processing callback: leg=${leg}, fn=${callback.function_code}, action=${callback.action_code}`);

    try {
        let result;
        switch (leg) {
            case 'FTD':
                result = await CallbackService.processFtdCallback(callback, transaction);
                break;
            case 'FTC':
                result = await CallbackService.processFtcCallback(callback, transaction);
                break;
            case 'REVERSAL':
                result = await CallbackService.processReversalCallback(callback, transaction);
                break;
            default:
                await CallbackModel.updateGipCallbackStatus(callback.id, 'IGNORED', `Unresolved leg for session ${callback.session_id}`);
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
