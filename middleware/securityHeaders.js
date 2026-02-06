// Middleware for setting security headers
module.exports = function securityHeaders(req, res, next) {
    res.removeHeader('x-powered-by');
    res.removeHeader('set-cookie');
    res.removeHeader('Date');
    res.removeHeader('Connection');
    res.header('Content-Security-Policy', "frame-ancestors 'self'");
    next();
};
