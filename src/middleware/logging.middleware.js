/**
 * Request/Response Logging Middleware
 * Logs incoming requests, client details, and outgoing responses
 */

const { httpLogger } = require('../utils/logger');

/**
 * Log incoming requests and outgoing responses
 */
const requestLogger = (req, res, next) => {
    // Skip health check endpoints
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    const startTime = Date.now();

    // Log incoming request
    httpLogger.request(req);

    // Log request details for transaction endpoints
    if (req.body && (req.path.includes('/nec') || req.path.includes('/transfer') || req.path.includes('/ft'))) {
        httpLogger.requestDetail(req);
    }

    // Capture response
    const originalSend = res.send;
    res.send = function(body) {
        const duration = Date.now() - startTime;

        // Log response
        httpLogger.response(req, res, duration);

        return originalSend.call(this, body);
    };

    next();
};

module.exports = { requestLogger };
