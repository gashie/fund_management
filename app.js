const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const routes = require('./routes/setup');
const { logMiddleware } = require('./logs/custom');
const {errorHandler} = require('./middleware/error');
const notFoundHandler = require('./middleware/notFound');
const securityHeaders = require('./middleware/securityHeaders');
const config = require('./config/config');
 const globalEventEmitter = require('./utils/eventEmitter'); // Import the global event emitter
require('./events'); // Dynamically load all event listeners
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cookieParser());

// Custom security headers
app.use(securityHeaders);
app.use(logMiddleware);



// Custom logging middleware in development
// if (process.env.NODE_ENV === 'development') {
//     app.use(logMiddleware);
// }

// Routes
app.use(`${config.version}${config.service_name}`, routes);

// Catch-all 404 handler
app.use(notFoundHandler);

// Final error handling middleware
app.use(errorHandler);

module.exports = app;
