/**
 * GIP Service
 * Sends messages to external api and reads the replies.
 *
 * REPLACES src/services/gip.service.js in full.
 * The message building moved to payload.builder.js so it can be tested.
 */

const axios = require('axios');
const config = require('../config');
const { gipLogger } = require('../utils/logger');
const { actCode } = require('../../config/actcodes');
const Payload = require('./payload.builder');

// ============================================================================
// EXTERNAL API ACTION CODES (from config/actcodes.js)
// ============================================================================

const ACTION_CODES = actCode.reduce((map, item) => {
    map[item.code] = item.message;
    return map;
}, {});

// The leg worked.
const SUCCESS_CODES = ['000', '300', '480', '385'];

// Accepted. A callback will follow.
const ASYNC_CODES = ['001'];

// Temporary problem. Try again or use TSQ.
const RETRY_CODES = ['909', '912', '990', '911', '091'];

// Do not try again.
const FATAL_CODES = ['114', '116', '999', '100', '125', '381'];

const getActionMessage = (code) => ACTION_CODES[code] || 'Unknown';
const isSuccess = (code) => SUCCESS_CODES.includes(code);
const isAsync = (code) => ASYNC_CODES.includes(code);
const isRetryable = (code) => RETRY_CODES.includes(code);
const isFatal = (code) => FATAL_CODES.includes(code);

/**
 * Work out what a reply means.
 */
const analyzeResponse = (actionCode, approvalCode = null) => {
    const message = approvalCode || getActionMessage(actionCode);

    if (isSuccess(actionCode)) {
        return { status: 'SUCCESS', message, shouldRetry: false, isFinal: true };
    }
    if (isAsync(actionCode)) {
        return { status: 'PENDING', message, shouldRetry: false, isFinal: false };
    }
    if (isRetryable(actionCode)) {
        return { status: 'RETRY', message, shouldRetry: true, isFinal: false };
    }
    if (isFatal(actionCode)) {
        return { status: 'FAILED', message, shouldRetry: false, isFinal: true };
    }
    // We do not know this code. Treat it as worth retrying rather than guessing.
    return { status: 'UNKNOWN', message, shouldRetry: true, isFinal: false };
};

const client = axios.create({
    timeout: config.gip.timeout,
    headers: { 'Content-Type': 'application/json' }
});

// Kept here so nothing that already imports them from this file breaks.
const formatAmount = Payload.formatAmount;
const formatTimestamp = Payload.formatTimestamp;

/**
 * Send one message to external API.
 */
const makeRequest = async (url, payload) => {
    const startTime = Date.now();
    try {
        const response = await client.post(url, payload);
        return {
            success: true,
            data: response.data,
            statusCode: response.status,
            duration: Date.now() - startTime
        };
    } catch (error) {
        if (error.response) {
            return {
                success: false,
                data: error.response.data,
                statusCode: error.response.status,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
        throw error;
    }
};

/**
 * Shared send-and-log wrapper. Always returns the payload we sent,
 * so the caller can save the dateTime for a later TSQ.
 */
const send = async (label, url, payload, extra = () => ({})) => {
    gipLogger.request(label, payload);
    const startTime = Date.now();

    try {
        const result = await makeRequest(url, payload);
        const response = {
            ...result,
            payload,
            actionCode: result.data?.actionCode,
            ...extra(result)
        };
        gipLogger.response(label, response, Date.now() - startTime);
        return response;
    } catch (error) {
        gipLogger.error(label, error, Date.now() - startTime);
        throw error;
    }
};

/**
 * Name enquiry. Checks the name on the account we are about to debit.
 */
const nameEnquiry = async (txn) => {
    const payload = Payload.buildNameEnquiry(txn);
    return send('NED', config.gip.necUrl, payload, (result) => ({
        accountName: result.data?.nameToDebit || result.data?.nameToCredit
    }));
};

/**
 * FTD. Takes the money from the customer.
 */
const fundsTransferDebit = async (txn) => {
    const payload = Payload.buildFtd(txn);
    return send('FTD', config.gip.ftdUrl, payload);
};

/**
 * FTC. Gives the money to the requesting bank. Needs its own session and tracking number.
 */
const fundsTransferCredit = async (txn, ftcSessionId, ftcTrackingNumber) => {
    const payload = Payload.buildFtc({ ...txn, ftcSessionId, ftcTrackingNumber });
    return send('FTC', config.gip.ftcUrl, payload);
};

/**
 * Reversal. Puts the money back. Only used for manual reversals for now.
 */
const reversal = async (txn, reversalSessionId, reversalTrackingNumber) => {
    const payload = Payload.buildReversal({ ...txn, reversalSessionId, reversalTrackingNumber });
    return send('REV', config.gip.ftdUrl, payload);
};

/**
 * TSQ. Asks what happened to one leg. Must repeat that leg's original values.
 */
const transactionStatusQuery = async (txn, leg = 'FTD') => {
    const payload = Payload.buildTsq(txn, leg);
    return send('TSQ', config.gip.tsqUrl, payload, (result) => ({
        statusCode: result.data?.statusCode || result.data?.statusQuery
    }));
};

/**
 * Work out what a TSQ reply means.
 *
 *
 *   ActCode tells us if OUR REQUEST was accepted. It is not the transaction result.
 *   StatusQuery is the transaction result, and it is only filled in when ActCode is 000.
 */
const determineTsqAction = (actionCode, statusCode) => {
    // 381, 999 and 990 mean our own request was wrong or could not be handled.
    // The transaction itself is untouched, so never mark it failed on these.
    if (actionCode !== '000') {
        const reasons = {
            '381': 'Values do not match the original transaction, or it was on an earlier day',
            '999': 'A required field was missing or wrong in the TSQ request',
            '990': 'System could not process the TSQ request'
        };
        return {
            action: 'REQUEST_ERROR',
            message: reasons[actionCode] || `Unknown TSQ ActCode: ${actionCode}`,
            retryMinutes: 5
        };
    }

    // ActCode 000 with nothing in StatusQuery gives us no result to act on.
    if (!statusCode) {
        return { action: 'REQUEST_ERROR', message: 'ActCode 000 but no StatusQuery', retryMinutes: 5 };
    }

    if (isSuccess(statusCode)) {
        return { action: 'SUCCESS', message: getActionMessage(statusCode) };
    }
    if (statusCode === '990' || isRetryable(statusCode)) {
        return { action: 'RETRY', message: 'Still being processed by the other bank', retryMinutes: 5 };
    }
    if (isFatal(statusCode)) {
        return { action: 'FAIL', message: getActionMessage(statusCode) };
    }

    // Unknown result. Ask again rather than guess.
    return { action: 'RETRY', message: `Unknown StatusQuery: ${statusCode}`, retryMinutes: 5 };
};

/**
 * These replies mean "we do not know yet" and must go to TSQ.
 */
const isInconclusive = (actionCode) => {
    return config.tsq.inconclusiveCodes.includes(actionCode);
};

module.exports = {
    // Formatting
    formatAmount,
    formatTimestamp,

    // Sending
    makeRequest,
    nameEnquiry,
    fundsTransferDebit,
    fundsTransferCredit,
    reversal,
    transactionStatusQuery,

    // TSQ helpers
    determineTsqAction,
    isInconclusive,

    // Action code helpers
    ACTION_CODES,
    SUCCESS_CODES,
    ASYNC_CODES,
    RETRY_CODES,
    FATAL_CODES,
    getActionMessage,
    isSuccess,
    isAsync,
    isRetryable,
    isFatal,
    analyzeResponse
};
