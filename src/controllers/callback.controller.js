/**
 * Callback Controller
 * Receives callbacks from external systems.

 */

const CallbackService = require('../services/callback.service');
const { callbackLogger } = require('../utils/logger');

/**
 * Receive a callback from an external system
 * POST /callback or /callback/gip
 */
exports.receiveCallback = async (req, res, next) => {
    const body = req.body;
    const ip = req.ip?.replace('::ffff:', '') || req.connection?.remoteAddress || '-';

    callbackLogger.incoming(body, ip);

    try {
        const callback = await CallbackService.saveGipCallback(body, ip);

        callbackLogger.saved(callback.id, callback.transaction_id);

        res.json({
            success: true,
            message: 'Callback received',
            callbackId: callback.id
        });
    } catch (error) {
        // Log everything on our side, tell the caller nothing about our internals.
        callbackLogger.error('Save failed', error);

        res.status(500).json({
            success: false,
            message: 'Callback could not be stored'
        });
    }
};

/**
 * List callbacks (admin endpoint)
 * GET /callbacks
 */
exports.listCallbacks = async (req, res, next) => {
    try {
        res.json({
            success: true,
            message: 'List callbacks endpoint'
        });
    } catch (error) {
        next(error);
    }
};
