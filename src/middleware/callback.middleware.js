/**
 * Callback Middleware
 * Two checks on the way in: is the sender known, and is the body usable.
 *
 */

const config = require('../config');
const { callbackLogger } = require('../utils/logger');
const { isSenderAllowed, normalizeIp } = require('./callback.middleware.pure');
const { checkCallbackBody } = require('./callback.validate.pure');

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

/**
 * Turn away callbacks we could never use, before they reach the database.
 * Without a session id there is no transaction to match, so there is nothing to do with it.
 */
const validateCallbackBody = (req, res, next) => {
    const result = checkCallbackBody(req.body);

    if (result.ok) return next();

    const from = normalizeIp(req.ip || req.connection?.remoteAddress);
    callbackLogger.error(`Callback rejected from ${from}: ${result.reason}`, { body: req.body });

    return res.status(400).json({
        success: false,
        message: `Callback rejected: ${result.reason}`
    });
};

module.exports = {
    allowCallbackSender,
    validateCallbackBody,
    isSenderAllowed,
    normalizeIp
};
