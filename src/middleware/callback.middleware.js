/**
 * Callback Middleware
 * Only lets known addresses post callbacks to us.
 *

 *
 * Why this matters: a callback decides a transaction's outcome. Anyone who can post one
 * with a session id we know could mark a transfer complete, or start a reversal.
 *
 */

const config = require('../config');
const { callbackLogger } = require('../utils/logger');
const { isSenderAllowed, normalizeIp } = require('./callback.middleware.pure');

/**
 * Refuse callbacks from addresses we do not recognise.
 * If no addresses are set, everything is let through. The startup check warns about that.
 */
const allowCallbackSender = (req, res, next) => {
    const from = req.ip || req.connection?.remoteAddress;

    if (isSenderAllowed(from, config.gip.callbackAllowedIps)) {
        return next();
    }

    callbackLogger.error(`Callback refused from ${normalizeIp(from)}`, {
        allowed: config.gip.callbackAllowedIps
    });

    return res.status(403).json({
        success: false,
        message: 'Sender not recognised'
    });
};

module.exports = {
    allowCallbackSender,
    isSenderAllowed,
    normalizeIp
};
