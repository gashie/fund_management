const morgan = require('morgan');
const { format, createLogger, transports } = require("winston");
const { combine, label, json,errors } = format;
require("winston-daily-rotate-file");

//Label
const CATEGORY = "npra-bulk-payment-logs";

//DailyRotateFile func()
const fileRotateTransport = new transports.DailyRotateFile({
  filename: "logs/rotate-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

const logger = createLogger({
  level: "debug",
  format: combine(errors({ stack: true }),label({ label: CATEGORY }), json()),
  transports: [fileRotateTransport, new transports.Console()],
});


const morganMiddleware = morgan(
    function (tokens, req, res) {
      return JSON.stringify({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: Number.parseFloat(tokens.status(req, res)),
        content_length: tokens.res(req, res, 'content-length'),
        response_time: Number.parseFloat(tokens['response-time'](req, res)),
      });
    },
    {
      stream: {
        // Configure Morgan to use collabo logger with the http severity
        write: (message) => {
          const data = JSON.parse(message);
          logger.http(`incoming-gip-limit-api-request`, data);
        },
      },
    }
  );
module.exports = {logger,morganMiddleware};