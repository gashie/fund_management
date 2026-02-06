/**
 * Middleware Index
 * Export all middleware
 */

const { authenticate, rateLimit, checkPermission } = require('./auth.middleware');
const { validate } = require('./validator.middleware');
const { notFound, errorHandler } = require('./error.middleware');
const {
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
} = require('./feature.middleware');

module.exports = {
    // Core middleware
    authenticate,
    rateLimit,
    checkPermission,
    validate,
    notFound,
    errorHandler,

    // Feature middleware
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
