/**
 * Worker Manager
 * Orchestrates all background workers for the Fund Management system
 *
 * Workers:
 * 1. Callback Processor - Processes incoming GIP callbacks
 * 2. FTC Worker - Initiates FTC after successful FTD
 * 3. TSQ Worker - Runs Transaction Status Queries
 * 4. Reversal Worker - Handles FTD reversals when FTC fails
 * 5. Client Callback Worker - Sends webhooks to institutions
 * 6. Timeout Worker - Monitors and handles transaction timeouts
 */

const { Pool } = require('pg');
const winston = require('winston');

// Import workers
const CallbackProcessor = require('./callback-processor');
const FtcWorker = require('./ftc-worker');
const TsqWorker = require('./tsq-worker');
const ReversalWorker = require('./reversal-worker');
const ClientCallbackWorker = require('./client-callback-worker');
const TimeoutWorker = require('./timeout-worker');

class WorkerManager {
    constructor(config = {}) {
        this.config = {
            database: {
                user: process.env.DATABASE_USER || 'postgres',
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DATABASE_NAME || 'bulk_pension',
                password: process.env.DATABASE_PASSWORD || 'admin',
                port: parseInt(process.env.DATABASE_PORT || '5432'),
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            },
            ...config
        };

        this.pool = null;
        this.workers = {};
        this.isRunning = false;
        this.logger = this.createLogger();
    }

    createLogger() {
        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'worker-manager' },
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                new winston.transports.File({
                    filename: './logs/workers-error.log',
                    level: 'error'
                }),
                new winston.transports.File({
                    filename: './logs/workers.log'
                })
            ]
        });
    }

    async initialize() {
        this.logger.info('Initializing Worker Manager...');

        // Create database pool
        this.pool = new Pool(this.config.database);

        // Test database connection
        try {
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            this.logger.info('Database connection established');
        } catch (error) {
            this.logger.error('Failed to connect to database:', error);
            throw error;
        }

        // Initialize workers
        this.workers = {
            callbackProcessor: new CallbackProcessor(this.pool, this.createWorkerLogger('callback-processor')),
            ftcWorker: new FtcWorker(this.pool, this.createWorkerLogger('ftc-worker')),
            tsqWorker: new TsqWorker(this.pool, this.createWorkerLogger('tsq-worker')),
            reversalWorker: new ReversalWorker(this.pool, this.createWorkerLogger('reversal-worker')),
            clientCallbackWorker: new ClientCallbackWorker(this.pool, this.createWorkerLogger('client-callback')),
            timeoutWorker: new TimeoutWorker(this.pool, this.createWorkerLogger('timeout-worker'))
        };

        this.logger.info('Workers initialized');
    }

    createWorkerLogger(workerName) {
        return this.logger.child({ worker: workerName });
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Worker Manager already running');
            return;
        }

        this.logger.info('Starting all workers...');
        this.isRunning = true;

        // Start all workers concurrently
        const startPromises = Object.entries(this.workers).map(async ([name, worker]) => {
            try {
                this.logger.info(`Starting ${name}...`);
                // Don't await - let them run in parallel
                worker.start().catch(error => {
                    this.logger.error(`Worker ${name} crashed:`, error);
                    // Restart worker after 5 seconds
                    setTimeout(() => {
                        if (this.isRunning) {
                            this.logger.info(`Restarting ${name}...`);
                            worker.start();
                        }
                    }, 5000);
                });
            } catch (error) {
                this.logger.error(`Failed to start ${name}:`, error);
            }
        });

        await Promise.all(startPromises);
        this.logger.info('All workers started');

        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }

    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.logger.info('Stopping all workers...');
        this.isRunning = false;

        // Stop all workers
        const stopPromises = Object.entries(this.workers).map(async ([name, worker]) => {
            try {
                this.logger.info(`Stopping ${name}...`);
                worker.stop();
            } catch (error) {
                this.logger.error(`Error stopping ${name}:`, error);
            }
        });

        await Promise.all(stopPromises);

        // Close database pool
        if (this.pool) {
            await this.pool.end();
            this.logger.info('Database pool closed');
        }

        this.logger.info('Worker Manager stopped');
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            this.logger.info(`Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception:', error);
            shutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection:', { reason, promise });
        });
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            workers: Object.entries(this.workers).reduce((acc, [name, worker]) => {
                acc[name] = {
                    isRunning: worker.isRunning
                };
                return acc;
            }, {}),
            database: {
                totalConnections: this.pool?.totalCount || 0,
                idleConnections: this.pool?.idleCount || 0,
                waitingClients: this.pool?.waitingCount || 0
            }
        };
    }
}

// Run as standalone if executed directly
if (require.main === module) {
    const manager = new WorkerManager();

    manager.initialize()
        .then(() => manager.start())
        .catch(error => {
            console.error('Failed to start Worker Manager:', error);
            process.exit(1);
        });
}

module.exports = WorkerManager;
