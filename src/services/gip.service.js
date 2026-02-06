/**
 * GIP Service
 * External API calls to GIP - Functional style
 */

const axios = require('axios');
const config = require('../config');
const { gipLogger } = require('../utils/logger');

const client = axios.create({
    timeout: config.gip.timeout,
    headers: { 'Content-Type': 'application/json' }
});

/**
 * Format amount for GIP (12-digit padded)
 * Example: 1000.50 → "000000100050"
 */
const formatAmount = (amount) => {
    if (!amount || amount === 0) return '000000000000';
    const cents = Math.round(amount * 100);
    return cents.toString().padStart(12, '0');
};

/**
 * Format timestamp for GIP (YYMMDDHHmmss)
 */
const formatTimestamp = (date = new Date()) => {
    const d = new Date(date);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const mi = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    return `${yy}${mm}${dd}${hh}${mi}${ss}`;
};

/**
 * Make GIP API request
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
 * Name Enquiry (NEC) Request
 */
const nameEnquiry = async (txn) => {
    const payload = {
        dateTime: formatTimestamp(),
        sessionId: txn.sessionId,
        trackingNumber: txn.trackingNumber,
        functionCode: config.codes.NEC,
        channelCode: config.codes.CHANNEL,
        originBank: txn.srcBankCode,
        destBank: txn.destBankCode,
        accountToCredit: txn.srcAccountNumber,
        accountToDebit: txn.destAccountNumber,
        amount: '000000000000',
        narration: 'Name Enquiry'
    };

    gipLogger.request('NEC', payload);
    const startTime = Date.now();

    try {
        const result = await makeRequest(config.gip.necUrl, payload);
        const response = {
            ...result,
            payload,
            actionCode: result.data?.actionCode,
            accountName: result.data?.nameToDebit || result.data?.nameToCredit
        };
        gipLogger.response('NEC', response, Date.now() - startTime);
        return response;
    } catch (error) {
        gipLogger.error('NEC', error, Date.now() - startTime);
        throw error;
    }
};

/**
 * Funds Transfer Debit (FTD) Request
 * Debits the source account - accountToDebit=src, accountToCredit=dest
 */
const fundsTransferDebit = async (txn) => {
    const payload = {
        amount: txn.amountFormatted,
        dateTime: formatTimestamp(),
        destBank: txn.destBankCode,
        narration: txn.narration,
        sessionId: txn.sessionId,
        originBank: txn.srcBankCode,
        callbackUrl: config.gip.callbackUrl,
        channelCode: config.codes.CHANNEL,
        nameToDebit: txn.srcAccountName,
        functionCode: config.codes.FTD,
        nameToCredit: txn.destAccountName,
        accountToDebit: txn.srcAccountNumber,
        trackingNumber: txn.trackingNumber,
        accountToCredit: txn.destAccountNumber
    };

    gipLogger.request('FTD', payload);
    const startTime = Date.now();

    try {
        const result = await makeRequest(config.gip.ftdUrl, payload);
        const response = {
            ...result,
            payload,
            actionCode: result.data?.actionCode
        };
        gipLogger.response('FTD', response, Date.now() - startTime);
        return response;
    } catch (error) {
        gipLogger.error('FTD', error, Date.now() - startTime);
        throw error;
    }
};

/**
 * Funds Transfer Credit (FTC) Request
 * Credits the destination account - originBank/destBank swapped from FTD
 */
const fundsTransferCredit = async (txn, ftcSessionId, ftcTrackingNumber) => {
    const payload = {
        amount: txn.amountFormatted,
        dateTime: formatTimestamp(),
        destBank: txn.srcBankCode,
        narration: txn.narration,
        sessionId: ftcSessionId,
        originBank: txn.destBankCode,
        callbackUrl: config.gip.callbackUrl,
        channelCode: config.codes.CHANNEL,
        nameToDebit: txn.srcAccountName,
        functionCode: config.codes.FTC,
        nameToCredit: txn.destAccountName,
        accountToDebit: txn.srcAccountNumber,
        trackingNumber: ftcTrackingNumber,
        accountToCredit: txn.destAccountNumber
    };

    gipLogger.request('FTC', payload);
    const startTime = Date.now();

    try {
        const result = await makeRequest(config.gip.ftcUrl, payload);
        const response = {
            ...result,
            payload,
            actionCode: result.data?.actionCode
        };
        gipLogger.response('FTC', response, Date.now() - startTime);
        return response;
    } catch (error) {
        gipLogger.error('FTC', error, Date.now() - startTime);
        throw error;
    }
};

/**
 * Reversal Request (swap all src/dest to reverse the original FTD)
 * Debits the original destination and credits the original source
 */
const reversal = async (txn, reversalSessionId, reversalTrackingNumber) => {
    const payload = {
        amount: txn.amountFormatted,
        dateTime: formatTimestamp(),
        destBank: txn.srcBankCode,
        narration: `REVERSAL: ${txn.narration || 'FTC Failed'}`,
        sessionId: reversalSessionId,
        originBank: txn.destBankCode,
        callbackUrl: config.gip.callbackUrl,
        channelCode: config.codes.CHANNEL,
        nameToDebit: txn.destAccountName,
        functionCode: config.codes.FTD,
        nameToCredit: txn.srcAccountName,
        accountToDebit: txn.destAccountNumber,
        trackingNumber: reversalTrackingNumber,
        accountToCredit: txn.srcAccountNumber
    };

    gipLogger.request('REV', payload);
    const startTime = Date.now();

    try {
        const result = await makeRequest(config.gip.ftdUrl, payload);
        const response = {
            ...result,
            payload,
            actionCode: result.data?.actionCode
        };
        gipLogger.response('REV', response, Date.now() - startTime);
        return response;
    } catch (error) {
        gipLogger.error('REV', error, Date.now() - startTime);
        throw error;
    }
};

/**
 * Transaction Status Query (TSQ)
 * Uses the original transaction's session/tracking values
 * functionCode 111 for status queries
 */
const transactionStatusQuery = async (txn) => {
    const payload = {
        amount: txn.amountFormatted,
        dateTime: formatTimestamp(),
        destBank: txn.destBankCode,
        narration: txn.narration,
        sessionId: txn.sessionId,
        originBank: txn.srcBankCode,
        channelCode: config.codes.CHANNEL,
        functionCode: config.codes.TSQ,
        accountToDebit: txn.srcAccountNumber,
        trackingNumber: txn.trackingNumber,
        accountToCredit: txn.destAccountNumber
    };

    gipLogger.request('TSQ', payload);
    const startTime = Date.now();

    try {
        const result = await makeRequest(config.gip.tsqUrl, payload);
        const response = {
            ...result,
            payload,
            actionCode: result.data?.actionCode,
            statusCode: result.data?.statusCode || result.data?.statusQuery
        };
        gipLogger.response('TSQ', response, Date.now() - startTime);
        return response;
    } catch (error) {
        gipLogger.error('TSQ', error, Date.now() - startTime);
        throw error;
    }
};

/**
 * Determine TSQ action based on GhIPSS rules
 */
const determineTsqAction = (actionCode, statusCode) => {
    if (actionCode === '000' && statusCode === '000') {
        return { action: 'SUCCESS', message: 'Transaction successful' };
    }
    if (actionCode === '000' && statusCode === '990') {
        return { action: 'RETRY', message: 'Being processed', retryMinutes: 5 };
    }
    if (actionCode === '000' && statusCode === '381') {
        return { action: 'FAIL', message: 'Not at receiving institution' };
    }
    if (actionCode === '381' && !statusCode) {
        return { action: 'MANUAL', message: 'Mismatched values' };
    }
    if (actionCode === '999' && !statusCode) {
        return { action: 'FAIL', message: 'Validation error' };
    }
    if (actionCode === '990' && !statusCode) {
        return { action: 'RETRY', message: 'Exception', retryMinutes: 5 };
    }
    return { action: 'UNKNOWN', message: 'Unknown response' };
};

/**
 * Check if action code needs TSQ
 */
const isInconclusive = (actionCode) => {
    return config.tsq.inconclusiveCodes.includes(actionCode);
};

module.exports = {
    formatAmount,
    formatTimestamp,
    makeRequest,
    nameEnquiry,
    fundsTransferDebit,
    fundsTransferCredit,
    reversal,
    transactionStatusQuery,
    determineTsqAction,
    isInconclusive
};
