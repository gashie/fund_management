/**
 * Monitoring Worker
 * Runs threshold checks, SLA monitoring, anomaly detection, and uptime checks
 */

const { query } = require('../models/db');
const config = require('../config');
const { AlertingService } = require('../services/features');

const POLL_INTERVAL = 60000; // 1 minute
const UPTIME_CHECK_INTERVAL = 300000; // 5 minutes

let isRunning = false;
let logger = console;
let lastUptimeCheck = 0;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run threshold monitoring
 */
const runThresholdChecks = async () => {
    if (!config.features.thresholdAlerts) return;

    try {
        const alerts = await AlertingService.checkThresholds();

        if (alerts.length > 0) {
            logger.info(`Threshold checks generated ${alerts.length} alerts`);
        }
    } catch (error) {
        logger.error('Threshold check error:', error);
    }
};

/**
 * Record SLA metrics
 */
const recordSlaMetrics = async () => {
    if (!config.features.slaMonitoring) return;

    try {
        // Get recent transaction stats for SLA
        const statsResult = await query(
            `SELECT
                'FT' as operation,
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_response_time,
                COUNT(*) as total_transactions,
                COUNT(*) FILTER (WHERE status = 'COMPLETED') as success_count,
                COUNT(*) FILTER (WHERE status = 'FAILED') as failure_count
             FROM transactions
             WHERE created_at > NOW() - INTERVAL '5 minutes'`
        );

        if (statsResult.rows[0].total_transactions > 0) {
            // Record metrics using the service
            await AlertingService.recordSlaMetrics();
        }
    } catch (error) {
        logger.error('SLA metric recording error:', error);
    }
};

/**
 * Run anomaly detection
 */
const runAnomalyDetection = async () => {
    if (!config.features.anomalyDetection) return;

    try {
        // Get institutions to check
        const institutionsResult = await query(
            `SELECT DISTINCT institution_id FROM transactions
             WHERE created_at > NOW() - INTERVAL '1 hour'`
        );

        for (const row of institutionsResult.rows) {
            await AlertingService.detectAnomalies(row.institution_id);
        }
    } catch (error) {
        logger.error('Anomaly detection error:', error);
    }
};

/**
 * Run uptime checks
 */
const runUptimeChecks = async () => {
    if (!config.features.uptimeMonitoring) return;

    const now = Date.now();
    if (now - lastUptimeCheck < UPTIME_CHECK_INTERVAL) {
        return;
    }
    lastUptimeCheck = now;

    try {
        // Use the endpoint health check from AlertingService
        const results = await AlertingService.checkEndpointHealth();
        if (results && results.length > 0) {
            const unhealthy = results.filter(r => !r.isHealthy);
            if (unhealthy.length > 0) {
                logger.warn(`Uptime: ${unhealthy.length} endpoints unhealthy`);
            }
        }
    } catch (error) {
        logger.error('Uptime check error:', error.message);
    }
};

/**
 * Check for stuck transactions
 */
const checkStuckTransactions = async () => {
    try {
        const threshold = config.alerting?.thresholds?.stuckTransactionsMinutes || 30;

        const stuckResult = await query(
            `SELECT COUNT(*) as count
             FROM transactions
             WHERE status IN ('INITIATED', 'NEC_PENDING', 'FTD_PENDING', 'FTC_PENDING')
             AND created_at < NOW() - INTERVAL '1 minute' * $1`,
            [threshold]
        );

        const stuckCount = parseInt(stuckResult.rows[0].count);

        if (stuckCount > 0) {
            await AlertingService.createAlert(
                'STUCK_TRANSACTIONS',
                stuckCount > 10 ? 'CRITICAL' : 'WARNING',
                'Stuck Transactions Detected',
                `${stuckCount} transactions stuck for more than ${threshold} minutes`,
                { count: stuckCount, threshold }
            );
        }
    } catch (error) {
        logger.error('Stuck transaction check error:', error.message);
    }
};

/**
 * Main monitoring cycle
 */
const runMonitoringCycle = async () => {
    await Promise.all([
        runThresholdChecks(),
        recordSlaMetrics(),
        runAnomalyDetection(),
        runUptimeChecks(),
        checkStuckTransactions()
    ]);
};

const start = async (customLogger) => {
    // Check if any monitoring feature is enabled
    const anyEnabled = config.features.thresholdAlerts ||
        config.features.slaMonitoring ||
        config.features.anomalyDetection ||
        config.features.uptimeMonitoring;

    if (!anyEnabled) {
        console.log('All monitoring features are disabled');
        return;
    }

    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Monitoring Worker started');

    while (isRunning) {
        try {
            await runMonitoringCycle();
        } catch (error) {
            logger.error('Monitoring Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Monitoring Worker stopped');
};

const getStatus = () => ({
    isRunning,
    features: {
        thresholdAlerts: config.features.thresholdAlerts,
        slaMonitoring: config.features.slaMonitoring,
        anomalyDetection: config.features.anomalyDetection,
        uptimeMonitoring: config.features.uptimeMonitoring
    }
});

module.exports = {
    start,
    stop,
    getStatus,
    runThresholdChecks,
    recordSlaMetrics,
    runAnomalyDetection,
    runUptimeChecks,
    runMonitoringCycle
};
