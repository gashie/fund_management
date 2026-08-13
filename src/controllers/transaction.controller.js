/**
 * Transaction Controller
 * Handles name enquiry, funds transfer and status query for clients.
 *
 */

const TransactionService = require('../services/transaction.service');
const TransactionModel = require('../models/transaction.model');
const { accepted, rejected, reasonFrom, isClientFault } = require('../utils/respond');

/**
 * Name Enquiry
 * POST /ne
 */
exports.nameEnquiry = async (req, res, next) => {
    try {
        await TransactionService.validateRequest(req.body, req.institution);

        const transaction = await TransactionService.createTransaction(
            { ...req.body, clientIp: req.ip, userAgent: req.headers['user-agent'] },
            req.institution,
            'NEC'
        );

        const result = await TransactionService.processNameEnquiry(transaction);

        if (result.success) {
            return accepted(res, {
                responseMessage: 'Approved',
                status: 'SUCCESSFUL',
                sessionId: result.sessionId,
                destBankCode: req.body.destBankCode,
                destAccountNumber: req.body.destAccountNumber,
                destAccountName: result.destAccountName
            });
        }

        // The account could not be checked. That is a rejection, not a broken request.
        return rejected(res, result.error || 'Name enquiry failed', {
            sessionId: result.sessionId,
            destBankCode: req.body.destBankCode,
            destAccountNumber: req.body.destAccountNumber,
            destAccountName: null
        });

    } catch (error) {
        if (isClientFault(error)) return rejected(res, reasonFrom(error));
        return next(error);
    }
};

/**
 * Funds Transfer
 * POST /ft
 */
exports.fundsTransfer = async (req, res, next) => {
    try {
        await TransactionService.validateRequest(req.body, req.institution);

        const transaction = await TransactionService.createTransaction(
            { ...req.body, clientIp: req.ip, userAgent: req.headers['user-agent'] },
            req.institution,
            'FT'
        );

        const result = await TransactionService.initiateFundsTransfer(transaction);

        // 200, not 202. The contract only ever uses 200 for an accepted request.
        return accepted(res, {
            responseMessage: 'success',
            referenceNumber: req.body.referenceNumber,
            sessionId: result.sessionId
        });

    } catch (error) {
        if (isClientFault(error)) {
            return rejected(res, reasonFrom(error), {
                referenceNumber: req.body.referenceNumber
            });
        }
        return next(error);
    }
};

/**
 * Transaction Status Query
 * POST /tsq
 */
exports.statusQuery = async (req, res, next) => {
    try {
        const { referenceNumber, transactionReferenceNumber } = req.body;
        const searchRef = transactionReferenceNumber || referenceNumber;

        let txn = await TransactionModel.findByReference(searchRef, req.institution.id);

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
            return rejected(res, 'Transaction not found', {
                referenceNumber,
                transactionReferenceNumber
            });
        }

        // Work out what to tell the client about this transaction.
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
        } else if (txn.status === 'MANUAL_REVERSAL_REQUIRED') {
            statusText = 'FAILED';
            responseMessage = 'Transaction failed - funds return pending';
            responseCode = txn.ftc_action_code || '999';
        } else if (txn.status === 'NEEDS_MANUAL_REVIEW') {
            // We genuinely do not know yet. Say so rather than guess.
            statusText = 'PENDING';
            responseMessage = 'Under review';
            responseCode = '990';
        }

        res.status(200).json({
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
        if (isClientFault(error)) return rejected(res, reasonFrom(error));
        return next(error);
    }
};

/**
 * Get transaction by id
 * GET /transactions/:id
 */
exports.getTransaction = async (req, res, next) => {
    try {
        const result = await TransactionService.getTransaction(req.params.id, req.institution.id);
        res.json({ success: true, data: result });
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

        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

/**
 * Statistics
 * GET /stats
 */
exports.getStats = async (req, res, next) => {
    try {
        const result = await TransactionService.getStats();
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
