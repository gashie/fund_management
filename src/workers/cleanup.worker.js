/**
 * Cleanup Worker
 * Cleans up old data - logs, idempotency keys, queue items, etc.
 */

const { query } = require('../models/db');
const config = require('../config');
const { ResilienceService, DeveloperService } = require('../services/features');

const POLL_INTERVAL = 3600000; // 1 hour

let isRunning = false;
let logger = console;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Cleanup expired idempotency keys
 */
const cleanupIdempotencyKeys = async () => {
    if (!config.features.idempotencyKeys) return { deleted: 0 };

    try {
        const result = await ResilienceService.cleanupIdempotencyKeys();
        return result;
    } catch (error) {
        logger.error('Idempotency key cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old queue items
 */
const cleanupQueueItems = async () => {
    if (!config.features.requestQueuing) return { deleted: 0 };

    try {
        const result = await ResilienceService.cleanupQueue(7); // 7 days
        return result;
    } catch (error) {
        logger.error('Queue cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old request logs
 */
const cleanupRequestLogs = async () => {
    if (!config.features.requestLogs) return { deleted: 0 };

    try {
        const result = await DeveloperService.cleanupRequestLogs(30); // 30 days
        return result;
    } catch (error) {
        logger.error('Request log cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old sandbox data
 */
const cleanupSandboxData = async () => {
    if (!config.features.sandboxMode) return { deleted: 0 };

    try {
        const result = await query(
            `DELETE FROM sandbox_transactions
             WHERE created_at < NOW() - INTERVAL '7 days'
             RETURNING id`
        );
        return { deleted: result.rowCount };
    } catch (error) {
        logger.error('Sandbox data cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old webhook tests
 */
const cleanupWebhookTests = async () => {
    if (!config.features.webhookTesting) return { deleted: 0 };

    try {
        const result = await query(
            `DELETE FROM webhook_tests
             WHERE created_at < NOW() - INTERVAL '30 days'
             RETURNING id`
        );
        return { deleted: result.rowCount };
    } catch (error) {
        logger.error('Webhook test cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old alerts
 */
const cleanupOldAlerts = async () => {
    try {
        const result = await query(
            `DELETE FROM system_alerts
             WHERE status = 'RESOLVED'
             AND resolved_at < NOW() - INTERVAL '90 days'
             RETURNING id`
        );
        return { deleted: result.rowCount };
    } catch (error) {
        logger.error('Alert cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old anomaly detections
 */
const cleanupAnomalyData = async () => {
    if (!config.features.anomalyDetection) return { deleted: 0 };

    try {
        const result = await query(
            `DELETE FROM anomaly_detections
             WHERE created_at < NOW() - INTERVAL '30 days'
             RETURNING id`
        );
        return { deleted: result.rowCount };
    } catch (error) {
        logger.error('Anomaly data cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old SLA metrics
 */
const cleanupSlaMetrics = async () => {
    if (!config.features.slaMonitoring) return { deleted: 0 };

    try {
        const result = await query(
            `DELETE FROM sla_metrics
             WHERE created_at < NOW() - INTERVAL '90 days'
             RETURNING id`
        );
        return { deleted: result.rowCount };
    } catch (error) {
        logger.error('SLA metrics cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old uptime checks
 */
const cleanupUptimeChecks = async () => {
    if (!config.features.uptimeMonitoring) return { deleted: 0 };

    try {
        const result = await query(
            `DELETE FROM uptime_checks
             WHERE check_time < NOW() - INTERVAL '30 days'
             RETURNING id`
        );
        return { deleted: result.rowCount };
    } catch (error) {
        logger.error('Uptime check cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Cleanup old API key rotations
 */
const cleanupApiKeyRotations = async () => {
    if (!config.features.apiKeyRotation) return { deleted: 0 };

    try {
        const result = await query(
            `DELETE FROM api_key_rotations
             WHERE rotated_at < NOW() - INTERVAL '90 days'
             RETURNING id`
        );
        return { deleted: result.rowCount };
    } catch (error) {
        logger.error('API key rotation cleanup error:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Run all cleanup tasks
 */
const runCleanup = async () => {
    logger.info('Starting cleanup cycle...');

    const results = {
        idempotencyKeys: await cleanupIdempotencyKeys(),
        queueItems: await cleanupQueueItems(),
        requestLogs: await cleanupRequestLogs(),
        sandboxData: await cleanupSandboxData(),
        webhookTests: await cleanupWebhookTests(),
        alerts: await cleanupOldAlerts(),
        anomalies: await cleanupAnomalyData(),
        slaMetrics: await cleanupSlaMetrics(),
        uptimeChecks: await cleanupUptimeChecks(),
        apiKeyRotations: await cleanupApiKeyRotations()
    };

    // Log summary
    const totalDeleted = Object.values(results).reduce(
        (sum, r) => sum + (r.deleted || 0), 0
    );

    if (totalDeleted > 0) {
        logger.info(`Cleanup completed: ${totalDeleted} records deleted`, results);
    } else {
        logger.info('Cleanup completed: no records to delete');
    }

    return results;
};

const start = async (customLogger) => {
    if (customLogger) logger = customLogger;
    isRunning = true;
    logger.info('Cleanup Worker started');

    // Run initial cleanup after a short delay
    await sleep(60000); // Wait 1 minute before first run

    while (isRunning) {
        try {
            await runCleanup();
        } catch (error) {
            logger.error('Cleanup Worker error:', error);
        }
        await sleep(POLL_INTERVAL);
    }
};

const stop = () => {
    isRunning = false;
    logger.info('Cleanup Worker stopped');
};

const getStatus = () => ({ isRunning, feature: 'cleanup' });

module.exports = {
    start,
    stop,
    getStatus,
    runCleanup,
    cleanupIdempotencyKeys,
    cleanupQueueItems,
    cleanupRequestLogs,
    cleanupSandboxData,
    cleanupWebhookTests,
    cleanupOldAlerts
};
