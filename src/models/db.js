/**
 * Database Connection Pool
 */

const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

let connectionLogged = false;

// Log connection events (only once)
pool.on('connect', () => {
    if (!connectionLogged) {
        console.log('\x1b[32m[DB]\x1b[0m Connected to PostgreSQL');
        connectionLogged = true;
    }
});

pool.on('error', (err) => {
    console.error('\x1b[31m[DB]\x1b[0m Pool error:', err.message);
});

/**
 * Execute a query
 */
const query = async (text, params) => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Only log slow queries (>500ms) or if LOG_QUERIES is enabled
    if (duration > 500) {
        const shortText = text.replace(/\s+/g, ' ').trim().slice(0, 50);
        console.log(`\x1b[33m[DB]\x1b[0m Slow query (${duration}ms): ${shortText}...`);
    }

    return result;
};

/**
 * Get a client for transactions
 */
const getClient = async () => {
    const client = await pool.connect();
    return client;
};

/**
 * Execute within a transaction
 */
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    getClient,
    transaction
};
