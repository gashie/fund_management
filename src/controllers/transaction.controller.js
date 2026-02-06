/**
 * Transaction Controller
 * HTTP handlers for NEC, FT, and TSQ operations
 * No database queries - delegates to services
 */

const TransactionService = require('../services/transaction.service');
const TransactionModel = require('../models/transaction.model');

/**
 * Name Enquiry (NEC)
 * POST /nec
 *
 * Request: { srcBankCode, destBankCode, srcAccountNumber, destAccountNumber, referenceNumber, requestTimestamp }
 * Response: { responseCode, responseMessage, status, sessionId, destBankCode, destAccountNumber, destAccountName }
 */
exports.nameEnquiry = async (req, res, next) => {
    try {
        // Validate request
        await TransactionService.validateRequest(req.body, req.institution);

        // Create transaction
        const transaction = await TransactionService.createTransaction(
            {
                ...req.body,
                clientIp: req.ip,
                userAgent: req.headers['user-agent']
            },
            req.institution,
            'NEC'
        );

        // Process NEC (synchronous)
        const result = await TransactionService.processNameEnquiry(transaction);

        if (result.success) {
            res.json({
                responseCode: result.responseCode,
                responseMessage: 'Approved',
                status: 'SUCCESSFUL',
                sessionId: result.sessionId,
                destBankCode: req.body.destBankCode,
                destAccountNumber: req.body.destAccountNumber,
                destAccountName: result.destAccountName
            });
        } else {
            res.json({
                responseCode: result.responseCode,
                responseMessage: result.error || 'Failed',
                status: 'FAILED',
                sessionId: result.sessionId,
                destBankCode: req.body.destBankCode,
                destAccountNumber: req.body.destAccountNumber,
                destAccountName: null
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Funds Transfer (FT)
 * POST /ft
 *
 * Request: { srcBankCode, destBankCode, amount, srcAccountNumber, srcAccountName,
 *            destAccountNumber, destAccountName, narration, referenceNumber, requestTimestamp, callbackUrl }
 * Response: { responseCode, responseMessage, referenceNumber, sessionId }
 */
exports.fundsTransfer = async (req, res, next) => {
    try {
        // Validate request
        await TransactionService.validateRequest(req.body, req.institution);

        // Create transaction
        const transaction = await TransactionService.createTransaction(
            {
                ...req.body,
                clientIp: req.ip,
                userAgent: req.headers['user-agent']
            },
            req.institution,
            'FT'
        );

        // Initiate FTD (asynchronous - returns immediately)
        const result = await TransactionService.initiateFundsTransfer(transaction);

        res.status(202).json({
            responseCode: result.responseCode,
            responseMessage: result.success ? 'success' : 'failed',
            referenceNumber: req.body.referenceNumber,
            sessionId: result.sessionId
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Transaction Status Query (TSQ)
 * POST /tsq
 *
 * Request: { srcBankCode, transactionReferenceNumber, transactionTimestamp, requestTimestamp, referenceNumber }
 * Response: { referenceNumber, transactionReferenceNumber, sessionId, srcBankCode, srcAccountNumber,
 *             destBankCode, destAccountNumber, amount, narration, responseCode, responseMessage, status }
 */
exports.statusQuery = async (req, res, next) => {
    try {
        const { referenceNumber, transactionReferenceNumber, srcBankCode } = req.body;

        // Search by reference number (client's reference) or transactionReferenceNumber
        const searchRef = transactionReferenceNumber || referenceNumber;

        // Find the transaction
        let txn = await TransactionModel.findByReference(searchRef, req.institution.id);

        // If not found by exact match, try searching
        if (!txn) {
            const result = await TransactionService.listTransactions({
                institutionId: req.institution.id,
                referenceNumber: searchRef,
                limit: 1
            });

            if (result.data.length > 0) {
                txn = await TransactionModel.findById(result.data[0].id);
            }
        }

        if (!txn) {
            return res.status(404).json({
                responseCode: '381',
                responseMessage: 'Transaction not found',
                status: 'NOT_FOUND',
                referenceNumber,
                transactionReferenceNumber
            });
        }

        // Determine status text
        let statusText = 'PENDING';
        let responseMessage = 'Processing';
        let responseCode = '990';

        if (txn.status === 'COMPLETED') {
            statusText = 'SUCCESSFUL';
            responseMessage = 'Approved';
            responseCode = '000';
        } else if (txn.status === 'FAILED' || txn.status === 'TIMEOUT') {
            statusText = 'FAILED';
            responseMessage = txn.status_message || 'Transaction failed';
            responseCode = txn.ftd_action_code || txn.ftc_action_code || '999';
        }

        res.json({
            referenceNumber: referenceNumber,
            transactionReferenceNumber: txn.reference_number,
            sessionId: txn.session_id,
            srcBankCode: txn.src_bank_code,
            srcAccountNumber: txn.src_account_number,
            destBankCode: txn.dest_bank_code,
            destAccountNumber: txn.dest_account_number,
            amount: txn.amount ? txn.amount.toString() : '0',
            narration: txn.narration,
            responseCode,
            responseMessage,
            status: statusText
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get transaction by ID
 * GET /transactions/:id
 */
exports.getTransaction = async (req, res, next) => {
    try {
        const result = await TransactionService.getTransaction(req.params.id, req.institution.id);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List transactions
 * GET /transactions
 */
exports.listTransactions = async (req, res, next) => {
    try {
        const { page, limit, status, type, fromDate, toDate, referenceNumber } = req.query;

        const result = await TransactionService.listTransactions({
            institutionId: req.institution.id,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            status,
            type,
            fromDate,
            toDate,
            referenceNumber
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get statistics (admin)
 * GET /stats
 */
exports.getStats = async (req, res, next) => {
    try {
        const result = await TransactionService.getStats();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
