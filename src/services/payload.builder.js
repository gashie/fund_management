/**
 * Payload Builder

 *   accountToDebit  is ALWAYS the customer      (dest)
 *   accountToCredit is ALWAYS the requesting bank (src)
 * The account and name fields are the same on every leg.
 * Only the two bank fields swap between the debit leg and the credit leg.
 */

const config = require('../config');

/**
 * Turn 200.00 into "000000020000". Twelve digits, zeros in front.
 */
const formatAmount = (amount) => {
    if (!amount || amount === 0) return '000000000000';
    const cents = Math.round(amount * 100);
    return cents.toString().padStart(12, '0');
};

/**
 * Turn a date into "YYMMDDHHmmss".
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
 * The customer is debited, the requesting bank is credited. Same on every leg.
 */
const moneyFields = (txn) => ({
    accountToDebit: txn.destAccountNumber,
    accountToCredit: txn.srcAccountNumber,
    nameToDebit: txn.destAccountName,
    nameToCredit: txn.srcAccountName
});

/**
 * Name enquiry (NED). Checks the name on the account we are about to debit.
 */
const buildNameEnquiry = (txn) => ({
    dateTime: txn.dateTime || formatTimestamp(),
    sessionId: txn.sessionId,
    trackingNumber: txn.trackingNumber,
    functionCode: config.codes.NEC,
    channelCode: config.codes.CHANNEL,
    origineBank: txn.srcBankCode,
    destBank: txn.destBankCode,
    accountToDebit: txn.destAccountNumber,
    accountToCredit: txn.srcAccountNumber,
    amount: '000000000000',
    narration: 'Name Enquiry'
});

/**
 * FTD - take the money from the customer.
 */
const buildFtd = (txn) => ({
    amount: txn.amountFormatted,
    dateTime: txn.dateTime || formatTimestamp(),
    origineBank: txn.srcBankCode,
    destBank: txn.destBankCode,
    ...moneyFields(txn),
    narration: txn.narration,
    sessionId: txn.sessionId,
    trackingNumber: txn.trackingNumber,
    functionCode: config.codes.FTD,
    channelCode: config.codes.CHANNEL,
    callbackUrl: config.gip.callbackUrl
});

/**
 * FTC - give the money to the requesting bank.
 * Same accounts and names as the FTD. Only the two bank fields swap.
 */
const buildFtc = (txn) => ({
    amount: txn.amountFormatted,
    dateTime: txn.dateTime || formatTimestamp(),
    origineBank: txn.destBankCode,
    destBank: txn.srcBankCode,
    ...moneyFields(txn),
    narration: txn.narration,
    sessionId: txn.ftcSessionId,
    trackingNumber: txn.ftcTrackingNumber,
    functionCode: config.codes.FTC,
    channelCode: config.codes.CHANNEL,
    callbackUrl: config.gip.callbackUrl
});

/**
 * Reversal - put the money back. Undoes the FTD, so debit and credit swap over.
 * Not confirmed with external API yet. Only used for manual reversals.
 */
const buildReversal = (txn) => ({
    amount: txn.amountFormatted,
    dateTime: txn.dateTime || formatTimestamp(),
    origineBank: txn.destBankCode,
    destBank: txn.srcBankCode,
    accountToDebit: txn.srcAccountNumber,
    accountToCredit: txn.destAccountNumber,
    nameToDebit: txn.srcAccountName,
    nameToCredit: txn.destAccountName,
    narration: `REVERSAL: ${txn.narration || 'FTC Failed'}`,
    sessionId: txn.reversalSessionId,
    trackingNumber: txn.reversalTrackingNumber,
    functionCode: config.codes.FTD,
    channelCode: config.codes.CHANNEL,
    callbackUrl: config.gip.callbackUrl
});

/**
 * Which session, tracking number, banks and date/time belong to each leg.
 * TSQ has to repeat exactly what that leg sent, or external api answers 381.
 */
const legDetails = (txn, leg) => {
    if (leg === 'FTC') {
        return {
            origineBank: txn.destBankCode,
            destBank: txn.srcBankCode,
            sessionId: txn.ftcSessionId,
            trackingNumber: txn.ftcTrackingNumber,
            dateTime: txn.ftcDateTime
        };
    }
    if (leg === 'REVERSAL') {
        return {
            origineBank: txn.destBankCode,
            destBank: txn.srcBankCode,
            sessionId: txn.reversalSessionId,
            trackingNumber: txn.reversalTrackingNumber,
            dateTime: txn.reversalDateTime
        };
    }
    return {
        origineBank: txn.srcBankCode,
        destBank: txn.destBankCode,
        sessionId: txn.sessionId,
        trackingNumber: txn.trackingNumber,
        dateTime: txn.ftdDateTime
    };
};

/**
 * TSQ - ask external API what happened to one leg.
 * Every value must be the same one that leg used originally.
 */
const buildTsq = (txn, leg = 'FTD') => {
    const details = legDetails(txn, leg);

    return {
        amount: txn.amountFormatted,
        dateTime: details.dateTime,
        origineBank: details.origineBank,
        destBank: details.destBank,
        sessionId: details.sessionId,
        trackingNumber: details.trackingNumber,
        ...moneyFields(txn),
        narration: txn.narration,
        functionCode: config.codes.TSQ,
        channelCode: config.codes.CHANNEL
    };
};

module.exports = {
    formatAmount,
    formatTimestamp,
    buildNameEnquiry,
    buildFtd,
    buildFtc,
    buildReversal,
    buildTsq,
    legDetails
};
