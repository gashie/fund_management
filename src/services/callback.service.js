/**
 * Callback Service
 * Business logic for processing GIP callbacks and sending client webhooks - Functional style
 */

const TransactionModel = require('../models/transaction.model');
const CallbackModel = require('../models/callback.model');
const EventModel = require('../models/event.model');
const GipService = require('./gip.service');
const config = require('../config');
const axios = require('axios');
const crypto = require('crypto');
const { callbackLogger } = require('../utils/logger');

/**
 * Save incoming GIP callback
 */
const saveGipCallback = async (payload, clientIp) => {
    // Find matching transaction
    const sessionId = payload.sessionId || payload.session_id;
    const transaction = await TransactionModel.findBySessionId(sessionId);

    const callbackData = {
        transactionId: transaction?.id || null,
        sessionId: sessionId,
        trackingNumber: payload.trackingNumber || payload.tracking_number,
        functionCode: payload.functionCode || payload.function_code,
        actionCode: payload.actionCode || payload.action_code,
        approvalCode: payload.approvalCode || payload.approval_code,
        amount: payload.amount,
        dateTime: payload.dateTime || payload.date_time,
        originBank: payload.originBank || payload.origin_bank,
        destBank: payload.destBank || payload.dest_bank,
        accountToDebit: payload.accountToDebit || payload.account_to_debit,
        accountToCredit: payload.accountToCredit || payload.account_to_credit,
        nameToDebit: payload.nameToDebit || payload.name_to_debit,
        nameToCredit: payload.nameToCredit || payload.name_to_credit,
        channelCode: payload.channelCode || payload.channel_code,
        narration: payload.narration,
        rawPayload: payload,
        clientIp
    };

    const callback = await CallbackModel.saveGipCallback(callbackData);

    // Audit log
    await EventModel.createAuditLog({
        entityType: 'callback',
        entityId: callback.id,
        action: 'received',
        newValue: {
            functionCode: callbackData.functionCode,
            actionCode: callbackData.actionCode,
            sessionId: callbackData.sessionId
        },
        triggeredBy: 'gip',
        ipAddress: clientIp
    });

    return callback;
};

/**
 * Process FTD callback
 */
const processFtdCallback = async (callback, transaction) => {
    const actionCode = callback.action_code;

    // Log event
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: 'FTD_CALLBACK',
        eventSequence: 2,
        sessionId: callback.session_id,
        trackingNumber: callback.tracking_number,
        functionCode: '241',
        responsePayload: callback.raw_payload,
        actionCode: actionCode,
        status: actionCode === '000' ? 'SUCCESS' : 'RECEIVED',
        responseReceivedAt: new Date()
    });

    if (actionCode === '000') {
        // FTD Success - proceed to FTC
        await TransactionModel.updateStatus(transaction.id, 'FTD_SUCCESS', {
            ftd_action_code: actionCode
        });
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');
        return { action: 'PROCEED_FTC' };

    } else if (GipService.isInconclusive(actionCode)) {
        // Inconclusive - schedule TSQ
        await TransactionModel.updateStatus(transaction.id, 'FTD_TSQ', {
            ftd_action_code: actionCode
        });
        await TransactionModel.scheduleTsq(transaction.id, config.tsq.intervalMinutes);
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');
        return { action: 'SCHEDULE_TSQ' };

    } else {
        // FTD Failed
        await TransactionModel.updateStatus(transaction.id, 'FTD_FAILED', {
            ftd_action_code: actionCode,
            status_message: `FTD failed: ${actionCode}`
        });
        await TransactionModel.updateStatus(transaction.id, 'FAILED');
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');

        // Queue failure callback
        await queueClientCallback(transaction, 'FAILED', 'FTD failed');

        return { action: 'FAILED' };
    }
};

/**
 * Process FTC callback
 */
const processFtcCallback = async (callback, transaction) => {
    const actionCode = callback.action_code;

    // Log event
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: 'FTC_CALLBACK',
        eventSequence: 4,
        sessionId: callback.session_id,
        trackingNumber: callback.tracking_number,
        functionCode: '240',
        responsePayload: callback.raw_payload,
        actionCode: actionCode,
        status: actionCode === '000' ? 'SUCCESS' : 'RECEIVED',
        responseReceivedAt: new Date()
    });

    if (actionCode === '000') {
        // FTC Success - Transaction complete!
        await TransactionModel.updateStatus(transaction.id, 'FTC_SUCCESS', {
            ftc_action_code: actionCode
        });
        await TransactionModel.updateStatus(transaction.id, 'COMPLETED', {
            status_message: 'Transaction completed successfully'
        });
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');

        // Queue success callback
        await queueClientCallback(transaction, 'SUCCESS', 'Transaction completed');

        return { action: 'COMPLETED' };

    } else if (GipService.isInconclusive(actionCode)) {
        // Inconclusive - schedule TSQ
        await TransactionModel.updateStatus(transaction.id, 'FTC_TSQ', {
            ftc_action_code: actionCode
        });
        await TransactionModel.scheduleTsq(transaction.id, config.tsq.intervalMinutes);
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');
        return { action: 'SCHEDULE_TSQ' };

    } else {
        // FTC Failed - MUST REVERSE!
        await TransactionModel.updateStatus(transaction.id, 'FTC_FAILED', {
            ftc_action_code: actionCode,
            status_message: `FTC failed: ${actionCode} - reversal required`
        });
        await TransactionModel.markForReversal(transaction.id);
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');

        return { action: 'REVERSAL_REQUIRED' };
    }
};

/**
 * Process Reversal callback
 */
const processReversalCallback = async (callback, transaction) => {
    const actionCode = callback.action_code;

    // Log event
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: 'REVERSAL_CALLBACK',
        eventSequence: 6,
        sessionId: callback.session_id,
        trackingNumber: callback.tracking_number,
        functionCode: '242',
        responsePayload: callback.raw_payload,
        actionCode: actionCode,
        status: actionCode === '000' ? 'SUCCESS' : 'RECEIVED',
        responseReceivedAt: new Date()
    });

    if (actionCode === '000') {
        // Reversal Success
        await TransactionModel.updateStatus(transaction.id, 'REVERSAL_SUCCESS', {
            reversal_action_code: actionCode
        });
        await TransactionModel.updateStatus(transaction.id, 'FAILED', {
            status_message: 'Transaction failed - funds returned via reversal'
        });
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');

        // Queue failure callback (with reversal info)
        await queueClientCallback(transaction, 'FAILED', 'Transaction failed - funds reversed');

        return { action: 'REVERSAL_SUCCESS' };

    } else {
        // Reversal Failed - CRITICAL
        await TransactionModel.updateStatus(transaction.id, 'REVERSAL_FAILED', {
            reversal_action_code: actionCode,
            status_message: 'CRITICAL: Reversal failed - manual intervention required'
        });
        await CallbackModel.updateGipCallbackStatus(callback.id, 'PROCESSED');

        // Create critical alert
        await EventModel.createAuditLog({
            entityType: 'transaction',
            entityId: transaction.id,
            action: 'CRITICAL_REVERSAL_FAILED',
            details: { actionCode },
            triggeredBy: 'callback_processor'
        });

        return { action: 'REVERSAL_FAILED_CRITICAL' };
    }
};

/**
 * Queue client callback
 * Sends callback to client in the expected format:
 * { srcBankCode, srcAccountNumber, referenceNumber, requestTimestamp, sessionId,
 *   destBankCode, destAccountNumber, narration, responseCode, responseMessage, status }
 */
const queueClientCallback = async (transaction, status, message) => {
    if (!transaction.client_callback_url) return;

    // Determine response code and message based on status
    let responseCode = '000';
    let responseMessage = 'Approved';
    let statusText = 'SUCCESSFUL';

    if (status === 'FAILED') {
        responseCode = transaction.ftc_action_code || transaction.ftd_action_code || '999';
        responseMessage = message || 'Failed';
        statusText = 'FAILED';
    } else if (status === 'SUCCESS') {
        responseCode = '000';
        responseMessage = 'Approved';
        statusText = 'SUCCESSFUL';
    }

    // Format timestamp as "YYYY-MM-DD HH:mm:ss"
    const formatTimestamp = (date) => {
        if (!date) return new Date().toISOString().replace('T', ' ').substring(0, 19);
        const d = new Date(date);
        return d.toISOString().replace('T', ' ').substring(0, 19);
    };

    const payload = {
        srcBankCode: transaction.src_bank_code,
        srcAccountNumber: transaction.src_account_number,
        referenceNumber: transaction.reference_number,
        requestTimestamp: formatTimestamp(new Date()),
        sessionId: transaction.session_id,
        destBankCode: transaction.dest_bank_code,
        destAccountNumber: transaction.dest_account_number,
        narration: transaction.narration,
        responseCode,
        responseMessage,
        status: statusText
    };

    await CallbackModel.createClientCallback({
        transactionId: transaction.id,
        institutionId: transaction.institution_id,
        callbackUrl: transaction.client_callback_url,
        payload
    });
};

/**
 * Generate webhook signature
 */
const generateSignature = (payload, timestamp, secret) => {
    if (!secret) return 'unsigned';
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Calculate retry delay with exponential backoff
 */
const calculateRetryDelay = (attempts) => {
    const delay = config.callback.initialDelaySeconds * Math.pow(config.callback.backoffMultiplier, attempts);
    return Math.min(delay, config.callback.maxDelaySeconds);
};

/**
 * Send client webhook
 */
const sendClientWebhook = async (callback) => {
    const { callback_url, callback_payload, webhook_secret, reference_number } = callback;

    // Log outgoing webhook
    callbackLogger.sending(callback_url, callback_payload?.status || 'SENDING');

    // Generate signature
    const timestamp = Date.now();
    const signature = generateSignature(callback_payload, timestamp, webhook_secret);

    const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Transaction-Reference': reference_number,
        'User-Agent': 'FundManagement-Webhook/1.0'
    };

    try {
        const response = await axios.post(callback_url, callback_payload, {
            headers,
            timeout: 30000,
            validateStatus: (status) => status < 500
        });

        if (response.status >= 200 && response.status < 300) {
            // Success
            callbackLogger.sending(callback_url, `DELIVERED (${response.status})`);
            await CallbackModel.markClientCallbackDelivered(
                callback.id,
                response.status,
                JSON.stringify(response.data)
            );
            await CallbackModel.markTransactionCallbackSent(
                callback.transaction_id,
                { status: response.status, body: response.data }
            );
            return { success: true };
        } else {
            // Client error - schedule retry
            callbackLogger.sending(callback_url, `RETRY (${response.status})`);
            const delay = calculateRetryDelay(callback.attempts);
            await CallbackModel.scheduleClientCallbackRetry(
                callback.id,
                delay,
                response.status,
                `HTTP ${response.status}`
            );
            return { success: false, retry: true };
        }
    } catch (error) {
        callbackLogger.sending(callback_url, `ERROR: ${error.message}`);
        const delay = calculateRetryDelay(callback.attempts);
        if (callback.attempts + 1 >= config.callback.maxRetries) {
            await CallbackModel.markClientCallbackFailed(callback.id, null, error.message);
            return { success: false, retry: false };
        }
        await CallbackModel.scheduleClientCallbackRetry(callback.id, delay, null, error.message);
        return { success: false, retry: true };
    }
};

module.exports = {
    saveGipCallback,
    processFtdCallback,
    processFtcCallback,
    processReversalCallback,
    queueClientCallback,
    sendClientWebhook,
    generateSignature,
    calculateRetryDelay
};
