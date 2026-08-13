/**
 * Client replies

 *   200 + responseCode 000 = accepted, a callback will follow
 *   200 + responseCode 100 = rejected, the reason is in responseMessage
 *   401                    = not authorised


/**
 * Accepted. Pass whatever extra fields that endpoint returns.
 */
const accepted = (res, body = {}) =>
    res.status(200).json({ responseCode: '000', ...body });

/**
 * Rejected. The reason goes in responseMessage, in words a person can read.
 */
const rejected = (res, message, body = {}) =>
    res.status(200).json({
        responseCode: '100',
        responseMessage: message || 'Request rejected',
        status: 'FAILED',
        ...body
    });

/**
 * Turn a thrown error into a rejection message.
 * Our own errors carry a message. Anything else stays vague on purpose.
 */
const reasonFrom = (error) => {
    if (error && error.status && error.message) return error.message;
    return 'Request could not be processed';
};

/**
 * True if this error is the client's fault, not ours.
 * Real server faults should still come back as 5xx.
 */
const isClientFault = (error) =>
    Boolean(error && error.status && error.status >= 400 && error.status < 500);

module.exports = { accepted, rejected, reasonFrom, isClientFault };
