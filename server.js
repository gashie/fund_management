const dotenv = require('dotenv');
const app = require('./app');
const { logger } = require('./logs/winston');
const { handleRejection } = require('./middleware/error');

// Load environment variables
dotenv.config({ path: './config/config.env' });

// Set max listeners to avoid memory leak warnings
require('events').EventEmitter.defaultMaxListeners = 15;

const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    logger.debug(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', handleRejection);
