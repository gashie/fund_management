/**
 * Validation Schemas v2
 * Joi schemas for request validation
 */

const Joi = require('joi');

/**
 * Institution creation schema
 */
const institutionSchema = Joi.object({
    institutionCode: Joi.string()
        .alphanum()
        .min(3)
        .max(20)
        .required()
        .messages({
            'string.empty': 'Institution code is required',
            'string.min': 'Institution code must be at least 3 characters',
            'string.max': 'Institution code must not exceed 20 characters'
        }),

    institutionName: Joi.string()
        .min(3)
        .max(255)
        .required()
        .messages({
            'string.empty': 'Institution name is required'
        }),

    shortName: Joi.string()
        .max(50)
        .optional(),

    bankCode: Joi.string()
        .max(10)
        .optional()
        .messages({
            'string.max': 'Bank code must not exceed 10 characters'
        }),

    contactEmail: Joi.string()
        .email()
        .optional()
        .messages({
            'string.email': 'Invalid email format'
        }),

    contactPhone: Joi.string()
        .pattern(/^[+]?[\d\s-]{10,20}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Invalid phone number format'
        }),

    webhookUrl: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .optional()
        .messages({
            'string.uri': 'Webhook URL must be a valid HTTP/HTTPS URL'
        }),

    ipWhitelist: Joi.array()
        .items(Joi.string().ip())
        .optional(),

    isSandbox: Joi.boolean()
        .default(false)
});

/**
 * Credential generation schema
 */
const credentialSchema = Joi.object({
    name: Joi.string()
        .max(100)
        .optional()
        .default('Default'),

    permissions: Joi.array()
        .items(Joi.string().valid('nec', 'ft', 'tsq', '*'))
        .optional()
        .default(['nec', 'ft', 'tsq']),

    rateLimitPerMinute: Joi.number()
        .integer()
        .min(1)
        .max(1000)
        .optional()
        .default(60),

    rateLimitPerDay: Joi.number()
        .integer()
        .min(1)
        .max(100000)
        .optional()
        .default(10000),

    expiresAt: Joi.date()
        .iso()
        .greater('now')
        .optional()
        .messages({
            'date.greater': 'Expiration date must be in the future'
        })
});

/**
 * Name Enquiry (NEC) schema
 */
const necSchema = Joi.object({
    srcBankCode: Joi.string()
        .length(6)
        .required()
        .messages({
            'string.empty': 'Source bank code is required',
            'string.length': 'Source bank code must be 6 characters'
        }),

    destBankCode: Joi.string()
        .length(6)
        .required()
        .messages({
            'string.empty': 'Destination bank code is required',
            'string.length': 'Destination bank code must be 6 characters'
        }),

    srcAccountNumber: Joi.string()
        .min(10)
        .max(20)
        .required()
        .messages({
            'string.empty': 'Source account number is required',
            'string.min': 'Source account number must be at least 10 characters',
            'string.max': 'Source account number must not exceed 20 characters'
        }),

    destAccountNumber: Joi.string()
        .min(10)
        .max(20)
        .required()
        .messages({
            'string.empty': 'Destination account number is required',
            'string.min': 'Destination account number must be at least 10 characters',
            'string.max': 'Destination account number must not exceed 20 characters'
        }),

    referenceNumber: Joi.string()
        .min(5)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Reference number is required',
            'string.min': 'Reference number must be at least 5 characters',
            'string.max': 'Reference number must not exceed 50 characters'
        }),

    requestTimestamp: Joi.date()
        .iso()
        .optional()
        .default(() => new Date().toISOString())
});

/**
 * Funds Transfer (FT) schema
 */
const ftSchema = Joi.object({
    srcBankCode: Joi.string()
        .length(6)
        .required()
        .messages({
            'string.empty': 'Source bank code is required',
            'string.length': 'Source bank code must be 6 characters'
        }),

    destBankCode: Joi.string()
        .length(6)
        .required()
        .messages({
            'string.empty': 'Destination bank code is required',
            'string.length': 'Destination bank code must be 6 characters'
        }),

    srcAccountNumber: Joi.string()
        .min(10)
        .max(20)
        .required()
        .messages({
            'string.empty': 'Source account number is required'
        }),

    srcAccountName: Joi.string()
        .min(2)
        .max(255)
        .required()
        .messages({
            'string.empty': 'Source account name is required'
        }),

    destAccountNumber: Joi.string()
        .min(10)
        .max(20)
        .required()
        .messages({
            'string.empty': 'Destination account number is required'
        }),

    destAccountName: Joi.string()
        .min(2)
        .max(255)
        .required()
        .messages({
            'string.empty': 'Destination account name is required'
        }),

    amount: Joi.number()
        .positive()
        .precision(2)
        .max(999999999999)  // Max 12 digits before decimal
        .required()
        .messages({
            'number.positive': 'Amount must be positive',
            'number.base': 'Amount must be a number',
            'any.required': 'Amount is required'
        }),

    narration: Joi.string()
        .min(3)
        .max(255)
        .required()
        .messages({
            'string.empty': 'Narration is required',
            'string.min': 'Narration must be at least 3 characters'
        }),

    referenceNumber: Joi.string()
        .min(5)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Reference number is required'
        }),

    callbackUrl: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .optional()
        .messages({
            'string.uri': 'Callback URL must be a valid HTTP/HTTPS URL'
        }),

    requestTimestamp: Joi.date()
        .iso()
        .optional()
        .default(() => new Date().toISOString())
});

/**
 * Transaction Status Query (TSQ) schema
 */
const tsqSchema = Joi.object({
    referenceNumber: Joi.string()
        .min(5)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Reference number is required'
        }),

    transactionReferenceNumber: Joi.string()
        .min(5)
        .max(50)
        .optional(),

    srcBankCode: Joi.string()
        .length(6)
        .optional(),

    transactionTimestamp: Joi.date()
        .iso()
        .optional(),

    requestTimestamp: Joi.date()
        .iso()
        .optional()
        .default(() => new Date().toISOString())
});

module.exports = {
    institutionSchema,
    credentialSchema,
    necSchema,
    ftSchema,
    tsqSchema
};
