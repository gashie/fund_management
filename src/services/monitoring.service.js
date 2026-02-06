/**
 * Monitoring Service
 * Business logic for system monitoring and dashboards
 */

const MonitoringModel = require('../models/monitoring.model');
const workerManager = require('../workers');

/**
 * Get real-time dashboard stats
 */
const getDashboardStats = async () => {
    return MonitoringModel.getDashboardStats();
};

/**
 * Get transaction status breakdown
 */
const getStatusBreakdown = async (dateFrom, dateTo) => {
    return MonitoringModel.getStatusBreakdown(dateFrom, dateTo);
};

/**
 * Get hourly transaction trends
 */
const getHourlyTrends = async (hours = 24) => {
    return MonitoringModel.getHourlyTrends(hours);
};

/**
 * Get institution statistics
 */
const getInstitutionStats = async () => {
    return MonitoringModel.getInstitutionStats();
};

/**
 * Get failed transactions needing attention
 */
const getFailedTransactions = async (limit = 50) => {
    return MonitoringModel.getFailedTransactions(limit);
};

/**
 * Get stuck transactions
 */
const getStuckTransactions = async (minutesThreshold = 30) => {
    return MonitoringModel.getStuckTransactions(minutesThreshold);
};

/**
 * Get API response times
 */
const getApiResponseTimes = async (hours = 24) => {
    return MonitoringModel.getApiResponseTimes(hours);
};

/**
 * Get recent audit log
 */
const getRecentAuditLog = async (limit = 100) => {
    return MonitoringModel.getRecentAuditLog(limit);
};

/**
 * Get transaction timeline
 */
const getTransactionTimeline = async (transactionId) => {
    return MonitoringModel.getTransactionTimeline(transactionId);
};

/**
 * Get worker health status
 */
const getWorkerHealth = async () => {
    const dbHealth = await MonitoringModel.getWorkerHealth();
    const workerStatus = workerManager.getStatus();

    return {
        ...dbHealth,
        workers: workerStatus
    };
};

/**
 * Get system health overview
 */
const getSystemHealth = async () => {
    const [dashboard, workerHealth] = await Promise.all([
        getDashboardStats(),
        getWorkerHealth()
    ]);

    const criticalIssues = [];

    // Check for critical issues
    if (dashboard.critical_reversal_failed > 0) {
        criticalIssues.push({
            type: 'REVERSAL_FAILED',
            count: dashboard.critical_reversal_failed,
            message: 'Transactions with failed reversals require immediate attention'
        });
    }

    if (dashboard.critical_timed_out > 0) {
        criticalIssues.push({
            type: 'TIMED_OUT',
            count: dashboard.critical_timed_out,
            message: 'Transactions have timed out and need verification'
        });
    }

    if (workerHealth.stale_callbacks > 0) {
        criticalIssues.push({
            type: 'STALE_CALLBACKS',
            count: workerHealth.stale_callbacks,
            message: 'Pending callbacks older than 5 minutes'
        });
    }

    if (workerHealth.overdue_tsq > 0) {
        criticalIssues.push({
            type: 'OVERDUE_TSQ',
            count: workerHealth.overdue_tsq,
            message: 'TSQ queries are overdue'
        });
    }

    if (workerHealth.stale_reversals > 0) {
        criticalIssues.push({
            type: 'STALE_REVERSALS',
            count: workerHealth.stale_reversals,
            message: 'Pending reversals older than 10 minutes'
        });
    }

    return {
        status: criticalIssues.length === 0 ? 'HEALTHY' : 'ATTENTION_REQUIRED',
        criticalIssues,
        dashboard,
        workerHealth,
        timestamp: new Date().toISOString()
    };
};

/**
 * Get comprehensive monitoring report
 */
const getMonitoringReport = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
        systemHealth,
        statusBreakdown,
        hourlyTrends,
        institutionStats,
        failedTransactions,
        stuckTransactions,
        apiResponseTimes,
        recentAudit
    ] = await Promise.all([
        getSystemHealth(),
        getStatusBreakdown(todayStart, now),
        getHourlyTrends(24),
        getInstitutionStats(),
        getFailedTransactions(20),
        getStuckTransactions(30),
        getApiResponseTimes(24),
        getRecentAuditLog(50)
    ]);

    return {
        generatedAt: new Date().toISOString(),
        systemHealth,
        statusBreakdown,
        hourlyTrends,
        institutionStats,
        failedTransactions,
        stuckTransactions,
        apiResponseTimes,
        recentAudit
    };
};

module.exports = {
    getDashboardStats,
    getStatusBreakdown,
    getHourlyTrends,
    getInstitutionStats,
    getFailedTransactions,
    getStuckTransactions,
    getApiResponseTimes,
    getRecentAuditLog,
    getTransactionTimeline,
    getWorkerHealth,
    getSystemHealth,
    getMonitoringReport
};
