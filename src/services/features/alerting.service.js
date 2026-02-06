/**
 * Alerting Service
 * Handles real-time alerts, threshold monitoring, SLA tracking, anomaly detection, uptime monitoring
 */

const config = require('../../config');
const { query } = require('../../models/db');
const axios = require('axios');
const nodemailer = require('nodemailer');

// ============================================================================
// ALERT CREATION AND SENDING
// ============================================================================

/**
 * Create and send alert
 */
const createAlert = async (alertType, severity, title, message, details = {}) => {
    if (!config.features.realTimeAlerts) {
        console.log(`[ALERT DISABLED] ${severity}: ${title} - ${message}`);
        return null;
    }

    // Save to database
    const result = await query(`
        INSERT INTO system_alerts (alert_type, severity, title, message, details, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        RETURNING *
    `, [alertType, severity, title, message, JSON.stringify(details)]);

    const alert = result.rows[0];

    // Send notifications based on severity
    const notificationPromises = [];

    if (['WARNING', 'ERROR', 'CRITICAL'].includes(severity)) {
        notificationPromises.push(sendSlackAlert(alert));
    }

    if (['ERROR', 'CRITICAL'].includes(severity)) {
        notificationPromises.push(sendEmailAlert(alert));
    }

    if (severity === 'CRITICAL') {
        notificationPromises.push(sendSmsAlert(alert));
    }

    await Promise.allSettled(notificationPromises);

    return alert;
};

/**
 * Send Slack notification
 */
const sendSlackAlert = async (alert) => {
    if (!config.alerting.slackWebhookUrl) return;

    try {
        const color = {
            'INFO': '#36a64f',
            'WARNING': '#ffcc00',
            'ERROR': '#ff6600',
            'CRITICAL': '#ff0000'
        }[alert.severity] || '#cccccc';

        await axios.post(config.alerting.slackWebhookUrl, {
            channel: config.alerting.slackChannel,
            attachments: [{
                color,
                title: `${alert.severity}: ${alert.title}`,
                text: alert.message,
                fields: [
                    { title: 'Type', value: alert.alert_type, short: true },
                    { title: 'Time', value: new Date(alert.created_at).toISOString(), short: true }
                ],
                footer: 'Fund Management System'
            }]
        });

        await query(`UPDATE system_alerts SET slack_sent = true, slack_sent_at = CURRENT_TIMESTAMP WHERE id = $1`, [alert.id]);
    } catch (error) {
        console.error('Failed to send Slack alert:', error.message);
    }
};

/**
 * Send email notification
 */
const sendEmailAlert = async (alert) => {
    if (!config.alerting.smtpHost || config.alerting.alertEmailTo.length === 0) return;

    try {
        const transporter = nodemailer.createTransport({
            host: config.alerting.smtpHost,
            port: config.alerting.smtpPort,
            secure: config.alerting.smtpPort === 465,
            auth: config.alerting.smtpUser ? {
                user: config.alerting.smtpUser,
                pass: config.alerting.smtpPassword
            } : undefined
        });

        await transporter.sendMail({
            from: config.alerting.alertEmailFrom,
            to: config.alerting.alertEmailTo.join(', '),
            subject: `[${alert.severity}] ${alert.title}`,
            html: `
                <h2 style="color: ${alert.severity === 'CRITICAL' ? 'red' : 'orange'}">${alert.title}</h2>
                <p>${alert.message}</p>
                <hr>
                <p><strong>Type:</strong> ${alert.alert_type}</p>
                <p><strong>Severity:</strong> ${alert.severity}</p>
                <p><strong>Time:</strong> ${new Date(alert.created_at).toISOString()}</p>
                ${alert.details ? `<p><strong>Details:</strong> <pre>${JSON.stringify(alert.details, null, 2)}</pre></p>` : ''}
                <hr>
                <p style="color: gray;">Fund Management System Alert</p>
            `
        });

        await query(`UPDATE system_alerts SET email_sent = true, email_sent_at = CURRENT_TIMESTAMP WHERE id = $1`, [alert.id]);
    } catch (error) {
        console.error('Failed to send email alert:', error.message);
    }
};

/**
 * Send SMS notification
 */
const sendSmsAlert = async (alert) => {
    if (!config.alerting.twilioAccountSid || config.alerting.alertSmsTo.length === 0) return;

    try {
        const client = require('twilio')(config.alerting.twilioAccountSid, config.alerting.twilioAuthToken);

        for (const to of config.alerting.alertSmsTo) {
            await client.messages.create({
                body: `[${alert.severity}] ${alert.title}: ${alert.message}`,
                from: config.alerting.twilioFromNumber,
                to
            });
        }

        await query(`UPDATE system_alerts SET sms_sent = true, sms_sent_at = CURRENT_TIMESTAMP WHERE id = $1`, [alert.id]);
    } catch (error) {
        console.error('Failed to send SMS alert:', error.message);
    }
};

// ============================================================================
// THRESHOLD MONITORING
// ============================================================================

/**
 * Check all thresholds (optimized: single query for all metrics)
 */
const checkThresholds = async () => {
    if (!config.features.thresholdAlerts) return [];

    const alerts = [];
    const { thresholds } = config.alerting;

    // Single optimized query for all threshold checks
    const metricsResult = await query(`
        SELECT
            COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour' AND status = 'FAILED') as failed_1h,
            COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour') as total_1h,
            COUNT(*) FILTER (WHERE status IN ('INITIATED', 'NEC_PENDING', 'FTD_PENDING', 'FTC_PENDING')) as pending_count,
            COUNT(*) FILTER (WHERE status IN ('FTD_PENDING', 'FTC_PENDING', 'FTD_TSQ', 'FTC_TSQ')
                AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 minute' * $1) as stuck_count,
            COUNT(*) FILTER (WHERE status = 'REVERSAL_FAILED') as reversal_failed
        FROM transactions
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
           OR status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')
    `, [thresholds.stuckTransactionsMinutes]);

    const metrics = metricsResult.rows[0];

    // 1. Check failure rate
    const total = parseInt(metrics.total_1h);
    if (total > 0) {
        const failed = parseInt(metrics.failed_1h);
        const failureRate = (failed / total) * 100;
        if (failureRate >= thresholds.failureRatePercent) {
            alerts.push(await createAlert(
                'FAILURE_RATE',
                failureRate >= thresholds.failureRatePercent * 2 ? 'CRITICAL' : 'ERROR',
                'High Transaction Failure Rate',
                `Failure rate is ${failureRate.toFixed(1)}% (threshold: ${thresholds.failureRatePercent}%)`,
                { failureRate, failed, total }
            ));
        }
    }

    // 2. Check pending transactions count
    const pendingCount = parseInt(metrics.pending_count);
    if (pendingCount >= thresholds.pendingTransactions) {
        alerts.push(await createAlert(
            'PENDING_COUNT',
            pendingCount >= thresholds.pendingTransactions * 2 ? 'ERROR' : 'WARNING',
            'High Pending Transaction Count',
            `${pendingCount} pending transactions (threshold: ${thresholds.pendingTransactions})`,
            { pendingCount }
        ));
    }

    // 3. Check stuck transactions
    const stuckCount = parseInt(metrics.stuck_count);
    if (stuckCount > 0) {
        alerts.push(await createAlert(
            'STUCK_TRANSACTIONS',
            stuckCount >= 10 ? 'CRITICAL' : 'ERROR',
            'Stuck Transactions Detected',
            `${stuckCount} transactions stuck for more than ${thresholds.stuckTransactionsMinutes} minutes`,
            { stuckCount }
        ));
    }

    // 4. Check failed reversals (always critical)
    const reversalCount = parseInt(metrics.reversal_failed);
    if (reversalCount > 0) {
        alerts.push(await createAlert(
            'REVERSAL_FAILED',
            'CRITICAL',
            'Failed Reversals Require Attention',
            `${reversalCount} transactions have failed reversals requiring manual intervention`,
            { reversalCount }
        ));
    }

    return alerts.filter(Boolean);
};

// ============================================================================
// SLA MONITORING
// ============================================================================

/**
 * Record SLA metrics
 */
const recordSlaMetrics = async () => {
    if (!config.features.slaMonitoring) return;

    const now = new Date();
    const hour = now.getHours();
    const today = now.toISOString().split('T')[0];

    // Get hourly metrics
    const metricsResult = await query(`
        SELECT
            COUNT(*) FILTER (WHERE transaction_type = 'NEC') as nec_total,
            COUNT(*) FILTER (WHERE transaction_type = 'NEC' AND status = 'COMPLETED') as nec_success,
            COUNT(*) FILTER (WHERE transaction_type = 'FT') as ft_total,
            COUNT(*) FILTER (WHERE transaction_type = 'FT' AND status = 'COMPLETED') as ft_success
        FROM transactions
        WHERE DATE(created_at) = $1 AND EXTRACT(HOUR FROM created_at) = $2
    `, [today, hour]);

    const metrics = metricsResult.rows[0];

    // Upsert metrics
    await query(`
        INSERT INTO sla_metrics (metric_date, metric_hour, nec_total_count, nec_success_count, ft_total_count, ft_success_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (metric_date, metric_hour) DO UPDATE SET
            nec_total_count = $3,
            nec_success_count = $4,
            ft_total_count = $5,
            ft_success_count = $6
    `, [today, hour, metrics.nec_total, metrics.nec_success, metrics.ft_total, metrics.ft_success]);
};

/**
 * Check SLA breaches
 */
const checkSlaBreaches = async () => {
    if (!config.features.slaMonitoring) return [];

    const alerts = [];
    const { sla } = config.alerting;

    // Check response time SLA
    const responseResult = await query(`
        SELECT
            AVG(duration_ms) FILTER (WHERE event_type LIKE 'NEC%') as nec_avg,
            AVG(duration_ms) FILTER (WHERE event_type LIKE 'FTD%') as ftd_avg
        FROM gip_events
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
          AND duration_ms IS NOT NULL
    `);

    const { nec_avg, ftd_avg } = responseResult.rows[0];

    if (nec_avg && parseFloat(nec_avg) > sla.necResponseTimeMs) {
        alerts.push(await createAlert(
            'SLA_BREACH',
            'WARNING',
            'NEC Response Time SLA Breach',
            `Average NEC response time ${Math.round(nec_avg)}ms exceeds SLA of ${sla.necResponseTimeMs}ms`,
            { avgResponseTime: Math.round(nec_avg), slaLimit: sla.necResponseTimeMs }
        ));
    }

    if (ftd_avg && parseFloat(ftd_avg) > sla.ftdResponseTimeMs) {
        alerts.push(await createAlert(
            'SLA_BREACH',
            'WARNING',
            'FTD Response Time SLA Breach',
            `Average FTD response time ${Math.round(ftd_avg)}ms exceeds SLA of ${sla.ftdResponseTimeMs}ms`,
            { avgResponseTime: Math.round(ftd_avg), slaLimit: sla.ftdResponseTimeMs }
        ));
    }

    return alerts.filter(Boolean);
};

/**
 * Get SLA report
 */
const getSlaReport = async (dateFrom, dateTo) => {
    const result = await query(`
        SELECT
            SUM(nec_total_count) as nec_total,
            SUM(nec_success_count) as nec_success,
            SUM(ft_total_count) as ft_total,
            SUM(ft_success_count) as ft_success,
            SUM(nec_sla_breaches) as nec_breaches,
            SUM(ft_sla_breaches) as ft_breaches,
            AVG(uptime_percent) as avg_uptime
        FROM sla_metrics
        WHERE metric_date BETWEEN $1 AND $2
    `, [dateFrom, dateTo]);

    const metrics = result.rows[0];

    return {
        period: { from: dateFrom, to: dateTo },
        nec: {
            total: parseInt(metrics.nec_total) || 0,
            successful: parseInt(metrics.nec_success) || 0,
            successRate: metrics.nec_total > 0 ? ((metrics.nec_success / metrics.nec_total) * 100).toFixed(2) : 0,
            slaBreaches: parseInt(metrics.nec_breaches) || 0
        },
        ft: {
            total: parseInt(metrics.ft_total) || 0,
            successful: parseInt(metrics.ft_success) || 0,
            successRate: metrics.ft_total > 0 ? ((metrics.ft_success / metrics.ft_total) * 100).toFixed(2) : 0,
            slaBreaches: parseInt(metrics.ft_breaches) || 0
        },
        uptime: parseFloat(metrics.avg_uptime) || 100
    };
};

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Detect anomalies in transaction patterns
 */
const detectAnomalies = async () => {
    if (!config.features.anomalyDetection) return [];

    const alerts = [];

    // 1. Volume spike detection (compare to same hour last week)
    const volumeResult = await query(`
        WITH current_hour AS (
            SELECT COUNT(*) as count FROM transactions
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        ),
        baseline AS (
            SELECT AVG(hourly_count) as avg_count, STDDEV(hourly_count) as stddev
            FROM (
                SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as hourly_count
                FROM transactions
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
                  AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
                GROUP BY DATE_TRUNC('hour', created_at)
            ) hourly
        )
        SELECT c.count, b.avg_count, b.stddev
        FROM current_hour c, baseline b
    `);

    const { count, avg_count, stddev } = volumeResult.rows[0];
    if (avg_count && stddev) {
        const zScore = (parseInt(count) - parseFloat(avg_count)) / parseFloat(stddev);
        if (Math.abs(zScore) > 2) {
            const anomalyType = zScore > 0 ? 'VOLUME_SPIKE' : 'VOLUME_DROP';
            const severity = Math.abs(zScore) > 3 ? 'ERROR' : 'WARNING';

            await query(`
                INSERT INTO anomaly_detections (anomaly_type, description, expected_value, actual_value, deviation_percent, details)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [anomalyType, `Transaction volume anomaly detected`, avg_count, count, ((count - avg_count) / avg_count * 100), JSON.stringify({ zScore })]);

            alerts.push(await createAlert(
                anomalyType,
                severity,
                `Transaction Volume ${zScore > 0 ? 'Spike' : 'Drop'} Detected`,
                `Current volume ${count} is ${Math.abs(zScore).toFixed(1)} standard deviations from average ${Math.round(avg_count)}`,
                { count, avgCount: Math.round(avg_count), zScore: zScore.toFixed(2) }
            ));
        }
    }

    // 2. Failure spike detection
    const failureResult = await query(`
        WITH current_failures AS (
            SELECT COUNT(*) FILTER (WHERE status = 'FAILED') * 100.0 / NULLIF(COUNT(*), 0) as rate
            FROM transactions
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        ),
        baseline AS (
            SELECT AVG(failure_rate) as avg_rate
            FROM (
                SELECT DATE_TRUNC('hour', created_at) as hour,
                       COUNT(*) FILTER (WHERE status = 'FAILED') * 100.0 / NULLIF(COUNT(*), 0) as failure_rate
                FROM transactions
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
                GROUP BY DATE_TRUNC('hour', created_at)
            ) hourly
            WHERE failure_rate IS NOT NULL
        )
        SELECT c.rate, b.avg_rate
        FROM current_failures c, baseline b
    `);

    const { rate, avg_rate } = failureResult.rows[0];
    if (rate && avg_rate && parseFloat(rate) > parseFloat(avg_rate) * 2) {
        await query(`
            INSERT INTO anomaly_detections (anomaly_type, description, expected_value, actual_value, deviation_percent)
            VALUES ('FAILURE_SPIKE', 'Failure rate anomaly detected', $1, $2, $3)
        `, [avg_rate, rate, ((rate - avg_rate) / avg_rate * 100)]);

        alerts.push(await createAlert(
            'FAILURE_SPIKE',
            'ERROR',
            'Failure Rate Spike Detected',
            `Current failure rate ${parseFloat(rate).toFixed(1)}% is significantly higher than average ${parseFloat(avg_rate).toFixed(1)}%`,
            { currentRate: parseFloat(rate).toFixed(1), avgRate: parseFloat(avg_rate).toFixed(1) }
        ));
    }

    return alerts.filter(Boolean);
};

// ============================================================================
// UPTIME MONITORING
// ============================================================================

/**
 * Check GIP endpoint health
 * Note: GIP is a SOAP service - we use a simple TCP connect check via GET/POST
 * since HEAD requests don't work on SOAP endpoints
 */
const checkEndpointHealth = async () => {
    if (!config.features.uptimeMonitoring) return [];

    // For SOAP services, we just check if the URL is reachable
    // A 500 error or connection refused = unhealthy
    // Any other response (even 400/405) = healthy (service is running)
    const endpoints = [
        { name: 'GIP', url: config.gip.baseUrl }
    ];

    const results = [];

    for (const endpoint of endpoints) {
        const startTime = Date.now();
        let isHealthy = false;
        let statusCode = null;
        let errorMessage = null;

        try {
            // Use GET - SOAP services will return 405 or similar, which means it's alive
            const response = await axios.get(endpoint.url, {
                timeout: 5000,
                validateStatus: () => true // Accept any status code
            });
            // Service is healthy if we get any response (even 405 Method Not Allowed)
            isHealthy = response.status < 500;
            statusCode = response.status;
        } catch (error) {
            // Connection refused, timeout, etc = unhealthy
            errorMessage = error.code === 'ECONNREFUSED' ? 'Connection refused' :
                          error.code === 'ETIMEDOUT' ? 'Connection timeout' :
                          error.message;
            statusCode = error.response?.status || null;
        }

        const responseTime = Date.now() - startTime;

        // Log check
        await query(`
            INSERT INTO uptime_checks (endpoint, is_healthy, response_time_ms, status_code, error_message)
            VALUES ($1, $2, $3, $4, $5)
        `, [endpoint.name, isHealthy, responseTime, statusCode, errorMessage]);

        results.push({ endpoint: endpoint.name, isHealthy, responseTime, statusCode, error: errorMessage });

        // Alert if unhealthy
        if (!isHealthy) {
            await createAlert(
                'GIP_DOWN',
                'CRITICAL',
                `GIP Service Unreachable`,
                `GIP endpoint ${endpoint.url} is not responding: ${errorMessage || `HTTP ${statusCode}`}`,
                { endpoint: endpoint.name, url: endpoint.url, statusCode, error: errorMessage }
            );
        }
    }

    return results;
};

/**
 * Get uptime statistics
 */
const getUptimeStats = async (hours = 24) => {
    const result = await query(`
        SELECT
            endpoint,
            COUNT(*) as total_checks,
            COUNT(*) FILTER (WHERE is_healthy = true) as healthy_checks,
            AVG(response_time_ms) as avg_response_time,
            MAX(response_time_ms) as max_response_time,
            MIN(response_time_ms) as min_response_time
        FROM uptime_checks
        WHERE check_time > CURRENT_TIMESTAMP - INTERVAL '1 hour' * $1
        GROUP BY endpoint
    `, [hours]);

    return result.rows.map(row => ({
        endpoint: row.endpoint,
        totalChecks: parseInt(row.total_checks),
        healthyChecks: parseInt(row.healthy_checks),
        uptimePercent: ((row.healthy_checks / row.total_checks) * 100).toFixed(2),
        avgResponseTime: Math.round(row.avg_response_time || 0),
        maxResponseTime: Math.round(row.max_response_time || 0),
        minResponseTime: Math.round(row.min_response_time || 0)
    }));
};

// ============================================================================
// ALERT MANAGEMENT
// ============================================================================

/**
 * Acknowledge alert
 */
const acknowledgeAlert = async (alertId, acknowledgedBy) => {
    await query(`
        UPDATE system_alerts
        SET status = 'ACKNOWLEDGED', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [acknowledgedBy, alertId]);
};

/**
 * Resolve alert
 */
const resolveAlert = async (alertId) => {
    await query(`
        UPDATE system_alerts SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [alertId]);
};

/**
 * Get active alerts
 */
const getActiveAlerts = async () => {
    const result = await query(`
        SELECT * FROM system_alerts
        WHERE status IN ('ACTIVE', 'ACKNOWLEDGED')
        ORDER BY
            CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'ERROR' THEN 2 WHEN 'WARNING' THEN 3 ELSE 4 END,
            created_at DESC
    `);
    return result.rows;
};

module.exports = {
    // Alert Creation
    createAlert,
    sendSlackAlert,
    sendEmailAlert,
    sendSmsAlert,

    // Threshold Monitoring
    checkThresholds,

    // SLA Monitoring
    recordSlaMetrics,
    checkSlaBreaches,
    getSlaReport,

    // Anomaly Detection
    detectAnomalies,

    // Uptime Monitoring
    checkEndpointHealth,
    getUptimeStats,

    // Alert Management
    acknowledgeAlert,
    resolveAlert,
    getActiveAlerts
};
