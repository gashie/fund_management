/**
 * Callback body checks
 * Just the rules. No database, no logger, so it can be tested on its own.

 *
 * The gip_callbacks table refuses rows without session_id, function_code or raw_payload.
 * Without this check an empty body reaches the database and comes back as a raw SQL error.
 */

/**
 * Read a value that may be written either way, e.g. sessionId or session_id.
 */
const pick = (body, camel, snake) => body?.[camel] ?? body?.[snake];

/**
 * Is this callback usable? Returns { ok } or { ok: false, reason }.
 */
const checkCallbackBody = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, reason: 'Body must be a JSON object' };
    }

    if (Object.keys(body).length === 0) {
        return { ok: false, reason: 'Body is empty' };
    }

    const sessionId = pick(body, 'sessionId', 'session_id');
    if (!sessionId) {
        return { ok: false, reason: 'sessionId is required' };
    }

    const functionCode = pick(body, 'functionCode', 'function_code');
    if (!functionCode) {
        return { ok: false, reason: 'functionCode is required' };
    }

    return { ok: true, sessionId: String(sessionId), functionCode: String(functionCode) };
};

module.exports = { checkCallbackBody, pick };
