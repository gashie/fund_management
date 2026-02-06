/**
 * Fund Management API
 * Clean Architecture - Controllers, Services, Models
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware');
const { requestLogger } = require('./middleware/logging.middleware');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request/Response logging (colorful, concise)
app.use(requestLogger);

// Trust proxy (for IP detection behind load balancer)
app.set('trust proxy', true);

// API routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
