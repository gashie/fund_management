// 404 Not Found handler
module.exports = function notFound(req, res, next) {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
};
