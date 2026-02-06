/**
 * Feature Controller
 * Handles all optional feature endpoints
 */

const {
    SecurityService,
    OperationalService,
    AlertingService,
    ReportingService,
    ResilienceService,
    DeveloperService
} = require('../services/features');
const config = require('../config');

// ============================================================================
// Security Feature Endpoints
// ============================================================================

/**
 * Rotate API key
 * POST /api/features/security/rotate-key
 */
const rotateApiKey = async (req, res, next) => {
    try {
        if (!config.features.apiKeyRotation) {
            return res.status(400).json({
                success: false,
                error: 'API key rotation feature is not enabled'
            });
        }

        const institutionId = req.institution?.id;
        const { gracePeriodHours } = req.body;

        const result = await SecurityService.rotateApiKey(institutionId, gracePeriodHours);

        res.json({
            success: true,
            message: 'API key rotated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get fraud alerts
 * GET /api/features/security/fraud-alerts
 */
const getFraudAlerts = async (req, res, next) => {
    try {
        const institutionId = req.institution?.id;
        const { status, limit } = req.query;

        const alerts = await SecurityService.getFraudAlerts(
            institutionId,
            status,
            parseInt(limit) || 50
        );

        res.json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get security feature status
 * GET /api/features/security/status
 */
const getSecurityStatus = async (req, res, next) => {
    try {
        const status = SecurityService.getFeatureStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// Operational Feature Endpoints
// ============================================================================

/**
 * Create bulk batch
 * POST /api/features/bulk/batches
 */
const createBulkBatch = async (req, res, next) => {
    try {
        if (!config.features.bulkTransactions) {
            return res.status(400).json({
                success: false,
                error: 'Bulk transactions feature is not enabled'
            });
        }

        const institutionId = req.institution?.id;
        const { name, transactions, priority } = req.body;

        const batch = await OperationalService.createBulkBatch(
            institutionId,
            name,
            transactions,
            priority
        );

        res.status(201).json({
            success: true,
            message: 'Bulk batch created',
            data: batch
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get bulk batch status
 * GET /api/features/bulk/batches/:id
 */
const getBulkBatch = async (req, res, next) => {
    try {
        const { id } = req.params;
        const batch = await OperationalService.getBulkBatchStatus(id);

        if (!batch) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }

        res.json({
            success: true,
            data: batch
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create scheduled transfer
 * POST /api/features/scheduled
 */
const createScheduledTransfer = async (req, res, next) => {
    try {
        if (!config.features.scheduledTransfers) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled transfers feature is not enabled'
            });
        }

        const institutionId = req.institution?.id;
        const result = await OperationalService.createScheduledTransfer(
            institutionId,
            req.body
        );

        res.status(201).json({
            success: true,
            message: 'Scheduled transfer created',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel scheduled transfer
 * DELETE /api/features/scheduled/:id
 */
const cancelScheduledTransfer = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await OperationalService.cancelScheduledTransfer(id);

        res.json({
            success: true,
            message: 'Scheduled transfer cancelled',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create recurring payment
 * POST /api/features/recurring
 */
const createRecurringPayment = async (req, res, next) => {
    try {
        if (!config.features.recurringPayments) {
            return res.status(400).json({
                success: false,
                error: 'Recurring payments feature is not enabled'
            });
        }

        const institutionId = req.institution?.id;
        const result = await OperationalService.createRecurringPayment(
            institutionId,
            req.body
        );

        res.status(201).json({
            success: true,
            message: 'Recurring payment created',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get recurring payment status
 * GET /api/features/recurring/:id
 */
const getRecurringPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payment = await OperationalService.getRecurringPaymentStatus(id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Recurring payment not found'
            });
        }

        res.json({
            success: true,
            data: payment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Pause/resume recurring payment
 * PATCH /api/features/recurring/:id
 */
const updateRecurringPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'pause' or 'resume'

        let result;
        if (action === 'pause') {
            result = await OperationalService.pauseRecurringPayment(id);
        } else if (action === 'resume') {
            result = await OperationalService.resumeRecurringPayment(id);
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid action. Use "pause" or "resume"'
            });
        }

        res.json({
            success: true,
            message: `Recurring payment ${action}d`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create transaction template
 * POST /api/features/templates
 */
const createTemplate = async (req, res, next) => {
    try {
        if (!config.features.transactionTemplates) {
            return res.status(400).json({
                success: false,
                error: 'Transaction templates feature is not enabled'
            });
        }

        const institutionId = req.institution?.id;
        const template = await OperationalService.createTemplate(
            institutionId,
            req.body
        );

        res.status(201).json({
            success: true,
            message: 'Template created',
            data: template
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List templates
 * GET /api/features/templates
 */
const listTemplates = async (req, res, next) => {
    try {
        const institutionId = req.institution?.id;
        const templates = await OperationalService.listTemplates(institutionId);

        res.json({
            success: true,
            count: templates.length,
            data: templates
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get template
 * GET /api/features/templates/:id
 */
const getTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const template = await OperationalService.getTemplate(id);

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }

        res.json({
            success: true,
            data: template
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete template
 * DELETE /api/features/templates/:id
 */
const deleteTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        await OperationalService.deleteTemplate(id);

        res.json({
            success: true,
            message: 'Template deleted'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Check transaction limits
 * GET /api/features/limits
 */
const checkLimits = async (req, res, next) => {
    try {
        const institutionId = req.institution?.id;
        const { amount, type } = req.query;

        if (amount && type) {
            const check = await OperationalService.checkTransactionLimits(
                institutionId,
                type,
                parseFloat(amount)
            );

            res.json({
                success: true,
                data: check
            });
        } else {
            const limits = await OperationalService.getInstitutionLimits(institutionId);

            res.json({
                success: true,
                data: limits
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Get operational feature status
 * GET /api/features/operational/status
 */
const getOperationalStatus = async (req, res, next) => {
    try {
        const status = OperationalService.getFeatureStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// Alerting & Monitoring Endpoints
// ============================================================================

/**
 * Get alerts
 * GET /api/features/alerts
 */
const getAlerts = async (req, res, next) => {
    try {
        const { severity, status, limit } = req.query;

        const alerts = await AlertingService.getAlerts({
            severity,
            status,
            limit: parseInt(limit) || 50
        });

        res.json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Acknowledge alert
 * POST /api/features/alerts/:id/acknowledge
 */
const acknowledgeAlert = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { acknowledgedBy } = req.body;

        const result = await AlertingService.acknowledgeAlert(id, acknowledgedBy || 'admin');

        res.json({
            success: true,
            message: 'Alert acknowledged',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Resolve alert
 * POST /api/features/alerts/:id/resolve
 */
const resolveAlert = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { resolvedBy, resolution } = req.body;

        const result = await AlertingService.resolveAlert(
            id,
            resolvedBy || 'admin',
            resolution
        );

        res.json({
            success: true,
            message: 'Alert resolved',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get SLA metrics
 * GET /api/features/sla
 */
const getSlaMetrics = async (req, res, next) => {
    try {
        const { hours } = req.query;
        const metrics = await AlertingService.getSlaMetrics(parseInt(hours) || 24);

        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get anomalies
 * GET /api/features/anomalies
 */
const getAnomalies = async (req, res, next) => {
    try {
        const { hours, institutionId } = req.query;

        const anomalies = await AlertingService.getRecentAnomalies(
            parseInt(hours) || 24,
            institutionId
        );

        res.json({
            success: true,
            count: anomalies.length,
            data: anomalies
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get uptime status
 * GET /api/features/uptime
 */
const getUptimeStatus = async (req, res, next) => {
    try {
        const { hours } = req.query;
        const status = await AlertingService.getUptimeStatus(parseInt(hours) || 24);

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get alerting feature status
 * GET /api/features/alerting/status
 */
const getAlertingStatus = async (req, res, next) => {
    try {
        const status = AlertingService.getFeatureStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// Reporting & Analytics Endpoints
// ============================================================================

/**
 * Generate settlement report
 * POST /api/features/reports/settlement
 */
const generateSettlementReport = async (req, res, next) => {
    try {
        if (!config.features.settlementReports) {
            return res.status(400).json({
                success: false,
                error: 'Settlement reports feature is not enabled'
            });
        }

        const { startDate, endDate, institutionId } = req.body;

        const report = await ReportingService.generateSettlementReport(
            new Date(startDate),
            new Date(endDate),
            institutionId
        );

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get settlement report
 * GET /api/features/reports/settlement/:id
 */
const getSettlementReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const report = await ReportingService.getSettlementReport(id);

        if (!report) {
            return res.status(404).json({
                success: false,
                error: 'Report not found'
            });
        }

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Export report
 * GET /api/features/reports/:id/export
 */
const exportReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { format } = req.query;

        const exportData = await ReportingService.exportReport(id, format || 'json');

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=report-${id}.csv`);
            res.send(exportData);
        } else {
            res.json({
                success: true,
                data: exportData
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Get fee configurations
 * GET /api/features/fees/config
 */
const getFeeConfigurations = async (req, res, next) => {
    try {
        const institutionId = req.query.institutionId || req.institution?.id;
        const configs = await ReportingService.getFeeConfigurations(institutionId);

        res.json({
            success: true,
            data: configs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create fee configuration
 * POST /api/features/fees/config
 */
const createFeeConfiguration = async (req, res, next) => {
    try {
        const config = await ReportingService.configureFee(req.body);

        res.status(201).json({
            success: true,
            message: 'Fee configuration created',
            data: config
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get institution invoices
 * GET /api/features/invoices
 */
const getInvoices = async (req, res, next) => {
    try {
        const institutionId = req.query.institutionId || req.institution?.id;
        const { status, limit } = req.query;

        const invoices = await ReportingService.getInstitutionInvoices(
            institutionId,
            status,
            parseInt(limit) || 20
        );

        res.json({
            success: true,
            count: invoices.length,
            data: invoices
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Generate invoice
 * POST /api/features/invoices
 */
const generateInvoice = async (req, res, next) => {
    try {
        const { institutionId, month, year } = req.body;

        const invoice = await ReportingService.generateInvoice(
            institutionId,
            parseInt(month),
            parseInt(year)
        );

        res.status(201).json({
            success: true,
            message: 'Invoice generated',
            data: invoice
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get trend analysis
 * GET /api/features/analytics/trends
 */
const getTrendAnalysis = async (req, res, next) => {
    try {
        const { days, institutionId } = req.query;

        const trends = await ReportingService.analyzeTrends(
            parseInt(days) || 30,
            institutionId
        );

        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get reporting feature status
 * GET /api/features/reporting/status
 */
const getReportingStatus = async (req, res, next) => {
    try {
        const status = ReportingService.getFeatureStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// Resilience Feature Endpoints
// ============================================================================

/**
 * Get circuit breaker status
 * GET /api/features/circuit-breaker
 */
const getCircuitBreakerStatus = async (req, res, next) => {
    try {
        const states = await ResilienceService.getAllCircuitStates();

        res.json({
            success: true,
            data: states
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reset circuit breaker
 * POST /api/features/circuit-breaker/:serviceName/reset
 */
const resetCircuitBreaker = async (req, res, next) => {
    try {
        const { serviceName } = req.params;
        const result = await ResilienceService.resetCircuitBreaker(serviceName);

        res.json({
            success: true,
            message: 'Circuit breaker reset',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get request queue stats
 * GET /api/features/queue/stats
 */
const getQueueStats = async (req, res, next) => {
    try {
        const stats = await ResilienceService.getQueueStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get resilience feature status
 * GET /api/features/resilience/status
 */
const getResilienceStatus = async (req, res, next) => {
    try {
        const status = ResilienceService.getFeatureStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// Developer Experience Endpoints
// ============================================================================

/**
 * Get sandbox history
 * GET /api/features/sandbox/history
 */
const getSandboxHistory = async (req, res, next) => {
    try {
        if (!config.features.sandboxMode) {
            return res.status(400).json({
                success: false,
                error: 'Sandbox mode is not enabled'
            });
        }

        const { type, limit } = req.query;
        const institutionId = req.institution?.id;

        const history = await DeveloperService.getSandboxHistory({
            type,
            limit: parseInt(limit) || 50,
            institutionId
        });

        res.json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Clear sandbox data
 * DELETE /api/features/sandbox
 */
const clearSandboxData = async (req, res, next) => {
    try {
        const institutionId = req.institution?.id;
        const result = await DeveloperService.clearSandboxData(institutionId);

        res.json({
            success: true,
            message: 'Sandbox data cleared',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get request logs
 * GET /api/features/logs
 */
const getRequestLogs = async (req, res, next) => {
    try {
        if (!config.features.requestLogs) {
            return res.status(400).json({
                success: false,
                error: 'Request logging is not enabled'
            });
        }

        const options = {
            institutionId: req.query.institutionId || req.institution?.id,
            method: req.query.method,
            path: req.query.path,
            statusCode: req.query.statusCode ? parseInt(req.query.statusCode) : null,
            startDate: req.query.from ? new Date(req.query.from) : null,
            endDate: req.query.to ? new Date(req.query.to) : null,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const logs = await DeveloperService.getRequestLogs(options);

        res.json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get request log by ID
 * GET /api/features/logs/:id
 */
const getRequestLog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const log = await DeveloperService.getRequestLog(id);

        if (!log) {
            return res.status(404).json({
                success: false,
                error: 'Log not found'
            });
        }

        res.json({
            success: true,
            data: log
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get request log statistics
 * GET /api/features/logs/stats
 */
const getRequestLogStats = async (req, res, next) => {
    try {
        const institutionId = req.query.institutionId || req.institution?.id;
        const hours = parseInt(req.query.hours) || 24;

        const stats = await DeveloperService.getRequestLogStats(institutionId, hours);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create webhook test
 * POST /api/features/webhook-test
 */
const createWebhookTest = async (req, res, next) => {
    try {
        if (!config.features.webhookTesting) {
            return res.status(400).json({
                success: false,
                error: 'Webhook testing is not enabled'
            });
        }

        const institutionId = req.institution?.id;
        const result = await DeveloperService.createWebhookTest(institutionId, req.body);

        res.status(201).json({
            success: true,
            message: 'Webhook test initiated',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get webhook test result
 * GET /api/features/webhook-test/:id
 */
const getWebhookTest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const test = await DeveloperService.getWebhookTest(id);

        if (!test) {
            return res.status(404).json({
                success: false,
                error: 'Webhook test not found'
            });
        }

        res.json({
            success: true,
            data: test
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get webhook test history
 * GET /api/features/webhook-test
 */
const getWebhookTestHistory = async (req, res, next) => {
    try {
        const institutionId = req.institution?.id;
        const limit = parseInt(req.query.limit) || 20;

        const history = await DeveloperService.getWebhookTestHistory(institutionId, limit);

        res.json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get API documentation
 * GET /api/features/docs
 */
const getApiDocs = async (req, res, next) => {
    try {
        const spec = DeveloperService.generateOpenAPISpec();

        res.json(spec);
    } catch (error) {
        next(error);
    }
};

/**
 * Get developer feature status
 * GET /api/features/developer/status
 */
const getDeveloperStatus = async (req, res, next) => {
    try {
        const status = DeveloperService.getFeatureStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// Combined Feature Status
// ============================================================================

/**
 * Get all feature status
 * GET /api/features/status
 */
const getAllFeatureStatus = async (req, res, next) => {
    try {
        const status = {
            security: SecurityService.getFeatureStatus(),
            operational: OperationalService.getFeatureStatus(),
            alerting: AlertingService.getFeatureStatus(),
            reporting: ReportingService.getFeatureStatus(),
            resilience: ResilienceService.getFeatureStatus(),
            developer: DeveloperService.getFeatureStatus()
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    // Security
    rotateApiKey,
    getFraudAlerts,
    getSecurityStatus,

    // Operational
    createBulkBatch,
    getBulkBatch,
    createScheduledTransfer,
    cancelScheduledTransfer,
    createRecurringPayment,
    getRecurringPayment,
    updateRecurringPayment,
    createTemplate,
    listTemplates,
    getTemplate,
    deleteTemplate,
    checkLimits,
    getOperationalStatus,

    // Alerting
    getAlerts,
    acknowledgeAlert,
    resolveAlert,
    getSlaMetrics,
    getAnomalies,
    getUptimeStatus,
    getAlertingStatus,

    // Reporting
    generateSettlementReport,
    getSettlementReport,
    exportReport,
    getFeeConfigurations,
    createFeeConfiguration,
    getInvoices,
    generateInvoice,
    getTrendAnalysis,
    getReportingStatus,

    // Resilience
    getCircuitBreakerStatus,
    resetCircuitBreaker,
    getQueueStats,
    getResilienceStatus,

    // Developer
    getSandboxHistory,
    clearSandboxData,
    getRequestLogs,
    getRequestLog,
    getRequestLogStats,
    createWebhookTest,
    getWebhookTest,
    getWebhookTestHistory,
    getApiDocs,
    getDeveloperStatus,

    // Combined
    getAllFeatureStatus
};
