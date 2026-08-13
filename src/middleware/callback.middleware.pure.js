/**
 * Callback address matching
 *


/**
 * Tidy up an address so it can be compared.
 * Node writes IPv4 addresses as ::ffff:1.2.3.4 when both kinds are in use.
 */
const normalizeIp = (ip) => {
    if (!ip) return '';
    if (ip.startsWith('::ffff:')) return ip.substring(7);
    if (ip === '::1') return '127.0.0.1';
    return ip;
};

/**
 * Is this sender on the list? An empty list means everyone is allowed.
 */
const isSenderAllowed = (ip, allowedList = []) => {
    if (!allowedList || allowedList.length === 0) return true;
    return allowedList.map(normalizeIp).includes(normalizeIp(ip));
};

module.exports = { normalizeIp, isSenderAllowed };
