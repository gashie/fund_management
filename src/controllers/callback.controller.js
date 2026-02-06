/**
 * Callback Controller
 * HTTP handlers for receiving GIP callbacks
 * No database queries - delegates to services
 */

const CallbackService = require('../services/callback.service');
const { callbackLogger } = require('../utils/logger');

/**
 * Receive GIP callback
 * POST /callback or /callback/gip
 */
exports.receiveCallback = async (req, res, next) => {
    const body = req.body;
    const ip = req.ip?.replace('::ffff:', '') || req.connection?.remoteAddress || '-';

    // Log incoming callback with full details
    callbackLogger.incoming(body, ip);

    try {
        const callback = await CallbackService.saveGipCallback(body, ip);

        // Log saved
        callbackLogger.saved(callback.id, callback.transaction_id);

        // Return success to GIP immediately
        res.json({
            success: true,
            message: 'Callback received',
            callbackId: callback.id
        });
    } catch (error) {
        // Still return 200 to GIP to acknowledge receipt
        callbackLogger.error('Save failed', error);
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
