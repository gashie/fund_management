/**
 * Callback Controller
 * HTTP handlers for receiving GIP callbacks
 * No database queries - delegates to services
 */

const CallbackService = require('../services/callback.service');
const { callbackLogger } = require('../utils/logger');

/**
 * Receive GIP callback
 * POST /callback
 */
exports.receiveCallback = async (req, res, next) => {
    try {
        const callback = await CallbackService.saveGipCallback(
            req.body,
            req.ip || req.connection.remoteAddress
        );

        // Log callback received
        callbackLogger.received(
            callback.session_id || req.body.sessionId,
            callback.action_code || req.body.actionCode,
            callback.function_code || req.body.functionCode
        );

        // Return success to GIP immediately
        res.json({
            success: true,
            message: 'Callback received',
            callbackId: callback.id
        });
    } catch (error) {
        // Still return 200 to GIP to acknowledge receipt
        const { logger } = require('../utils/logger');
        logger.error('Callback receive error', error);
        res.json({
            success: false,
            message: 'Callback received with errors',
            error: error.message
        });
    }
};

/**
 * List callbacks (admin endpoint)
 * GET /callbacks
 */
exports.listCallbacks = async (req, res, next) => {
    try {
        // This would need a method in CallbackService
        res.json({
            success: true,
            message: 'List callbacks endpoint'
        });
    } catch (error) {
        next(error);
    }
};
