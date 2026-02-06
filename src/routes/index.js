/**
 * API Routes
 * Clean route definitions with middleware
 */

const express = require('express');
const router = express.Router();

// Controllers
const {
    InstitutionController,
    TransactionController,
    CallbackController,
    AdminController
} = require('../controllers');

// Middleware
const {
    authenticate,
    rateLimit,
    checkPermission,
    validate
} = require('../middleware');

// Feature Routes
const featureRoutes = require('./feature.routes');

// ============================================================================
// Institution Management Routes (Admin)
// ============================================================================

router.post('/institutions',
    validate('institution'),
    InstitutionController.create
);

router.get('/institutions',
    InstitutionController.list
);

router.get('/institutions/:id',
    InstitutionController.get
);

router.put('/institutions/:id',
    validate('institution'),
    InstitutionController.update
);

router.delete('/institutions/:id',
    InstitutionController.delete
);

router.post('/institutions/:id/credentials',
    validate('credential'),
    InstitutionController.generateCredentials
);

router.get('/institutions/:id/credentials',
    InstitutionController.listCredentials
);

router.delete('/institutions/:institutionId/credentials/:credentialId',
    InstitutionController.revokeCredential
);

// ============================================================================
// Transaction Routes (Institution API)
// ============================================================================

/**
 * Name Enquiry (NEC) - Synchronous
 */
router.post('/nec',
    authenticate,
    rateLimit,
    checkPermission('nec'),
    validate('nec'),
    TransactionController.nameEnquiry
);

/**
 * Funds Transfer (FT) - Asynchronous
 */
router.post('/ft',
    authenticate,
    rateLimit,
    checkPermission('ft'),
    validate('ft'),
    TransactionController.fundsTransfer
);

/**
 * Transaction Status Query (TSQ)
 */
router.post('/tsq',
    authenticate,
    rateLimit,
    checkPermission('tsq'),
    validate('tsq'),
    TransactionController.statusQuery
);

/**
 * Get transaction by ID
 */
router.get('/transactions/:id',
    authenticate,
    TransactionController.getTransaction
);

/**
 * List transactions
 */
router.get('/transactions',
    authenticate,
    TransactionController.listTransactions
);

// ============================================================================
// GIP Callback Route (Internal)
// ============================================================================

/**
 * Receive GIP callbacks
 * Should be protected by IP whitelist in production
 */
router.post('/callback',
    CallbackController.receiveCallback
);

// ============================================================================
// Admin & Monitoring Routes
// ============================================================================

/**
 * Dashboard - Real-time stats
 */
router.get('/admin/dashboard',
    AdminController.getDashboard
);

/**
 * System health status
 */
router.get('/admin/health',
    AdminController.getSystemHealth
);

/**
 * Comprehensive monitoring report
 */
router.get('/admin/report',
    AdminController.getMonitoringReport
);

/**
 * Worker health status
 */
router.get('/admin/workers',
    AdminController.getWorkerHealth
);

/**
 * Hourly transaction trends
 */
router.get('/admin/trends/hourly',
    AdminController.getHourlyTrends
);

/**
 * Status breakdown
 */
router.get('/admin/status-breakdown',
    AdminController.getStatusBreakdown
);

/**
 * API performance metrics
 */
router.get('/admin/performance',
    AdminController.getApiPerformance
);

/**
 * Audit log
 */
router.get('/admin/audit',
    AdminController.getAuditLog
);

/**
 * Institution statistics
 */
router.get('/admin/institutions/stats',
    AdminController.getInstitutionStats
);

/**
 * Failed transactions
 */
router.get('/admin/transactions/failed',
    AdminController.getFailedTransactions
);

/**
 * Stuck transactions
 */
router.get('/admin/transactions/stuck',
    AdminController.getStuckTransactions
);

/**
 * All transactions (admin view)
 */
router.get('/admin/transactions',
    AdminController.getAllTransactions
);

/**
 * Transaction details (admin view)
 */
router.get('/admin/transactions/:id',
    AdminController.getTransactionDetails
);

/**
 * Transaction timeline
 */
router.get('/admin/transactions/:id/timeline',
    AdminController.getTransactionTimeline
);

/**
 * Manual FTC - Trigger FTC for FTD_SUCCESS transactions
 */
router.post('/admin/transactions/:id/ftc',
    AdminController.manualFtc
);

/**
 * Manual Reversal - Trigger reversal for stuck transactions
 */
router.post('/admin/transactions/:id/reversal',
    AdminController.manualReversal
);

/**
 * Manual TSQ - Query transaction status
 */
router.post('/admin/transactions/:id/tsq',
    AdminController.manualTsq
);

// ============================================================================
// Basic Routes
// ============================================================================

/**
 * Get statistics (legacy - use admin dashboard instead)
 */
router.get('/stats',
    TransactionController.getStats
);

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

// ============================================================================
// Feature Routes (Optional Features)
// ============================================================================

router.use('/features', featureRoutes);

module.exports = router;
