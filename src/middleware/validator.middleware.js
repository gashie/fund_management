/**
 * Validation Middleware
 * Request validation using Joi schemas
 * Supports both camelCase and snake_case input (backwards compatible)
 */

const Joi = require('joi');

/**
 * Convert snake_case to camelCase
 */
const toCamelCase = (str) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

/**
 * Transform object keys from snake_case to camelCase (recursive)
 */
const transformKeys = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(transformKeys);
    }
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            const camelKey = toCamelCase(key);
            acc[camelKey] = transformKeys(obj[key]);
            return acc;
        }, {});
    }
    return obj;
};

/**
 * Validation schemas
 */
const schemas = {
    // Institution schema
    institution: Joi.object({
        institutionCode: Joi.string().alphanum().min(3).max(20).required(),
        institutionName: Joi.string().min(3).max(255).required(),
        shortName: Joi.string().max(50).optional(),
        bankCode: Joi.string().max(10).optional(),
        contactEmail: Joi.string().email().optional(),
        contactPhone: Joi.string().pattern(/^[+]?[\d\s-]{10,20}$/).optional(),
        webhookUrl: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
        ipWhitelist: Joi.array().items(Joi.string().ip()).optional(),
        isSandbox: Joi.boolean().default(false)
    }),

    // Credential schema
    credential: Joi.object({
        name: Joi.string().max(100).optional().default('Default'),
        permissions: Joi.array().items(Joi.string().valid('nec', 'ft', 'tsq', '*')).optional(),
        rateLimitPerMinute: Joi.number().integer().min(1).max(1000).optional().default(60),
        rateLimitPerDay: Joi.number().integer().min(1).max(100000).optional().default(10000),
        expiresAt: Joi.date().iso().greater('now').optional()
    }),

    // NEC schema
    nec: Joi.object({
        srcBankCode: Joi.string().length(6).required(),
        destBankCode: Joi.string().length(6).required(),
        srcAccountNumber: Joi.string().min(10).max(20).required(),
        destAccountNumber: Joi.string().min(10).max(20).required(),
        referenceNumber: Joi.string().min(5).max(50).required(),
        requestTimestamp: Joi.date().iso().optional()
    }),

    // FT schema
    ft: Joi.object({
        srcBankCode: Joi.string().length(6).required(),
        destBankCode: Joi.string().length(6).required(),
        srcAccountNumber: Joi.string().min(10).max(20).required(),
        srcAccountName: Joi.string().min(2).max(255).required(),
        destAccountNumber: Joi.string().min(10).max(20).required(),
        destAccountName: Joi.string().min(2).max(255).required(),
        amount: Joi.number().positive().precision(2).max(999999999999).required(),
        narration: Joi.string().min(3).max(255).required(),
        referenceNumber: Joi.string().min(5).max(50).required(),
        callbackUrl: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
        requestTimestamp: Joi.date().iso().optional()
    }),

    // TSQ schema
    tsq: Joi.object({
        referenceNumber: Joi.string().min(5).max(50).required(),
        transactionReferenceNumber: Joi.string().min(5).max(50).optional(),
        srcBankCode: Joi.string().length(6).optional(),
        transactionTimestamp: Joi.date().iso().optional(),
        requestTimestamp: Joi.date().iso().optional()
    })
};

/**
 * Create validation middleware for a schema
 * Automatically transforms snake_case to camelCase for backwards compatibility
 */
const validate = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return next(new Error(`Unknown schema: ${schemaName}`));
        }

        // Transform snake_case to camelCase for backwards compatibility
        const transformedBody = transformKeys(req.body);

        const { error, value } = schema.validate(transformedBody, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                responseCode: '400',
                responseMessage: 'VALIDATION_ERROR',
                status: 'FAILED',
                errors,
                message: 'Request validation failed'
            });
        }

        req.body = value;
        next();
    };
};

module.exports = {
    validate,
    schemas,
    transformKeys
};
