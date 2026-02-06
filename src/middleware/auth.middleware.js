/**
 * Authentication Middleware
 * Handles API credential authentication and rate limiting
 */

const InstitutionService = require('../services/institution.service');
const config = require('../config');

/**
 * Normalize IP address for comparison
 * Handles IPv6-mapped IPv4 addresses (::ffff:127.0.0.1 -> 127.0.0.1)
 */
const normalizeIp = (ip) => {
    if (!ip) return '';
    // Remove IPv6 prefix if present
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    // Handle localhost variations
    if (ip === '::1') {
        return '127.0.0.1';
    }
    return ip;
};

/**
 * Authenticate institution API credentials
 */
const authenticate = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['api_key'];
    const apiSecret = req.headers['x-api-secret'] || req.headers['api_secret'];

    if (!apiKey || !apiSecret) {
        return res.status(401).json({
            responseCode: '401',
            responseMessage: 'Missing API credentials',
            status: 'UNAUTHORIZED'
        });
    }

    try {
        const institution = await InstitutionService.authenticateCredentials(apiKey, apiSecret);

        if (!institution) {
            return res.status(401).json({
                responseCode: '401',
                responseMessage: 'Invalid API credentials',
                status: 'UNAUTHORIZED'
            });
        }

        // Check IP whitelist (only if feature is enabled AND institution has whitelist)
        if (config.features.ipWhitelist && institution.ipWhitelist && institution.ipWhitelist.length > 0) {
            const clientIp = normalizeIp(req.ip || req.connection.remoteAddress);
            const normalizedWhitelist = institution.ipWhitelist.map(normalizeIp);

            if (!normalizedWhitelist.includes(clientIp)) {
                return res.status(403).json({
                    responseCode: '403',
                    responseMessage: 'IP not authorized',
                    status: 'FORBIDDEN'
                });
            }
        }

        req.institution = institution;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            responseCode: '500',
            responseMessage: 'Authentication service error',
            status: 'ERROR'
        });
    }
};

/**
 * Check rate limit
 */
const rateLimit = async (req, res, next) => {
    try {
        const allowed = await InstitutionService.checkRateLimit(
            req.institution.credentialId,
            req.institution.rateLimit
        );

        if (!allowed) {
            return res.status(429).json({
                responseCode: '429',
                responseMessage: 'Rate limit exceeded',
                status: 'TOO_MANY_REQUESTS',
                retryAfter: 60 - new Date().getSeconds()
            });
        }

        next();
    } catch (error) {
        console.error('Rate limit error:', error);
        next(); // Don't block on rate limit errors
    }
};

/**
 * Check permission for operation
 */
const checkPermission = (operation) => {
    return (req, res, next) => {
        const permissions = req.institution.permissions || [];
        if (!permissions.includes(operation) && !permissions.includes('*')) {
            return res.status(403).json({
                responseCode: '403',
                responseMessage: `Not authorized for ${operation} operations`,
                status: 'FORBIDDEN'
            });
        }
        next();
    };
};

module.exports = {
    authenticate,
    rateLimit,
    checkPermission
};
