/**
 * Worker Manager
 * Orchestrates all background workers - Functional style

 */

const callbackWorker = require('./callback.worker');
const ftcWorker = require('./ftc.worker');
const tsqWorker = require('./tsq.worker');
const reversalWorker = require('./reversal.worker');
const clientCallbackWorker = require('./client-callback.worker');
const timeoutWorker = require('./timeout.worker');

// Feature workers
const scheduledWorker = require('./scheduled.worker');
const recurringWorker = require('./recurring.worker');
const bulkWorker = require('./bulk.worker');
const queueWorker = require('./queue.worker');
const monitoringWorker = require('./monitoring.worker');
const cleanupWorker = require('./cleanup.worker');

const config = require('../config');
const { workerLogger, system } = require('../utils/logger');

let isRunning = false;

const workers = {
    // Core workers
    callback: callbackWorker,
    ftc: ftcWorker,
    tsq: tsqWorker,
    clientCallback: clientCallbackWorker,
    timeout: timeoutWorker,

    // Feature workers
    scheduled: scheduledWorker,
    recurring: recurringWorker,
    bulk: bulkWorker,
    queue: queueWorker,
    monitoring: monitoringWorker,
    cleanup: cleanupWorker
};

// Reversals are handled manually for now. The worker stays wired but off by default,
// because it re-fires every 5s while a reversal is still in flight.
if (config.features.autoReversal) {
    workers.reversal = reversalWorker;
}

const start = () => {
    if (isRunning) return;

    isRunning = true;
    system.info('Starting workers...');

    if (!config.features.autoReversal) {
        system.warn('Auto-reversal DISABLED - FTC failures park as MANUAL_REVERSAL_REQUIRED');
    }

    Object.entries(workers).forEach(([name, worker]) => {
        const logger = workerLogger(name.toUpperCase());
        worker.start(logger).catch(error => {
            system.error(`${name} crashed`, error);
            if (isRunning) {
                setTimeout(() => worker.start(logger), 5000);
            }
        });
    });

    system.success('Workers started');
    setupGracefulShutdown();
};

const stop = () => {
    if (!isRunning) return;

    isRunning = false;
    system.info('Stopping workers...');

    Object.values(workers).forEach(worker => worker.stop());

    system.info('Workers stopped');
};

const setupGracefulShutdown = () => {
    const shutdown = (signal) => {
        system.warn(`${signal} received, shutting down...`);
        stop();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

const getStatus = () => ({
    isRunning,
    autoReversal: config.features.autoReversal,
    workers: Object.entries(workers).reduce((acc, [name, worker]) => {
        acc[name] = worker.getStatus();
        return acc;
    }, {})
});

// Run standalone if executed directly
if (require.main === module) {
    start();
}

module.exports = {
    start,
    stop,
    getStatus,
    workers
};
