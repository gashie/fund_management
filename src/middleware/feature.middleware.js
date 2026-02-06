/**
 * Feature Middleware
 * Optional feature-related middleware
 */

const config = require('../config');
const {
    SecurityService,
    ResilienceService,
    DeveloperService
} = require('../services/features');

/**
 * IP Whitelist Middleware
 * Validates request IP against institution whitelist
 */
const ipWhitelist = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.ipWhitelist) {
        return next();
    }

    // Skip if no institution (e.g., public endpoints)
    if (!req.institution) {
        return next();
    }

    try {
        const clientIp = getClientIp(req);
        const result = await SecurityService.validateIpWhitelist(
            req.institution.id,
            clientIp
        );

        if (!result.allowed) {
            return res.status(403).json({
                success: false,
                error: 'IP address not whitelisted',
                ip: clientIp
            });
        }

        next();
    } catch (error) {
        console.error('IP whitelist check failed:', error);
        next(error);
    }
};

/**
 * Request Signing Middleware
 * Validates request signature
 */
const requestSigning = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.requestSigning) {
        return next();
    }

    // Skip if no institution (e.g., public endpoints)
    if (!req.institution) {
        return next();
    }

    try {
        const signature = req.headers['x-signature'];
        const timestamp = req.headers['x-timestamp'];

        if (!signature || !timestamp) {
            return res.status(401).json({
                success: false,
                error: 'Missing signature or timestamp header'
            });
        }

        // Check timestamp freshness (prevent replay attacks)
        const requestTime = new Date(timestamp);
        const now = new Date();
        const timeDiff = Math.abs(now - requestTime);

        if (timeDiff > 5 * 60 * 1000) { // 5 minutes
            return res.status(401).json({
                success: false,
                error: 'Request timestamp too old'
            });
        }

        const result = await SecurityService.validateRequestSignature(
            req.institution.id,
            {
                method: req.method,
                path: req.originalUrl,
                body: req.body,
                timestamp
            },
            signature
        );

        if (!result.valid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid request signature'
            });
        }

        next();
    } catch (error) {
        console.error('Request signature validation failed:', error);
        next(error);
    }
};

/**
 * Idempotency Key Middleware
 * Handles idempotent request processing
 */
const idempotency = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.idempotencyKeys) {
        return next();
    }

    // Only apply to POST/PUT/PATCH methods
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next();
    }

    const idempotencyKey = req.headers['idempotency-key'];

    // Skip if no key provided
    if (!idempotencyKey) {
        return next();
    }

    try {
        const institutionId = req.institution?.id;

        // Check if key exists
        const existing = await ResilienceService.checkIdempotencyKey(
            idempotencyKey,
            institutionId
        );

        if (existing.exists) {
            if (existing.status === 'PROCESSING') {
                return res.status(409).json({
                    success: false,
                    error: 'Request is already being processed',
                    idempotencyKey
                });
            }

            if (existing.status === 'COMPLETED' && existing.response) {
                // Return cached response
                res.set('X-Idempotent-Replay', 'true');
                return res.json(existing.response);
            }
        }

        // Store key as processing
        const requestHash = ResilienceService.createRequestHash(req.body);
        await ResilienceService.storeIdempotencyKey(idempotencyKey, institutionId, requestHash);

        // Store key info for response handling
        req.idempotencyKey = idempotencyKey;

        // Override res.json to capture response
        const originalJson = res.json.bind(res);
        res.json = async (body) => {
            // Store successful response
            if (res.statusCode >= 200 && res.statusCode < 300) {
                await ResilienceService.completeIdempotencyKey(
                    idempotencyKey,
                    institutionId,
                    body
                );
            } else {
                await ResilienceService.failIdempotencyKey(
                    idempotencyKey,
                    institutionId,
                    body.error || 'Request failed'
                );
            }
            return originalJson(body);
        };

        next();
    } catch (error) {
        console.error('Idempotency check failed:', error);
        next(error);
    }
};

/**
 * Request Logging Middleware
 * Logs all API requests and responses
 */
const requestLogger = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.requestLogs) {
        return next();
    }

    const startTime = Date.now();

    try {
        // Log request
        const logId = await DeveloperService.logRequest({
            institutionId: req.institution?.id,
            method: req.method,
            path: req.originalUrl,
            headers: req.headers,
            body: req.body,
            query: req.query,
            ip: getClientIp(req)
        });

        // Store log ID for response logging
        req.requestLogId = logId;

        // Override res.json to log response
        const originalJson = res.json.bind(res);
        res.json = async (body) => {
            const duration = Date.now() - startTime;

            // Log response (non-blocking)
            DeveloperService.logResponse(logId, {
                statusCode: res.statusCode,
                body,
                duration
            }).catch(err => console.error('Failed to log response:', err));

            return originalJson(body);
        };

        next();
    } catch (error) {
        console.error('Request logging failed:', error);
        // Don't fail the request if logging fails
        next();
    }
};

/**
 * Sandbox Mode Middleware
 * Routes requests to sandbox simulators in sandbox mode
 */
const sandboxMode = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.sandboxMode) {
        return next();
    }

    // Mark request as sandbox
    req.isSandbox = true;

    // Add sandbox header to response
    res.set('X-Sandbox-Mode', 'true');

    next();
};

/**
 * Fraud Detection Middleware
 * Checks transaction requests for fraud indicators
 */
const fraudDetection = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.fraudDetection) {
        return next();
    }

    // Only apply to transaction endpoints
    const transactionPaths = ['/ft', '/nec', '/tsq'];
    if (!transactionPaths.some(p => req.path.endsWith(p))) {
        return next();
    }

    try {
        const institutionId = req.institution?.id;

        const result = await SecurityService.checkFraud(institutionId, {
            amount: req.body.amount,
            debitAccount: req.body.debitAccount || req.body.accountNumber,
            creditAccount: req.body.creditAccount,
            type: req.path.includes('/ft') ? 'FT' : 'NEC'
        });

        if (!result.passed) {
            // Log fraud alert (already done in service)
            return res.status(403).json({
                success: false,
                error: 'Transaction blocked by fraud detection',
                reasons: result.failedChecks.map(c => c.reason),
                alertId: result.alertId
            });
        }

        // Add fraud score to request for logging
        req.fraudScore = result.score;

        next();
    } catch (error) {
        console.error('Fraud detection failed:', error);
        // Don't block transaction if fraud check fails
        next();
    }
};

/**
 * Rate Limit Tiers Middleware
 * Applies different rate limits based on institution tier
 */
const rateLimitTiers = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.rateLimitTiers) {
        return next();
    }

    try {
        const institutionId = req.institution?.id;

        if (!institutionId) {
            return next();
        }

        const result = await SecurityService.checkRateLimit(
            institutionId,
            req.originalUrl
        );

        // Add rate limit headers
        res.set('X-RateLimit-Limit', result.limit.toString());
        res.set('X-RateLimit-Remaining', result.remaining.toString());
        res.set('X-RateLimit-Reset', result.reset.toISOString());

        if (!result.allowed) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                tier: result.tier,
                retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
            });
        }

        next();
    } catch (error) {
        console.error('Rate limit tier check failed:', error);
        next();
    }
};

/**
 * Business Hours Middleware
 * Restricts transactions to configured business hours
 */
const businessHours = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.businessHours) {
        return next();
    }

    // Only apply to transaction endpoints
    const transactionPaths = ['/ft'];
    if (!transactionPaths.some(p => req.path.endsWith(p))) {
        return next();
    }

    try {
        const { OperationalService } = require('../services/features');
        const result = await OperationalService.checkBusinessHours();

        if (!result.allowed) {
            return res.status(400).json({
                success: false,
                error: 'Transactions not allowed outside business hours',
                currentTime: result.currentTime,
                businessHours: result.businessHours
            });
        }

        next();
    } catch (error) {
        console.error('Business hours check failed:', error);
        next();
    }
};

/**
 * Transaction Limits Middleware
 * Checks if transaction exceeds configured limits
 */
const transactionLimits = async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.transactionLimits) {
        return next();
    }

    // Only apply to FT endpoint
    if (!req.path.endsWith('/ft')) {
        return next();
    }

    try {
        const { OperationalService } = require('../services/features');
        const institutionId = req.institution?.id;
        const amount = parseFloat(req.body.amount);

        if (!institutionId || !amount) {
            return next();
        }

        const result = await OperationalService.checkTransactionLimits(
            institutionId,
            'FT',
            amount
        );

        if (!result.allowed) {
            return res.status(400).json({
                success: false,
                error: 'Transaction limit exceeded',
                limit: result.limit,
                used: result.used,
                remaining: result.remaining,
                type: result.limitType
            });
        }

        // Store for post-transaction update
        req.limitCheck = result;

        next();
    } catch (error) {
        console.error('Transaction limit check failed:', error);
        next();
    }
};

/**
 * Circuit Breaker Middleware
 * Protects against cascading failures
 */
const circuitBreaker = (serviceName) => async (req, res, next) => {
    // Skip if feature is disabled
    if (!config.features.circuitBreaker) {
        return next();
    }

    try {
        const check = await ResilienceService.checkCircuitBreaker(serviceName);

        if (!check.allowed) {
            return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable',
                service: serviceName,
                state: check.state,
                retryAfter: check.retryAfter
            });
        }

        // Store for recording success/failure
        req.circuitBreakerService = serviceName;

        next();
    } catch (error) {
        console.error('Circuit breaker check failed:', error);
        next();
    }
};

/**
 * Helper: Get client IP from request
 */
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown';
};

module.exports = {
    ipWhitelist,
    requestSigning,
    idempotency,
    requestLogger,
    sandboxMode,
    fraudDetection,
    rateLimitTiers,
    businessHours,
    transactionLimits,
    circuitBreaker
};
