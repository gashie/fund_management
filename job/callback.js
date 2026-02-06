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

// Fetch Pending Jobs
const fetchPendingJobs = async () => {
    const result = await pool.query('SELECT * FROM job_queue WHERE status = $1 LIMIT 10', ['PENDING']);
    return result.rows;
};

// Update Job Status
const updateJobStatus = async (id, status, retries = null, response_data = null, error_details = null) => {
    await pool.query(
        'UPDATE job_queue SET response_data = $1, status = $2, retries = $3, error_details = $4, updated_at = NOW() WHERE id = $5',
        [response_data, status, retries, error_details, id]
    );
};

// Send Notification
const sendFailureNotification = async (jobId, error) => {
    console.log(`Sending failure notification for Job ${jobId}...`);
    // Add your email or messaging service logic here
    // For example, using Nodemailer or a webhook for Slack/Teams
};

// Process a Single Job
const processJob = async (job, config) => {
    console.log("CURRENT JOB", job);
    
    const { id, payload, retries,callback_url } = job;
    const { max_retries, retry_interval_seconds } = config;

    try {
        console.log(`Processing Job ${id} with payload:`, payload);

        const response = await axios.post(callback_url, payload);

        console.log(`Job ${id} processed successfully.`);
        await updateJobStatus(id, 'SUCCESSFUL', retries + 1, response.data, null);
    } catch (error) {
        console.error(`Error processing Job ${id}:`, error.message);

        // Save error details and decide on retries
        if (retries + 1 >= max_retries) {
            console.log(`Job ${id} failed after maximum retries.`);
            await updateJobStatus(id, 'FAILED', retries + 1, null, error.message);
            await sendFailureNotification(id, error.message);
        } else {
            console.log(`Retrying Job ${id} after ${retry_interval_seconds} seconds.`);
            await updateJobStatus(id, 'PENDING', retries + 1, null, error.message);

            // Wait for the retry interval before re-processing
            setTimeout(() => processJob(job, config), retry_interval_seconds * 1000);
        }
    }
};

// Main Worker Function
const startJobProcessor = async () => {
    console.log('Starting Job Processor...');
    const config = await fetchConfig();

    if (!config) {
        console.error('No configuration found. Exiting...');
        return;
    }

    while (true) {
        const jobs = await fetchPendingJobs();

        if (jobs.length === 0) {
            console.log('No pending jobs. Sleeping for a while...');
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Sleep for 5 seconds
            continue;
        }

        for (const job of jobs) {
            await updateJobStatus(job.id, 'PROCESSING'); // Mark job as processing
            await processJob(job, config);
        }
    }
};

// Start the job processor
startJobProcessor();
