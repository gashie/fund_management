/**
 * Feature Routes
 * Routes for all optional features
 */

const express = require('express');
const router = express.Router();

const { FeatureController } = require('../controllers');
const { authenticate } = require('../middleware');

// ============================================================================
// Feature Status (No Auth Required)
// ============================================================================

/**
 * Get all feature status
 */
router.get('/status', FeatureController.getAllFeatureStatus);

/**
 * API Documentation
 */
router.get('/docs', FeatureController.getApiDocs);

// ============================================================================
// Security Features
// ============================================================================

router.get('/security/status', FeatureController.getSecurityStatus);

router.post('/security/rotate-key',
    authenticate,
    FeatureController.rotateApiKey
);

router.get('/security/fraud-alerts',
    authenticate,
    FeatureController.getFraudAlerts
);

// ============================================================================
// Operational Features
// ============================================================================

router.get('/operational/status', FeatureController.getOperationalStatus);

// Bulk Transactions
router.post('/bulk/batches',
    authenticate,
    FeatureController.createBulkBatch
);

router.get('/bulk/batches/:id',
    authenticate,
    FeatureController.getBulkBatch
);

// Scheduled Transfers
router.post('/scheduled',
    authenticate,
    FeatureController.createScheduledTransfer
);

router.delete('/scheduled/:id',
    authenticate,
    FeatureController.cancelScheduledTransfer
);

// Recurring Payments
router.post('/recurring',
    authenticate,
    FeatureController.createRecurringPayment
);

router.get('/recurring/:id',
    authenticate,
    FeatureController.getRecurringPayment
);

router.patch('/recurring/:id',
    authenticate,
    FeatureController.updateRecurringPayment
);

// Transaction Templates
router.post('/templates',
    authenticate,
    FeatureController.createTemplate
);

router.get('/templates',
    authenticate,
    FeatureController.listTemplates
);

router.get('/templates/:id',
    authenticate,
    FeatureController.getTemplate
);

router.delete('/templates/:id',
    authenticate,
    FeatureController.deleteTemplate
);

// Transaction Limits
router.get('/limits',
    authenticate,
    FeatureController.checkLimits
);

// ============================================================================
// Alerting & Monitoring Features
// ============================================================================

router.get('/alerting/status', FeatureController.getAlertingStatus);

router.get('/alerts', FeatureController.getAlerts);

router.post('/alerts/:id/acknowledge', FeatureController.acknowledgeAlert);

router.post('/alerts/:id/resolve', FeatureController.resolveAlert);

router.get('/sla', FeatureController.getSlaMetrics);

router.get('/anomalies', FeatureController.getAnomalies);

router.get('/uptime', FeatureController.getUptimeStatus);

// ============================================================================
// Reporting & Analytics Features
// ============================================================================

router.get('/reporting/status', FeatureController.getReportingStatus);

// Settlement Reports
router.post('/reports/settlement', FeatureController.generateSettlementReport);

router.get('/reports/settlement/:id', FeatureController.getSettlementReport);

router.get('/reports/:id/export', FeatureController.exportReport);

// Fee Configuration
router.get('/fees/config', FeatureController.getFeeConfigurations);

router.post('/fees/config', FeatureController.createFeeConfiguration);

// Invoices
router.get('/invoices', FeatureController.getInvoices);

router.post('/invoices', FeatureController.generateInvoice);

// Analytics
router.get('/analytics/trends', FeatureController.getTrendAnalysis);

// ============================================================================
// Resilience Features
// ============================================================================

router.get('/resilience/status', FeatureController.getResilienceStatus);

router.get('/circuit-breaker', FeatureController.getCircuitBreakerStatus);

router.post('/circuit-breaker/:serviceName/reset', FeatureController.resetCircuitBreaker);

router.get('/queue/stats', FeatureController.getQueueStats);

// ============================================================================
// Developer Features
// ============================================================================

router.get('/developer/status', FeatureController.getDeveloperStatus);

// Sandbox
router.get('/sandbox/history',
    authenticate,
    FeatureController.getSandboxHistory
);

router.delete('/sandbox',
    authenticate,
    FeatureController.clearSandboxData
);

// Request Logs
router.get('/logs', FeatureController.getRequestLogs);

router.get('/logs/stats', FeatureController.getRequestLogStats);

router.get('/logs/:id', FeatureController.getRequestLog);

// Webhook Testing
router.post('/webhook-test',
    authenticate,
    FeatureController.createWebhookTest
);

router.get('/webhook-test',
    authenticate,
    FeatureController.getWebhookTestHistory
);

router.get('/webhook-test/:id',
    authenticate,
    FeatureController.getWebhookTest
);

module.exports = router;
