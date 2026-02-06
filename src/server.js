/**
 * Server Entry Point
 * Starts the API server and background workers
 */

const app = require('./app');
const config = require('./config');
const { pool } = require('./models/db');
const workerManager = require('./workers');
const { system, colors } = require('./utils/logger');

// Test database connection
async function testDatabase() {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        system.success('Database connected');
        return true;
    } catch (error) {
        system.error('Database connection failed', error);
        return false;
    }
}

// Start server
async function startServer() {
    console.log(`${colors.cyan}Fund Management API${colors.reset}`);

    // Test database
    const dbConnected = await testDatabase();
    if (!dbConnected) {
        process.exit(1);
    }

    // Start HTTP server
    const server = app.listen(config.port, () => {
        system.success(`Server running on port ${config.port} [${config.nodeEnv}]`);
    });

    // Start workers (optional - can run separately)
    if (process.env.START_WORKERS !== 'false') {
        workerManager.start();
    }

    // Graceful shutdown
    const shutdown = async (signal) => {
        system.warn(`${signal} - shutting down...`);

        server.close(() => system.info('HTTP server closed'));
        workerManager.stop();

        await pool.end();
        system.info('Database pool closed');

        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
        system.error('Uncaught exception', error);
        shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
        system.error('Unhandled rejection', { message: String(reason) });
    });

    return server;
}

// Start if running directly
if (require.main === module) {
    startServer();
}

module.exports = { startServer };
