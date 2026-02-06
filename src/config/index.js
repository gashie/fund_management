/**
 * Application Configuration
 * All features can be enabled/disabled via environment variables
 */

require('dotenv').config({ path: './config.env' });

const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    return value === 'true' || value === '1' || value === true;
};

module.exports = {
    // Server
    port: process.env.PORT || 3002,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    db: {
        user: process.env.DATABASE_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DATABASE_NAME || 'fund_management',
        password: process.env.DATABASE_PASSWORD || 'admin',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    },

    // GIP API Endpoints
    gip: {
        baseUrl: process.env.GIP_BASE_URL || 'http://172.21.8.21:9000/SwitchGIP/WSGIP',
        necUrl: process.env.GIP_NEC_URL || 'http://172.21.8.21:9000/SwitchGIP/WSGIP',
        ftdUrl: process.env.GIP_FTD_URL || 'http://172.21.8.21:9000/SwitchGIP/WSGIP',
        ftcUrl: process.env.GIP_FTC_URL || 'http://172.21.8.21:9000/SwitchGIP/WSGIP',
        tsqUrl: process.env.GIP_TSQ_URL || 'http://172.21.8.21:9000/SwitchGIP/WSGIP',
        callbackUrl: process.env.GIP_CALLBACK_URL || 'http://localhost:3002/api/callback/gip',
        timeout: parseInt(process.env.GIP_TIMEOUT || '30000')
    },

    // Function Codes
    codes: {
        NEC: '230',
        FTD: '241',
        FTC: '240',
        TSQ: '111',
        CHANNEL: '100'
    },

    // TSQ Configuration
    tsq: {
        maxAttempts: parseInt(process.env.TSQ_MAX_ATTEMPTS || '3'),
        intervalMinutes: parseInt(process.env.TSQ_INTERVAL_MINUTES || '5'),
        inconclusiveCodes: ['909', '912', '990', null, undefined, '']
    },

    // Callback Configuration
    callback: {
        maxRetries: parseInt(process.env.CALLBACK_MAX_RETRIES || '5'),
        initialDelaySeconds: parseInt(process.env.CALLBACK_INITIAL_DELAY || '5'),
        backoffMultiplier: parseFloat(process.env.CALLBACK_BACKOFF_MULTIPLIER || '2'),
        maxDelaySeconds: parseInt(process.env.CALLBACK_MAX_DELAY || '3600')
    },

    // Timeout Configuration (in minutes)
    timeout: {
        nec: parseInt(process.env.TIMEOUT_NEC || '1'),
        ftdCallback: parseInt(process.env.TIMEOUT_FTD_CALLBACK || '30'),
        ftcCallback: parseInt(process.env.TIMEOUT_FTC_CALLBACK || '30'),
        transaction: parseInt(process.env.TIMEOUT_TRANSACTION || '60')
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },

    // =========================================================================
    // FEATURE FLAGS - Enable/Disable features via environment variables
    // =========================================================================
    features: {
        // Security Features (all disabled except fraud detection)
        ipWhitelist: parseBoolean(process.env.FEATURE_IP_WHITELIST, false),
        requestSigning: parseBoolean(process.env.FEATURE_REQUEST_SIGNING, false),
        apiKeyRotation: parseBoolean(process.env.FEATURE_API_KEY_ROTATION, false),
        fraudDetection: parseBoolean(process.env.FEATURE_FRAUD_DETECTION, true),
        encryptionAtRest: parseBoolean(process.env.FEATURE_ENCRYPTION_AT_REST, false),
        rateLimitTiers: parseBoolean(process.env.FEATURE_RATE_LIMIT_TIERS, false),

        // Operational Features (enabled by default)
        bulkTransactions: parseBoolean(process.env.FEATURE_BULK_TRANSACTIONS, true),
        scheduledTransfers: parseBoolean(process.env.FEATURE_SCHEDULED_TRANSFERS, true),
        recurringPayments: parseBoolean(process.env.FEATURE_RECURRING_PAYMENTS, true),
        transactionTemplates: parseBoolean(process.env.FEATURE_TRANSACTION_TEMPLATES, true),
        batchProcessing: parseBoolean(process.env.FEATURE_BATCH_PROCESSING, true),
        transactionLimits: parseBoolean(process.env.FEATURE_TRANSACTION_LIMITS, true),
        businessHours: parseBoolean(process.env.FEATURE_BUSINESS_HOURS, true),

        // Monitoring & Alerting (enabled by default)
        realTimeAlerts: parseBoolean(process.env.FEATURE_REALTIME_ALERTS, true),
        thresholdAlerts: parseBoolean(process.env.FEATURE_THRESHOLD_ALERTS, true),
        slaMonitoring: parseBoolean(process.env.FEATURE_SLA_MONITORING, true),
        anomalyDetection: parseBoolean(process.env.FEATURE_ANOMALY_DETECTION, true),
        uptimeMonitoring: parseBoolean(process.env.FEATURE_UPTIME_MONITORING, true),

        // Reporting & Analytics (enabled by default)
        settlementReports: parseBoolean(process.env.FEATURE_SETTLEMENT_REPORTS, true),
        feeCalculation: parseBoolean(process.env.FEATURE_FEE_CALCULATION, true),
        exportReports: parseBoolean(process.env.FEATURE_EXPORT_REPORTS, true),
        scheduledReports: parseBoolean(process.env.FEATURE_SCHEDULED_REPORTS, true),
        institutionBilling: parseBoolean(process.env.FEATURE_INSTITUTION_BILLING, true),
        trendAnalysis: parseBoolean(process.env.FEATURE_TREND_ANALYSIS, true),

        // Resilience & Performance (disabled by default)
        circuitBreaker: parseBoolean(process.env.FEATURE_CIRCUIT_BREAKER, false),
        requestQueuing: parseBoolean(process.env.FEATURE_REQUEST_QUEUING, false),
        idempotencyKeys: parseBoolean(process.env.FEATURE_IDEMPOTENCY_KEYS, false),

        // Developer Experience (disabled by default)
        sandboxMode: parseBoolean(process.env.FEATURE_SANDBOX_MODE, false),
        apiDocumentation: parseBoolean(process.env.FEATURE_API_DOCUMENTATION, false),
        webhookTesting: parseBoolean(process.env.FEATURE_WEBHOOK_TESTING, false),
        requestLogs: parseBoolean(process.env.FEATURE_REQUEST_LOGS, false)
    },

    // =========================================================================
    // FEATURE CONFIGURATIONS
    // =========================================================================

    // Security Configuration
    security: {
        // Request Signing
        signatureHeader: 'X-Signature',
        signatureTimestampHeader: 'X-Timestamp',
        signatureValiditySeconds: parseInt(process.env.SIGNATURE_VALIDITY_SECONDS || '300'),

        // API Key Rotation
        keyRotationDays: parseInt(process.env.KEY_ROTATION_DAYS || '90'),
        keyRotationWarningDays: parseInt(process.env.KEY_ROTATION_WARNING_DAYS || '14'),
        keyGracePeriodHours: parseInt(process.env.KEY_GRACE_PERIOD_HOURS || '24'),

        // Encryption
        encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me',
        encryptionAlgorithm: 'aes-256-gcm',

        // Fraud Detection Thresholds
        fraud: {
            maxTransactionsPerMinute: parseInt(process.env.FRAUD_MAX_TXN_PER_MIN || '10'),
            maxAmountPerTransaction: parseFloat(process.env.FRAUD_MAX_AMOUNT || '1000000'),
            maxDailyAmount: parseFloat(process.env.FRAUD_MAX_DAILY_AMOUNT || '10000000'),
            suspiciousHoursStart: parseInt(process.env.FRAUD_SUSPICIOUS_HOUR_START || '0'),
            suspiciousHoursEnd: parseInt(process.env.FRAUD_SUSPICIOUS_HOUR_END || '5'),
            velocityWindowMinutes: parseInt(process.env.FRAUD_VELOCITY_WINDOW || '5')
        }
    },

    // Operational Configuration
    operational: {
        // Bulk Transactions
        bulkMaxSize: parseInt(process.env.BULK_MAX_SIZE || '100'),
        bulkProcessingMode: process.env.BULK_PROCESSING_MODE || 'parallel', // parallel or sequential

        // Scheduled Transfers
        scheduledMaxDaysAhead: parseInt(process.env.SCHEDULED_MAX_DAYS_AHEAD || '365'),

        // Recurring Payments
        recurringMaxOccurrences: parseInt(process.env.RECURRING_MAX_OCCURRENCES || '999'),

        // Transaction Limits
        limits: {
            defaultDailyLimit: parseFloat(process.env.DEFAULT_DAILY_LIMIT || '10000000'),
            defaultMonthlyLimit: parseFloat(process.env.DEFAULT_MONTHLY_LIMIT || '100000000'),
            defaultPerTransactionLimit: parseFloat(process.env.DEFAULT_PER_TXN_LIMIT || '5000000')
        },

        // Business Hours (24-hour format)
        businessHours: {
            timezone: process.env.BUSINESS_HOURS_TIMEZONE || 'Africa/Accra',
            startHour: parseInt(process.env.BUSINESS_HOURS_START || '8'),
            endHour: parseInt(process.env.BUSINESS_HOURS_END || '18'),
            workDays: (process.env.BUSINESS_WORK_DAYS || '1,2,3,4,5').split(',').map(Number) // 0=Sun, 6=Sat
        }
    },

    // Alerting Configuration
    alerting: {
        // Slack
        slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        slackChannel: process.env.SLACK_CHANNEL || '#alerts',

        // Email
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: process.env.SMTP_PASSWORD || '',
        alertEmailFrom: process.env.ALERT_EMAIL_FROM || 'alerts@fundmanagement.local',
        alertEmailTo: (process.env.ALERT_EMAIL_TO || '').split(',').filter(Boolean),

        // SMS (Twilio)
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
        twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
        alertSmsTo: (process.env.ALERT_SMS_TO || '').split(',').filter(Boolean),

        // Thresholds
        thresholds: {
            failureRatePercent: parseFloat(process.env.ALERT_FAILURE_RATE || '10'),
            responseTimeMs: parseInt(process.env.ALERT_RESPONSE_TIME_MS || '5000'),
            pendingTransactions: parseInt(process.env.ALERT_PENDING_COUNT || '100'),
            stuckTransactionsMinutes: parseInt(process.env.ALERT_STUCK_MINUTES || '30')
        },

        // SLA Configuration
        sla: {
            necResponseTimeMs: parseInt(process.env.SLA_NEC_RESPONSE_MS || '3000'),
            ftdResponseTimeMs: parseInt(process.env.SLA_FTD_RESPONSE_MS || '5000'),
            callbackDeliverySeconds: parseInt(process.env.SLA_CALLBACK_DELIVERY_SEC || '60'),
            uptimePercent: parseFloat(process.env.SLA_UPTIME_PERCENT || '99.9')
        }
    },

    // Reporting Configuration
    reporting: {
        // Settlement
        settlementTime: process.env.SETTLEMENT_TIME || '23:59',
        settlementTimezone: process.env.SETTLEMENT_TIMEZONE || 'Africa/Accra',

        // Fees
        defaultFeePercent: parseFloat(process.env.DEFAULT_FEE_PERCENT || '0.5'),
        defaultFeeMin: parseFloat(process.env.DEFAULT_FEE_MIN || '1'),
        defaultFeeMax: parseFloat(process.env.DEFAULT_FEE_MAX || '100'),
        defaultFeeCap: parseFloat(process.env.DEFAULT_FEE_CAP || '50'),

        // Export
        exportFormats: ['csv', 'pdf', 'xlsx'],
        maxExportRows: parseInt(process.env.MAX_EXPORT_ROWS || '100000'),

        // Scheduled Reports
        reportSchedule: process.env.REPORT_SCHEDULE || '0 6 * * *', // 6 AM daily
        reportRecipients: (process.env.REPORT_RECIPIENTS || '').split(',').filter(Boolean)
    },

    // Resilience Configuration
    resilience: {
        // Circuit Breaker
        circuitBreaker: {
            failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD || '5'),
            successThreshold: parseInt(process.env.CB_SUCCESS_THRESHOLD || '3'),
            timeout: parseInt(process.env.CB_TIMEOUT_MS || '30000'),
            resetTimeout: parseInt(process.env.CB_RESET_TIMEOUT_MS || '60000')
        },

        // Request Queuing
        queue: {
            maxSize: parseInt(process.env.QUEUE_MAX_SIZE || '1000'),
            processingConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10'),
            retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3')
        },

        // Idempotency
        idempotency: {
            keyHeader: 'X-Idempotency-Key',
            ttlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '86400') // 24 hours
        }
    },

    // Sandbox Configuration
    sandbox: {
        defaultActionCode: process.env.SANDBOX_DEFAULT_ACTION_CODE || '000',
        simulateDelay: parseBoolean(process.env.SANDBOX_SIMULATE_DELAY, true),
        delayMs: parseInt(process.env.SANDBOX_DELAY_MS || '500'),
        failureRate: parseFloat(process.env.SANDBOX_FAILURE_RATE || '0'), // 0-100
        randomAccountNames: [
            'JOHN DOE', 'JANE SMITH', 'KWAME ASANTE', 'AMA MENSAH',
            'KOFI ADJEI', 'ABENA OSEI', 'YAW BOATENG', 'EFUA OWUSU'
        ]
    }
};
