/**
 * TSQ Worker
 * Transaction Status Query - Functional style
 *ActCode describes OUR REQUEST, not the
 * transaction. Only ActCode 000 carries a real outcome in StatusQuery.
 */

const TransactionModel = require('../models/transaction.model');
const TransactionService = require('../services/transaction.service');
const CallbackService = require('../services/callback.service');
const EventModel = require('../models/event.model');
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

/**
 * A confirmed failure of the original transaction (ActCode 000 + a failing StatusQuery).
 */
const handleTsqFail = async (transaction, type) => {
    if (type === 'FTD') {
        await TransactionModel.updateStatus(transaction.id, 'FTD_FAILED', { tsq_required: false });
        await TransactionModel.updateStatus(transaction.id, 'FAILED');
        await CallbackService.queueClientCallback(transaction, 'FAILED', 'FTD failed (confirmed via TSQ)');

    } else if (type === 'FTC') {
        // Customer was debited and never credited. Auto-reversal is off, so park for an operator.
        const parked = await TransactionModel.updateStatus(transaction.id, 'MANUAL_REVERSAL_REQUIRED', {
            tsq_required: false,
            status_message: 'FTC failed via TSQ - manual reversal required'
        });
        await EventModel.createAuditLog({
            entityType: 'transaction',
            entityId: transaction.id,
            action: 'MANUAL_REVERSAL_REQUIRED',
            details: { reason: 'FTC failed (confirmed via TSQ)' },
            triggeredBy: 'tsq_worker'
        });
        await CallbackService.queueClientCallback(parked || transaction, 'FAILED', 'Transaction failed - funds return pending');

    } else if (type === 'REVERSAL') {
        await TransactionModel.updateStatus(transaction.id, 'REVERSAL_FAILED', {
            tsq_required: false,
            status_message: 'CRITICAL: Reversal failed via TSQ'
        });
        await CallbackService.queueClientCallback(transaction, 'FAILED', 'Transaction failed - funds return pending');
    }
};

/**
 * Out of attempts and still no confirmed outcome. Park it - do not invent a result,
 * and do not send the client a terminal callback for a status we do not have.
 */
const handleTsqExhausted = async (transaction, type, reason) => {
    logger.warn(`TSQ exhausted for ${transaction.id} (${type}): ${reason}`);

    await TransactionModel.updateStatus(transaction.id, 'NEEDS_MANUAL_REVIEW', {
        tsq_required: false,
        status_message: `TSQ inconclusive after ${config.tsq.maxAttempts} attempts: ${reason}`
    });

    await EventModel.createAuditLog({
        entityType: 'transaction',
        entityId: transaction.id,
        action: 'TSQ_INCONCLUSIVE_NEEDS_REVIEW',
        details: { leg: type, reason },
        triggeredBy: 'tsq_worker'
    });
};

const handleTsqRetry = async (transaction, type, retryMinutes, reason) => {
    if (transaction.tsq_attempts >= config.tsq.maxAttempts) {
        await handleTsqExhausted(transaction, type, reason);
    } else {
        await TransactionModel.scheduleTsq(transaction.id, retryMinutes || 5);
    }
};

const processTsq = async (transaction) => {
    const type = transaction.status.includes('FTD') ? 'FTD' :
                 transaction.status.includes('FTC') ? 'FTC' : 'REVERSAL';

    logger.info(`Processing TSQ for: ${transaction.id}, Type: ${type}`);

    try {
        const result = await TransactionService.processTsq(transaction, type);

        logger.info(`TSQ result: act=${result.actionCode} status=${result.statusCode} -> ${result.action}`);

        switch (result.action) {
            case 'SUCCESS':
                await handleTsqSuccess(transaction, type);
                break;
            case 'FAIL':
                await handleTsqFail(transaction, type);
                break;
            case 'RETRY':
                await handleTsqRetry(transaction, type, result.retryMinutes, result.message);
                break;
            case 'REQUEST_ERROR':
                // Our request was rejected (bad values, missing field, TSQ unavailable).
                // That says nothing about the transaction - retry, then park for a human.
                await handleTsqRetry(transaction, type, result.retryMinutes, `TSQ request rejected: ${result.message}`);
                break;
            default:
                await handleTsqRetry(transaction, type, 5, 'Unrecognised TSQ response');
        }
    } catch (error) {
        logger.error(`TSQ error: ${transaction.id}`, error);
        await handleTsqRetry(transaction, type, 5, error.message);
    }
};

const processPendingTsq = async () => {
    // Leased claim - a second worker cannot pick up the same row while this one is querying.
    const transactions = await TransactionModel.claimTsqDue(5, config.tsq.intervalMinutes);

    for (const transaction of transactions) {
        await processTsq(transaction);
    }
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('TSQ Worker started');

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
    handleTsqRetry,
    handleTsqExhausted
};
