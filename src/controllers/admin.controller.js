/**
 * Admin Controller
 * Administrative operations and manual interventions
 */

const TransactionService = require('../services/transaction.service');
const MonitoringService = require('../services/monitoring.service');

/**
 * Manual FTC for FTD_SUCCESS transactions
 * POST /api/admin/transactions/:id/ftc
 */
const manualFtc = async (req, res, next) => {
    try {
        const { id } = req.params;
        const triggeredBy = req.adminUser || 'admin';

        const result = await TransactionService.manualFtc(id, triggeredBy);

        res.json({
            success: true,
            message: 'Manual FTC initiated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Manual Reversal for stuck transactions
 * POST /api/admin/transactions/:id/reversal
 */
const manualReversal = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const triggeredBy = req.adminUser || 'admin';

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Reason is required for manual reversal'
            });
        }

        const result = await TransactionService.manualReversal(id, triggeredBy, reason);

        res.json({
            success: true,
            message: 'Manual reversal initiated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Manual TSQ for transaction status query
 * POST /api/admin/transactions/:id/tsq
 */
const manualTsq = async (req, res, next) => {
    try {
        const { id } = req.params;
        const triggeredBy = req.adminUser || 'admin';

        const result = await TransactionService.manualTsq(id, triggeredBy);

        res.json({
            success: true,
            message: 'Manual TSQ completed',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard
 */
const getDashboard = async (req, res, next) => {
    try {
        const stats = await MonitoringService.getDashboardStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get system health status
 * GET /api/admin/health
 */
const getSystemHealth = async (req, res, next) => {
    try {
        const health = await MonitoringService.getSystemHealth();

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get failed transactions
 * GET /api/admin/transactions/failed
 */
const getFailedTransactions = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const transactions = await MonitoringService.getFailedTransactions(limit);

        res.json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get stuck transactions
 * GET /api/admin/transactions/stuck
 */
const getStuckTransactions = async (req, res, next) => {
    try {
        const minutes = parseInt(req.query.minutes) || 30;
        const transactions = await MonitoringService.getStuckTransactions(minutes);

        res.json({
            success: true,
            count: transactions.length,
            minutesThreshold: minutes,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get transaction timeline
 * GET /api/admin/transactions/:id/timeline
 */
const getTransactionTimeline = async (req, res, next) => {
    try {
        const { id } = req.params;
        const timeline = await MonitoringService.getTransactionTimeline(id);

        res.json({
            success: true,
            transactionId: id,
            data: timeline
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get hourly trends
 * GET /api/admin/trends/hourly
 */
const getHourlyTrends = async (req, res, next) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const trends = await MonitoringService.getHourlyTrends(hours);

        res.json({
            success: true,
            hours,
            data: trends
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get status breakdown
 * GET /api/admin/status-breakdown
 */
const getStatusBreakdown = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const dateFrom = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dateTo = to ? new Date(to) : new Date();

        const breakdown = await MonitoringService.getStatusBreakdown(dateFrom, dateTo);

        res.json({
            success: true,
            dateFrom,
            dateTo,
            data: breakdown
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get institution statistics
 * GET /api/admin/institutions/stats
 */
const getInstitutionStats = async (req, res, next) => {
    try {
        const stats = await MonitoringService.getInstitutionStats();

        res.json({
            success: true,
            count: stats.length,
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get API response times
 * GET /api/admin/performance
 */
const getApiPerformance = async (req, res, next) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const performance = await MonitoringService.getApiResponseTimes(hours);

        res.json({
            success: true,
            hours,
            data: performance
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get recent audit log
 * GET /api/admin/audit
 */
const getAuditLog = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = await MonitoringService.getRecentAuditLog(limit);

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
 * Get worker health
 * GET /api/admin/workers
 */
const getWorkerHealth = async (req, res, next) => {
    try {
        const health = await MonitoringService.getWorkerHealth();

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get comprehensive monitoring report
 * GET /api/admin/report
 */
const getMonitoringReport = async (req, res, next) => {
    try {
        const report = await MonitoringService.getMonitoringReport();

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all transactions (admin view - no institution filter)
 * GET /api/admin/transactions
 */
const getAllTransactions = async (req, res, next) => {
    try {
        const filters = {
            status: req.query.status,
            dateFrom: req.query.from ? new Date(req.query.from) : null,
            dateTo: req.query.to ? new Date(req.query.to) : null,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const transactions = await TransactionService.listTransactions(filters);

        res.json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get transaction details (admin view - full details)
 * GET /api/admin/transactions/:id
 */
const getTransactionDetails = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Admin can see any transaction (no institution filter)
        const transaction = await TransactionService.getTransaction(id);

        res.json({
            success: true,
            data: transaction
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    manualFtc,
    manualReversal,
    manualTsq,
    getDashboard,
    getSystemHealth,
    getFailedTransactions,
    getStuckTransactions,
    getTransactionTimeline,
    getHourlyTrends,
    getStatusBreakdown,
    getInstitutionStats,
    getApiPerformance,
    getAuditLog,
    getWorkerHealth,
    getMonitoringReport,
    getAllTransactions,
    getTransactionDetails
};
