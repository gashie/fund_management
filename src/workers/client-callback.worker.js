/**
 * Client Callback Worker
 * Sends webhooks to institution callback URLs - Functional style
 */

const CallbackModel = require('../models/callback.model');
const CallbackService = require('../services/callback.service');

const POLL_INTERVAL = 5000;

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendCallback = async (callback) => {
    logger.info(`Sending callback to: ${callback.callback_url}`);

    try {
        const result = await CallbackService.sendClientWebhook(callback);

        if (result.success) {
            logger.info(`Callback delivered: ${callback.id}`);
        } else if (result.retry) {
            logger.warn(`Callback retry scheduled: ${callback.id}`);
        } else {
            logger.error(`Callback failed permanently: ${callback.id}`);
        }
    } catch (error) {
        logger.error(`Callback send error: ${callback.id}`, error);
    }
};

const processPendingCallbacks = async () => {
    const callbacks = await CallbackModel.findPendingClientCallbacks(10);

    for (const callback of callbacks) {
        await sendCallback(callback);
    }
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Client Callback Worker started');

    while (isRunning) {
        try {
            await processPendingCallbacks();
        } catch (error) {
            logger.error('Client Callback Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Client Callback Worker stopped');
};

const getStatus = () => ({ isRunning });

module.exports = {
    start,
    stop,
    getStatus,
    sendCallback,
    processPendingCallbacks
};
