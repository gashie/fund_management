const { Pool } = require('pg');
const axios = require('axios');

// Initialize PostgreSQL connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bulk_pension',
    password: 'admin',
    port: 5432
});

// Fetch Configuration
const fetchConfig = async () => {
    const result = await pool.query('SELECT * FROM job_config WHERE enabled = TRUE LIMIT 1');
    return result.rows[0];
};