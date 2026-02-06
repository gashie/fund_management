const { logger } = require('../logs/winston');
const ErrorResponse = require('../utils/errorResponse');

// Middleware to handle errors
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    console.log("🔥 Error caught:", err);

    // Extract application file and line numbers for better debugging
    const appStackLine = err.stack
        ? err.stack.split('\n').find(line => !line.includes('node_modules') && line.includes(process.cwd()))
        : null;
    const fileName = appStackLine ? appStackLine.match(/\((.*):\d+:\d+\)/)?.[1] : 'Unknown File';
    const lineNumber = appStackLine ? appStackLine.match(/:(\d+):\d+\)/)?.[1] : 'Unknown Line';

    // Map of database error codes and their messages
    const dbErrors = {
        '23505': 'Duplicate entry found in request',
        '22P02': 'Invalid UUID in request',
        '22007': 'Invalid date/timestamp in request',
        '42P01': 'Table does not exist, please check and try again',
    };

    // Handle database errors
    if (dbErrors[err.code]) {
        error = new ErrorResponse(dbErrors[err.code], 400);
        logger.error({ message: error.message, fileName, lineNumber });
    }

    // Application-specific errors
    const appErrors = {
        'entity.parse.failed': 'Invalid JSON Fields',
        'ER_DBACCESS_DENIED_ERROR': 'Database Access Denied',
        'ER_BAD_FIELD_ERROR': 'Unknown column in request',
        'ER_TABLE_EXISTS_ERROR': 'Table already exists',
        'ER_NO_SUCH_TABLE': 'Unknown table in request',
        'EHOSTUNREACH': 'Server Failed to Connect',
        'ENOTFOUND': `Failed to connect to DB URL ${err.hostname}`,
    };

    if (appErrors[err.code] || appErrors[err.type]) {
        const message = appErrors[err.code] || appErrors[err.type];
        error = new ErrorResponse(message, 400);
        logger.error({ message, fileName, lineNumber });
    }

    res.status(error.statusCode || 500).json({
        status: 0,
        message: error.message || 'Internal Server Error',
        file: fileName,
        line: lineNumber,
    });
};

// Handle unhandled promise rejections globally
const handleRejection = (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, '💥 Reason:', reason);
    logger.error(`Unhandled Promise Rejection: ${reason.message || reason}`);

    // Do NOT exit in development; instead, just log the error
    if (process.env.NODE_ENV === 'production') {
        process.exit(1); // Restart only in production
    }
};

// Middleware to catch async errors (Prevents app from crashing)
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, handleRejection, asyncHandler };
