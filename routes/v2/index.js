/**
 * API Routes v2 - Improved Fund Management API
 *
 * Endpoints:
 * - POST /api/v2/institutions - Create institution
 * - POST /api/v2/institutions/:id/credentials - Generate API credentials
 * - POST /api/v2/nec - Name Enquiry (sync)
 * - POST /api/v2/ft - Funds Transfer (async with callback)
 * - POST /api/v2/tsq - Transaction Status Query
 * - POST /api/v2/gip/callback - Receive GIP callbacks
 * - GET  /api/v2/transactions/:id - Get transaction status
 * - GET  /api/v2/transactions - List transactions (with filters)
 */

const express = require('express');
const router = express.Router();

// Import middleware
const {
    authenticateInstitution,
    checkRateLimit,
    checkPermission,
    validateParticipants,
    checkDuplicateReference,
    generateTransactionIds,
    createTransaction
} = require('../../middleware/transaction');

// Import controllers
const institutionController = require('../../controllers/v2/institutions');
const transactionController = require('../../controllers/v2/transactions');
const callbackController = require('../../controllers/v2/callbacks');

// Import validators
const { validateRequest } = require('../../middleware/v2/validator');
const {
    institutionSchema,
    credentialSchema,
    necSchema,
    ftSchema,
    tsqSchema
} = require('../../validation/v2/schemas');

// ============================================================================
// Institution Management Routes (Admin)
// ============================================================================

/**
 * Create a new institution
 */
router.post('/institutions',
    // TODO: Add admin authentication
    validateRequest(institutionSchema),
    institutionController.createInstitution
);

/**
 * List all institutions
 */
router.get('/institutions',
    // TODO: Add admin authentication
    institutionController.listInstitutions
);

/**
 * Get institution details
 */
router.get('/institutions/:id',
    // TODO: Add admin authentication
    institutionController.getInstitution
);

/**
 * Update institution
 */
router.put('/institutions/:id',
    // TODO: Add admin authentication
    validateRequest(institutionSchema),
    institutionController.updateInstitution
);

/**
 * Generate API credentials for institution
 */
router.post('/institutions/:id/credentials',
    // TODO: Add admin authentication
    validateRequest(credentialSchema),
    institutionController.generateCredentials
);

/**
 * List credentials for institution
 */
router.get('/institutions/:id/credentials',
    // TODO: Add admin authentication
    institutionController.listCredentials
);

/**
 * Revoke credential
 */
router.delete('/institutions/:institutionId/credentials/:credentialId',
    // TODO: Add admin authentication
    institutionController.revokeCredential
);

// ============================================================================
// Transaction Routes (Institution API)
// ============================================================================

/**
 * Name Enquiry (NEC) - Synchronous
 * Returns account name for verification before transfer
 */
router.post('/nec',
    authenticateInstitution,
    checkRateLimit,
    checkPermission('nec'),
    validateRequest(necSchema),
    validateParticipants,
    checkDuplicateReference,
    generateTransactionIds,
    createTransaction('NEC'),
    transactionController.nameEnquiry
);

/**
 * Funds Transfer (FT) - Asynchronous
 * Initiates FTD, returns immediately, callback sent on completion
 */
router.post('/ft',
    authenticateInstitution,
    checkRateLimit,
    checkPermission('ft'),
    validateRequest(ftSchema),
    validateParticipants,
    checkDuplicateReference,
    generateTransactionIds,
    createTransaction('FT'),
    transactionController.fundsTransfer
);

/**
 * Transaction Status Query (TSQ)
 * Check status of a previous transaction
 */
router.post('/tsq',
    authenticateInstitution,
    checkRateLimit,
    checkPermission('tsq'),
    validateRequest(tsqSchema),
    transactionController.statusQuery
);

/**
 * Get transaction by ID
 */
router.get('/transactions/:id',
    authenticateInstitution,
    transactionController.getTransaction
);

/**
 * List transactions with filters
 */
router.get('/transactions',
    authenticateInstitution,
    transactionController.listTransactions
);

// ============================================================================
// GIP Callback Routes (Internal)
// ============================================================================

/**
 * Receive callbacks from GIP
 * This endpoint should be protected by IP whitelist in production
 */
router.post('/gip/callback',
    callbackController.receiveCallback
);

// ============================================================================
// Health & Monitoring Routes
// ============================================================================

/**
 * Health check
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

/**
 * System stats (admin only)
 */
router.get('/stats',
    // TODO: Add admin authentication
    transactionController.getStats
);

module.exports = router;
