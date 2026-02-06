/**
 * Transaction Service
 * Business logic for NEC, FT, and TSQ operations - Functional style
 */

const TransactionModel = require('../models/transaction.model');
const ParticipantModel = require('../models/participant.model');
const CallbackModel = require('../models/callback.model');
const EventModel = require('../models/event.model');
const GipService = require('./gip.service');
const config = require('../config');
const { logger } = require('../utils/logger');

/**
 * Validate transaction request
 */
const validateRequest = async (data, institution) => {
    // Check for duplicate reference
    const exists = await TransactionModel.referenceExists(data.referenceNumber);
    if (exists) {
        throw {
            status: 409,
            code: '094',
            message: 'Duplicate reference number'
        };
    }

    // Validate bank codes
    const participants = await ParticipantModel.validateBankCodes(
        data.srcBankCode,
        data.destBankCode
    );

    if (!participants.source) {
        throw {
            status: 400,
            code: '381',
            message: `Invalid source bank code: ${data.srcBankCode}`
        };
    }

    if (!participants.destination) {
        throw {
            status: 400,
            code: '381',
            message: `Invalid destination bank code: ${data.destBankCode}`
        };
    }

    return participants;
};

/**
 * Create a new transaction
 */
const createTransaction = async (data, institution, type) => {
    // Generate unique IDs
    const ids = await TransactionModel.generateIds();

    // Calculate timeout
    const timeoutMinutes = type === 'NEC' ? config.timeout.nec : config.timeout.transaction;
    const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    // Create transaction
    const transaction = await TransactionModel.create({
        institutionId: institution.id,
        credentialId: institution.credentialId,
        referenceNumber: data.referenceNumber,
        sessionId: ids.sessionId,
        trackingNumber: ids.trackingNumber,
        transactionType: type,
        amount: data.amount || 0,
        amountFormatted: GipService.formatAmount(data.amount || 0),
        srcBankCode: data.srcBankCode,
        srcAccountNumber: data.srcAccountNumber,
        srcAccountName: data.srcAccountName || null,
        destBankCode: data.destBankCode,
        destAccountNumber: data.destAccountNumber,
        destAccountName: data.destAccountName || null,
        narration: data.narration || null,
        callbackUrl: data.callbackUrl || institution.webhookUrl,
        clientIp: data.clientIp,
        userAgent: data.userAgent,
        requestTimestamp: data.requestTimestamp || new Date(),
        timeoutAt
    });

    // Audit log
    await EventModel.createAuditLog({
        entityType: 'transaction',
        entityId: transaction.id,
        action: 'created',
        newValue: { status: 'INITIATED', type },
        triggeredBy: 'api',
        ipAddress: data.clientIp
    });

    return transaction;
};

/**
 * Process Name Enquiry (NEC)
 * Synchronous - calls GIP and returns result immediately
 */
const processNameEnquiry = async (transaction) => {
    // Update status
    await TransactionModel.updateStatus(transaction.id, 'NEC_PENDING');

    // Create initial event record
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: 'NEC_REQUEST',
        eventSequence: 1,
        sessionId: transaction.session_id,
        trackingNumber: transaction.tracking_number,
        functionCode: config.codes.NEC,
        status: 'PENDING'
    });

    // Call GIP
    const result = await GipService.nameEnquiry({
        sessionId: transaction.session_id,
        trackingNumber: transaction.tracking_number,
        srcBankCode: transaction.src_bank_code,
        destBankCode: transaction.dest_bank_code,
        srcAccountNumber: transaction.src_account_number,
        destAccountNumber: transaction.dest_account_number
    });

    // Update event with full request/response data
    await EventModel.updateGipEvent({
        transactionId: transaction.id,
        eventType: 'NEC_REQUEST',
        requestPayload: result.payload,
        responsePayload: result.data,
        actionCode: result.actionCode,
        status: result.actionCode === '000' ? 'SUCCESS' : 'FAILED',
        durationMs: result.duration
    });

    if (result.actionCode === '000') {
        // Success
        await TransactionModel.updateStatus(transaction.id, 'NEC_SUCCESS', {
            nec_action_code: result.actionCode,
            dest_account_name: result.accountName
        });

        // For NEC-only, mark complete
        if (transaction.transaction_type === 'NEC') {
            await TransactionModel.updateStatus(transaction.id, 'COMPLETED', {
                status_message: 'Name enquiry completed successfully'
            });
        }

        return {
            success: true,
            responseCode: '000',
            responseMessage: 'SUCCESS',
            sessionId: transaction.session_id,
            referenceNumber: transaction.reference_number,
            destAccountName: result.accountName
        };
    } else {
        // Failed
        await TransactionModel.updateStatus(transaction.id, 'NEC_FAILED', {
            nec_action_code: result.actionCode,
            status_message: `NEC failed: ${result.actionCode}`
        });

        await TransactionModel.updateStatus(transaction.id, 'FAILED');

        return {
            success: false,
            responseCode: result.actionCode || '999',
            responseMessage: 'FAILED',
            sessionId: transaction.session_id,
            referenceNumber: transaction.reference_number,
            error: `Name enquiry failed with code: ${result.actionCode}`
        };
    }
};

/**
 * Initiate Funds Transfer (FTD)
 * Asynchronous - sends request and returns immediately
 */
const initiateFundsTransfer = async (transaction) => {
    // Update status
    await TransactionModel.updateStatus(transaction.id, 'FTD_PENDING', {
        status_message: 'FTD request sent, waiting for callback'
    });

    // Create initial event record
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: 'FTD_REQUEST',
        eventSequence: 3,
        sessionId: transaction.session_id,
        trackingNumber: transaction.tracking_number,
        functionCode: config.codes.FTD,
        status: 'PENDING'
    });

    // Call GIP (async - don't wait for callback)
    GipService.fundsTransferDebit({
        sessionId: transaction.session_id,
        trackingNumber: transaction.tracking_number,
        srcBankCode: transaction.src_bank_code,
        destBankCode: transaction.dest_bank_code,
        srcAccountNumber: transaction.src_account_number,
        destAccountNumber: transaction.dest_account_number,
        srcAccountName: transaction.src_account_name,
        destAccountName: transaction.dest_account_name,
        amountFormatted: transaction.amount_formatted,
        narration: transaction.narration
    }).then(async (result) => {
        // Update event with request/response data
        await EventModel.updateGipEvent({
            transactionId: transaction.id,
            eventType: 'FTD_REQUEST',
            requestPayload: result.payload,
            responsePayload: result.data,
            actionCode: result.actionCode,
            status: GipService.isAsync(result.actionCode) ? 'PENDING_CALLBACK' :
                   GipService.isSuccess(result.actionCode) ? 'SUCCESS' : 'FAILED',
            durationMs: result.duration
        });
    }).catch(async (err) => {
        logger.error('FTD request failed', err);
        await EventModel.updateGipEvent({
            transactionId: transaction.id,
            eventType: 'FTD_REQUEST',
            responsePayload: { error: err.message },
            actionCode: 'ERR',
            status: 'ERROR'
        });
    });

    return {
        success: true,
        responseCode: '000',
        responseMessage: 'ACCEPTED',
        status: 'PENDING',
        sessionId: transaction.session_id,
        referenceNumber: transaction.reference_number,
        transactionId: transaction.id,
        message: 'Transfer request accepted. You will receive a callback when complete.'
    };
};

/**
 * Process FTC (called by worker after FTD success)
 */
const processFtc = async (transaction) => {
    // Generate new IDs for FTC
    const ids = await TransactionModel.generateIds();

    // Update status
    await TransactionModel.updateStatus(transaction.id, 'FTC_PENDING', {
        status_message: 'FTC request sent, waiting for callback'
    });

    // Create initial event record
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: 'FTC_REQUEST',
        eventSequence: 5,
        sessionId: ids.sessionId,
        trackingNumber: ids.trackingNumber,
        functionCode: config.codes.FTC,
        status: 'PENDING'
    });

    // Call GIP
    const result = await GipService.fundsTransferCredit(
        {
            sessionId: transaction.session_id,
            trackingNumber: transaction.tracking_number,
            srcBankCode: transaction.src_bank_code,
            destBankCode: transaction.dest_bank_code,
            srcAccountNumber: transaction.src_account_number,
            destAccountNumber: transaction.dest_account_number,
            srcAccountName: transaction.src_account_name,
            destAccountName: transaction.dest_account_name,
            amountFormatted: transaction.amount_formatted,
            narration: transaction.narration
        },
        ids.sessionId,
        ids.trackingNumber
    );

    // Update event with request/response data
    await EventModel.updateGipEvent({
        transactionId: transaction.id,
        eventType: 'FTC_REQUEST',
        requestPayload: result.payload,
        responsePayload: result.data,
        actionCode: result.actionCode,
        status: GipService.isAsync(result.actionCode) ? 'PENDING_CALLBACK' :
               GipService.isSuccess(result.actionCode) ? 'SUCCESS' : 'FAILED',
        durationMs: result.duration
    });

    return result;
};

/**
 * Process Reversal (called by worker when FTC fails)
 */
const processReversal = async (transaction) => {
    // Generate new IDs for reversal
    const ids = await TransactionModel.generateIds();

    // Update reversal info
    await TransactionModel.updateReversalInfo(
        transaction.id,
        ids.sessionId,
        ids.trackingNumber
    );

    // Create initial event record
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: 'REVERSAL_REQUEST',
        eventSequence: 7,
        sessionId: ids.sessionId,
        trackingNumber: ids.trackingNumber,
        functionCode: config.codes.FTD,
        status: 'PENDING'
    });

    // Call GIP
    const result = await GipService.reversal(
        {
            srcBankCode: transaction.src_bank_code,
            destBankCode: transaction.dest_bank_code,
            srcAccountNumber: transaction.src_account_number,
            destAccountNumber: transaction.dest_account_number,
            srcAccountName: transaction.src_account_name,
            destAccountName: transaction.dest_account_name,
            amountFormatted: transaction.amount_formatted,
            narration: transaction.narration
        },
        ids.sessionId,
        ids.trackingNumber
    );

    // Update event with request/response data
    await EventModel.updateGipEvent({
        transactionId: transaction.id,
        eventType: 'REVERSAL_REQUEST',
        requestPayload: result.payload,
        responsePayload: result.data,
        actionCode: result.actionCode,
        status: GipService.isAsync(result.actionCode) ? 'PENDING_CALLBACK' :
               GipService.isSuccess(result.actionCode) ? 'SUCCESS' : 'FAILED',
        durationMs: result.duration
    });

    return result;
};

/**
 * Process TSQ (called by worker)
 */
const processTsq = async (transaction, type) => {
    const result = await GipService.transactionStatusQuery({
        sessionId: transaction.session_id,
        trackingNumber: transaction.tracking_number,
        srcBankCode: transaction.src_bank_code,
        destBankCode: transaction.dest_bank_code,
        srcAccountNumber: transaction.src_account_number,
        destAccountNumber: transaction.dest_account_number,
        amountFormatted: transaction.amount_formatted,
        narration: transaction.narration
    });

    // Determine action based on response
    const action = GipService.determineTsqAction(result.actionCode, result.statusCode);

    // Log TSQ event with full data
    await EventModel.logGipEvent({
        transactionId: transaction.id,
        eventType: `${type}_TSQ_RESPONSE`,
        eventSequence: 99,
        sessionId: transaction.session_id,
        trackingNumber: transaction.tracking_number,
        functionCode: config.codes.TSQ,
        requestPayload: result.payload,
        responsePayload: result.data,
        actionCode: result.actionCode,
        status: action.action,
        durationMs: result.duration,
        responseReceivedAt: new Date()
    });

    return { ...result, ...action };
};

/**
 * Manual FTC - Admin can trigger FTC for FTD_SUCCESS transactions
 */
const manualFtc = async (transactionId, triggeredBy) => {
    const transaction = await TransactionModel.findById(transactionId);

    if (!transaction) {
        throw { status: 404, message: 'Transaction not found' };
    }

    if (transaction.status !== 'FTD_SUCCESS') {
        throw {
            status: 400,
            message: `Cannot initiate FTC. Transaction status is ${transaction.status}, expected FTD_SUCCESS`
        };
    }

    // Audit log
    await EventModel.createAuditLog({
        entityType: 'transaction',
        entityId: transactionId,
        action: 'MANUAL_FTC_INITIATED',
        oldValue: { status: transaction.status },
        triggeredBy
    });

    // Process FTC
    const result = await processFtc(transaction);

    return {
        success: true,
        message: 'Manual FTC initiated',
        transactionId,
        actionCode: result.actionCode
    };
};

/**
 * Manual Reversal - Admin can trigger reversal for stuck transactions
 */
const manualReversal = async (transactionId, triggeredBy, reason) => {
    const transaction = await TransactionModel.findById(transactionId);

    if (!transaction) {
        throw { status: 404, message: 'Transaction not found' };
    }

    // Check if reversal is valid for this status
    const allowedStatuses = ['FTD_SUCCESS', 'FTC_FAILED', 'FTC_PENDING', 'FTC_TSQ'];
    if (!allowedStatuses.includes(transaction.status)) {
        throw {
            status: 400,
            message: `Cannot reverse. Transaction status is ${transaction.status}. Allowed: ${allowedStatuses.join(', ')}`
        };
    }

    // Audit log
    await EventModel.createAuditLog({
        entityType: 'transaction',
        entityId: transactionId,
        action: 'MANUAL_REVERSAL_INITIATED',
        oldValue: { status: transaction.status },
        newValue: { reason },
        triggeredBy
    });

    // Mark for reversal
    await TransactionModel.markForReversal(transactionId);

    // Process reversal immediately
    const result = await processReversal(transaction);

    return {
        success: true,
        message: 'Manual reversal initiated',
        transactionId,
        actionCode: result.actionCode,
        reason
    };
};

/**
 * Retry TSQ - Admin can trigger TSQ for stuck transactions
 */
const manualTsq = async (transactionId, triggeredBy) => {
    const transaction = await TransactionModel.findById(transactionId);

    if (!transaction) {
        throw { status: 404, message: 'Transaction not found' };
    }

    // Determine type based on status
    let type;
    if (transaction.status.includes('FTD')) type = 'FTD';
    else if (transaction.status.includes('FTC')) type = 'FTC';
    else if (transaction.status.includes('REVERSAL')) type = 'REVERSAL';
    else {
        throw { status: 400, message: `Cannot TSQ for status: ${transaction.status}` };
    }

    // Audit log
    await EventModel.createAuditLog({
        entityType: 'transaction',
        entityId: transactionId,
        action: 'MANUAL_TSQ_INITIATED',
        oldValue: { status: transaction.status },
        triggeredBy
    });

    // Process TSQ
    const result = await processTsq(transaction, type);

    return {
        success: true,
        message: 'Manual TSQ completed',
        transactionId,
        type,
        actionCode: result.actionCode,
        statusCode: result.statusCode,
        action: result.action
    };
};

/**
 * Get transaction status
 */
const getTransaction = async (id, institutionId) => {
    const transaction = await TransactionModel.findById(id, institutionId);
    if (!transaction) {
        throw { status: 404, message: 'Transaction not found' };
    }

    // Get events
    const events = await EventModel.findByTransactionId(id);

    return { ...transaction, events };
};

/**
 * List transactions
 */
const listTransactions = async (filters) => {
    return TransactionModel.findAll(filters);
};

/**
 * Get statistics
 */
const getStats = async () => {
    return TransactionModel.getStats();
};

/**
 * Queue client callback
 */
const queueClientCallback = async (transactionId, institutionId, callbackUrl, payload) => {
    await CallbackModel.createClientCallback({
        transactionId,
        institutionId,
        callbackUrl,
        payload
    });
};

module.exports = {
    validateRequest,
    createTransaction,
    processNameEnquiry,
    initiateFundsTransfer,
    processFtc,
    processReversal,
    processTsq,
    manualFtc,
    manualReversal,
    manualTsq,
    getTransaction,
    listTransactions,
    getStats,
    queueClientCallback
};
