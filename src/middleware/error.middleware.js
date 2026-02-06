/**
 * Error Middleware
 * Global error handling
 */

/**
 * Not found handler
 */
const notFound = (req, res, next) => {
    res.status(404).json({
        responseCode: '404',
        responseMessage: 'NOT_FOUND',
        status: 'FAILED',
        message: `Route ${req.method} ${req.url} not found`
    });
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Custom application errors
    if (err.status) {
        return res.status(err.status).json({
            responseCode: err.code || err.status.toString(),
            responseMessage: err.message,
            status: 'FAILED'
        });
    }

    // PostgreSQL errors
    const pgErrors = {
        '23505': { status: 409, message: 'Duplicate entry found' },
        '22P02': { status: 400, message: 'Invalid UUID format' },
        '22007': { status: 400, message: 'Invalid date/timestamp format' },
        '42P01': { status: 500, message: 'Database table not found' },
        '23503': { status: 400, message: 'Foreign key constraint violation' }
    };

    if (err.code && pgErrors[err.code]) {
        const pgError = pgErrors[err.code];
        return res.status(pgError.status).json({
            responseCode: pgError.status.toString(),
            responseMessage: pgError.message,
            status: 'FAILED'
        });
    }

    // Network errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return res.status(503).json({
            responseCode: '503',
            responseMessage: 'Service unavailable',
            status: 'FAILED'
        });
    }

    // Default server error
    res.status(500).json({
        responseCode: '500',
        responseMessage: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        status: 'ERROR'
    });
};

module.exports = {
    notFound,
    errorHandler
};
