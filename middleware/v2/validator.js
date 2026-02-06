/**
 * Request Validator Middleware v2
 * Validates incoming requests against Joi schemas
 */

/**
 * Create validation middleware for a schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,  // Return all errors, not just the first
            stripUnknown: true,  // Remove unknown fields
            convert: true  // Convert types where possible
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            return res.status(400).json({
                responseCode: '400',
                responseMessage: 'VALIDATION_ERROR',
                status: 'FAILED',
                errors: errors,
                message: 'Request validation failed'
            });
        }

        // Replace body with validated and cleaned value
        req.body = value;
        next();
    };
};

/**
 * Validate query parameters
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            return res.status(400).json({
                responseCode: '400',
                responseMessage: 'VALIDATION_ERROR',
                status: 'FAILED',
                errors: errors,
                message: 'Query parameter validation failed'
            });
        }

        req.query = value;
        next();
    };
};

/**
 * Validate URL parameters
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            convert: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            return res.status(400).json({
                responseCode: '400',
                responseMessage: 'VALIDATION_ERROR',
                status: 'FAILED',
                errors: errors,
                message: 'URL parameter validation failed'
            });
        }

        req.params = value;
        next();
    };
};

module.exports = {
    validateRequest,
    validateQuery,
    validateParams
};
