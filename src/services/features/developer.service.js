/**
 * Developer Experience Service
 * Sandbox mode, request logging, webhook testing, and API documentation
 */

const { query } = require('../../models/db');
const config = require('../../config');
const crypto = require('crypto');

// ============================================================================
// Sandbox Mode
// ============================================================================

/**
 * Check if sandbox mode is enabled
 */
const isSandboxMode = () => {
    return config.features.sandboxMode;
};

/**
 * Simulate NEC (Name Enquiry) response
 */
const simulateNEC = async (request) => {
    if (!config.features.sandboxMode) {
        return { sandboxMode: false };
    }

    const { accountNumber, bankCode } = request;

    // Simulate different responses based on test patterns
    const testResponses = {
        // Success patterns
        '1234567890': { accountName: 'JOHN DOE TEST', responseCode: '000' },
        '0987654321': { accountName: 'JANE SMITH TEST', responseCode: '000' },
        // Error patterns
        '1111111111': { accountName: null, responseCode: '119', message: 'Account not found' },
        '2222222222': { accountName: null, responseCode: '114', message: 'Invalid account' },
        '3333333333': { accountName: null, responseCode: '096', message: 'System error' }
    };

    // Add artificial delay to simulate real API
    await simulateLatency(100, 500);

    const response = testResponses[accountNumber] || {
        accountName: `TEST ACCOUNT ${accountNumber.slice(-4)}`,
        responseCode: '000'
    };

    // Log sandbox transaction
    await logSandboxTransaction({
        type: 'NEC',
        request,
        response,
        success: response.responseCode === '000'
    });

    return {
        sandboxMode: true,
        ...response
    };
};

/**
 * Simulate FT (Funds Transfer) submission
 */
const simulateFT = async (request) => {
    if (!config.features.sandboxMode) {
        return { sandboxMode: false };
    }

    const { amount, debitAccount, creditAccount } = request;

    // Simulate processing delay
    await simulateLatency(200, 800);

    // Generate test transaction reference
    const transactionRef = `SBX${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Determine response based on test patterns
    let response;
    if (amount > 10000000) {
        // Simulate limit exceeded for large amounts
        response = {
            responseCode: '061',
            message: 'Transaction limit exceeded',
            transactionRef: null
        };
    } else if (debitAccount.startsWith('99')) {
        // Simulate insufficient funds
        response = {
            responseCode: '051',
            message: 'Insufficient funds',
            transactionRef: null
        };
    } else {
        // Success
        response = {
            responseCode: '000',
            message: 'Request accepted',
            transactionRef,
            status: 'PENDING'
        };

        // Schedule simulated callback
        if (config.sandbox.autoCallback) {
            scheduleSimulatedCallback(transactionRef, request);
        }
    }

    await logSandboxTransaction({
        type: 'FT',
        request,
        response,
        transactionRef,
        success: response.responseCode === '000'
    });

    return {
        sandboxMode: true,
        ...response
    };
};

/**
 * Simulate TSQ (Transaction Status Query)
 */
const simulateTSQ = async (request) => {
    if (!config.features.sandboxMode) {
        return { sandboxMode: false };
    }

    const { transactionRef } = request;

    await simulateLatency(50, 200);

    // Check sandbox transaction log for this reference
    const sandboxTx = await getSandboxTransaction(transactionRef);

    let response;
    if (sandboxTx) {
        response = {
            responseCode: '000',
            statusCode: sandboxTx.final_status || '990',
            status: sandboxTx.final_status === '000' ? 'SUCCESS' :
                sandboxTx.final_status === '990' ? 'PENDING' : 'FAILED',
            transactionRef
        };
    } else {
        response = {
            responseCode: '000',
            statusCode: '381',
            status: 'NOT_FOUND',
            message: 'Transaction not found at receiver'
        };
    }

    await logSandboxTransaction({
        type: 'TSQ',
        request,
        response,
        transactionRef,
        success: true
    });

    return {
        sandboxMode: true,
        ...response
    };
};

/**
 * Schedule a simulated callback
 */
const scheduleSimulatedCallback = (transactionRef, originalRequest) => {
    const delay = config.sandbox.callbackDelay || 5000;

    setTimeout(async () => {
        try {
            // Determine callback type based on amount for testing
            const amount = originalRequest.amount || 0;
            let statusCode = '000'; // Success by default

            if (amount % 1000 === 111) {
                statusCode = '051'; // Insufficient funds pattern
            } else if (amount % 1000 === 222) {
                statusCode = '096'; // System error pattern
            }

            // Update sandbox transaction
            await query(
                `UPDATE sandbox_transactions
                 SET final_status = $2, callback_sent_at = NOW()
                 WHERE transaction_ref = $1`,
                [transactionRef, statusCode]
            );

            // If institution has callback URL configured, send it
            // This would integrate with the callback service
            console.log(`[Sandbox] Callback simulated for ${transactionRef}: ${statusCode}`);
        } catch (error) {
            console.error('[Sandbox] Failed to send simulated callback:', error);
        }
    }, delay);
};

/**
 * Log sandbox transaction
 */
const logSandboxTransaction = async (data) => {
    const { type, request, response, transactionRef, success } = data;

    await query(
        `INSERT INTO sandbox_transactions
         (transaction_ref, request_type, request_payload, response_payload, success)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (transaction_ref) WHERE transaction_ref IS NOT NULL
         DO UPDATE SET
            response_payload = $4,
            success = $5,
            updated_at = NOW()`,
        [
            transactionRef || `${type}_${Date.now()}`,
            type,
            JSON.stringify(request),
            JSON.stringify(response),
            success
        ]
    );
};

/**
 * Get sandbox transaction by reference
 */
const getSandboxTransaction = async (transactionRef) => {
    const result = await query(
        `SELECT * FROM sandbox_transactions WHERE transaction_ref = $1`,
        [transactionRef]
    );
    return result.rows[0];
};

/**
 * Get sandbox transaction history
 */
const getSandboxHistory = async (options = {}) => {
    const { limit = 50, type = null, institutionId = null } = options;

    let sql = `SELECT * FROM sandbox_transactions WHERE 1=1`;
    const params = [];

    if (type) {
        params.push(type);
        sql += ` AND request_type = $${params.length}`;
    }

    if (institutionId) {
        params.push(institutionId);
        sql += ` AND institution_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return result.rows;
};

/**
 * Clear sandbox data
 */
const clearSandboxData = async (institutionId = null) => {
    let result;
    if (institutionId) {
        result = await query(
            `DELETE FROM sandbox_transactions WHERE institution_id = $1 RETURNING id`,
            [institutionId]
        );
    } else {
        result = await query(`DELETE FROM sandbox_transactions RETURNING id`);
    }
    return { deleted: result.rowCount };
};

/**
 * Simulate network latency
 */
const simulateLatency = async (min, max) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
};

// ============================================================================
// Request Logging
// ============================================================================

/**
 * Log API request
 */
const logRequest = async (requestData) => {
    if (!config.features.requestLogs) return;

    const {
        institutionId,
        method,
        path,
        headers,
        body,
        query: queryParams,
        ip
    } = requestData;

    // Sanitize sensitive data
    const sanitizedHeaders = sanitizeHeaders(headers);
    const sanitizedBody = sanitizeBody(body);

    const result = await query(
        `INSERT INTO request_logs
         (institution_id, method, path, headers, body, query_params, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
            institutionId,
            method,
            path,
            JSON.stringify(sanitizedHeaders),
            JSON.stringify(sanitizedBody),
            JSON.stringify(queryParams),
            ip
        ]
    );

    return result.rows[0].id;
};

/**
 * Log API response
 */
const logResponse = async (logId, responseData) => {
    if (!config.features.requestLogs || !logId) return;

    const { statusCode, body, duration } = responseData;

    await query(
        `UPDATE request_logs
         SET status_code = $2,
             response_body = $3,
             duration_ms = $4,
             responded_at = NOW()
         WHERE id = $1`,
        [logId, statusCode, JSON.stringify(body), duration]
    );
};

/**
 * Sanitize headers (remove sensitive info)
 */
const sanitizeHeaders = (headers) => {
    const sensitive = ['authorization', 'x-api-key', 'x-signature', 'cookie'];
    const sanitized = { ...headers };

    for (const key of sensitive) {
        if (sanitized[key]) {
            sanitized[key] = '[REDACTED]';
        }
    }

    return sanitized;
};

/**
 * Sanitize request body (mask sensitive fields)
 */
const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'pin', 'cvv', 'cardNumber', 'apiKey', 'secret'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
};

/**
 * Get request logs
 */
const getRequestLogs = async (options = {}) => {
    const {
        institutionId,
        method,
        path,
        statusCode,
        startDate,
        endDate,
        limit = 100,
        offset = 0
    } = options;

    let sql = `SELECT * FROM request_logs WHERE 1=1`;
    const params = [];

    if (institutionId) {
        params.push(institutionId);
        sql += ` AND institution_id = $${params.length}`;
    }

    if (method) {
        params.push(method);
        sql += ` AND method = $${params.length}`;
    }

    if (path) {
        params.push(`%${path}%`);
        sql += ` AND path LIKE $${params.length}`;
    }

    if (statusCode) {
        params.push(statusCode);
        sql += ` AND status_code = $${params.length}`;
    }

    if (startDate) {
        params.push(startDate);
        sql += ` AND created_at >= $${params.length}`;
    }

    if (endDate) {
        params.push(endDate);
        sql += ` AND created_at <= $${params.length}`;
    }

    params.push(limit, offset);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(sql, params);
    return result.rows;
};

/**
 * Get request log by ID
 */
const getRequestLog = async (logId) => {
    const result = await query(
        `SELECT * FROM request_logs WHERE id = $1`,
        [logId]
    );
    return result.rows[0];
};

/**
 * Get request log statistics
 */
const getRequestLogStats = async (institutionId = null, hours = 24) => {
    let sql = `
        SELECT
            method,
            path,
            COUNT(*) as total_requests,
            COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
            COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
            AVG(duration_ms) as avg_duration,
            MIN(duration_ms) as min_duration,
            MAX(duration_ms) as max_duration,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration
        FROM request_logs
        WHERE created_at > NOW() - INTERVAL '1 hour' * $1
    `;
    const params = [hours];

    if (institutionId) {
        params.push(institutionId);
        sql += ` AND institution_id = $${params.length}`;
    }

    sql += ` GROUP BY method, path ORDER BY total_requests DESC`;

    const result = await query(sql, params);
    return result.rows;
};

/**
 * Cleanup old request logs
 */
const cleanupRequestLogs = async (olderThanDays = 30) => {
    const result = await query(
        `DELETE FROM request_logs
         WHERE created_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id`,
        [olderThanDays]
    );
    return { deleted: result.rowCount };
};

// ============================================================================
// Webhook Testing
// ============================================================================

/**
 * Create a webhook test
 */
const createWebhookTest = async (institutionId, testData) => {
    const {
        webhookUrl,
        eventType = 'FT_CALLBACK',
        payload = null
    } = testData;

    // Generate test payload if not provided
    const testPayload = payload || generateTestPayload(eventType);

    const result = await query(
        `INSERT INTO webhook_tests
         (institution_id, webhook_url, event_type, request_payload, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING *`,
        [institutionId, webhookUrl, eventType, JSON.stringify(testPayload)]
    );

    const test = result.rows[0];

    // Execute webhook test
    executeWebhookTest(test.id, webhookUrl, testPayload);

    return {
        testId: test.id,
        status: 'PENDING',
        message: 'Webhook test initiated'
    };
};

/**
 * Generate test payload for webhook
 */
const generateTestPayload = (eventType) => {
    const basePayload = {
        testMode: true,
        timestamp: new Date().toISOString(),
        eventId: `TEST_${Date.now()}`
    };

    switch (eventType) {
        case 'FT_CALLBACK':
            return {
                ...basePayload,
                transactionRef: `TEST${Date.now()}`,
                responseCode: '000',
                statusCode: '000',
                amount: 10000,
                currency: 'GHS',
                debitAccount: '1234567890',
                creditAccount: '0987654321'
            };

        case 'NEC_RESPONSE':
            return {
                ...basePayload,
                accountNumber: '1234567890',
                accountName: 'TEST ACCOUNT',
                responseCode: '000'
            };

        case 'ALERT':
            return {
                ...basePayload,
                alertType: 'TEST_ALERT',
                severity: 'INFO',
                message: 'This is a test webhook alert'
            };

        default:
            return basePayload;
    }
};

/**
 * Execute webhook test (async)
 */
const executeWebhookTest = async (testId, webhookUrl, payload) => {
    const startTime = Date.now();
    let response;
    let error = null;

    try {
        const https = require('https');
        const http = require('http');
        const url = new URL(webhookUrl);
        const client = url.protocol === 'https:' ? https : http;

        const postData = JSON.stringify(payload);

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-Webhook-Test': 'true',
                'X-Test-ID': testId.toString()
            },
            timeout: 30000
        };

        response = await new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });

    } catch (err) {
        error = err.message;
    }

    const duration = Date.now() - startTime;

    // Update test record
    await query(
        `UPDATE webhook_tests
         SET status = $2,
             response_status = $3,
             response_body = $4,
             response_time_ms = $5,
             error_message = $6,
             executed_at = NOW()
         WHERE id = $1`,
        [
            testId,
            error ? 'FAILED' : (response.statusCode >= 200 && response.statusCode < 300 ? 'SUCCESS' : 'FAILED'),
            response?.statusCode,
            response?.body?.substring(0, 10000),
            duration,
            error
        ]
    );
};

/**
 * Get webhook test result
 */
const getWebhookTest = async (testId) => {
    const result = await query(
        `SELECT * FROM webhook_tests WHERE id = $1`,
        [testId]
    );
    return result.rows[0];
};

/**
 * Get webhook test history
 */
const getWebhookTestHistory = async (institutionId, limit = 20) => {
    const result = await query(
        `SELECT * FROM webhook_tests
         WHERE institution_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [institutionId, limit]
    );
    return result.rows;
};

// ============================================================================
// API Documentation Generation
// ============================================================================

/**
 * Generate OpenAPI specification
 */
const generateOpenAPISpec = () => {
    return {
        openapi: '3.0.3',
        info: {
            title: 'Fund Management API',
            version: '2.0.0',
            description: 'API for GIP-based fund transfers and account management'
        },
        servers: [
            {
                url: config.features.sandboxMode ? '/api/sandbox' : '/api',
                description: config.features.sandboxMode ? 'Sandbox Server' : 'Production Server'
            }
        ],
        paths: {
            '/nec': {
                post: {
                    summary: 'Name Enquiry',
                    description: 'Validate account and retrieve account holder name',
                    tags: ['Transactions'],
                    security: [{ ApiKeyAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['accountNumber', 'bankCode'],
                                    properties: {
                                        accountNumber: { type: 'string', example: '1234567890' },
                                        bankCode: { type: 'string', example: '300001' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Successful name enquiry',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            accountName: { type: 'string' },
                                            responseCode: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/ft': {
                post: {
                    summary: 'Funds Transfer',
                    description: 'Initiate a funds transfer',
                    tags: ['Transactions'],
                    security: [{ ApiKeyAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['amount', 'debitAccount', 'creditAccount', 'bankCode'],
                                    properties: {
                                        amount: { type: 'number', example: 10000 },
                                        debitAccount: { type: 'string' },
                                        creditAccount: { type: 'string' },
                                        bankCode: { type: 'string' },
                                        narration: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '202': {
                            description: 'Transfer accepted for processing'
                        }
                    }
                }
            },
            '/tsq': {
                post: {
                    summary: 'Transaction Status Query',
                    description: 'Query the status of a transaction',
                    tags: ['Transactions'],
                    security: [{ ApiKeyAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['transactionRef'],
                                    properties: {
                                        transactionRef: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Transaction status retrieved'
                        }
                    }
                }
            }
        },
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key'
                }
            }
        }
    };
};

// ============================================================================
// Feature Status
// ============================================================================

/**
 * Get developer feature status
 */
const getFeatureStatus = () => {
    return {
        sandboxMode: {
            enabled: config.features.sandboxMode,
            autoCallback: config.features.sandboxMode ? config.sandbox.autoCallback : false,
            callbackDelay: config.features.sandboxMode ? config.sandbox.callbackDelay : null
        },
        requestLogs: {
            enabled: config.features.requestLogs
        },
        webhookTesting: {
            enabled: config.features.webhookTesting
        },
        apiDocs: {
            enabled: config.features.apiDocs
        }
    };
};

module.exports = {
    // Sandbox
    isSandboxMode,
    simulateNEC,
    simulateFT,
    simulateTSQ,
    getSandboxTransaction,
    getSandboxHistory,
    clearSandboxData,

    // Request Logging
    logRequest,
    logResponse,
    getRequestLogs,
    getRequestLog,
    getRequestLogStats,
    cleanupRequestLogs,

    // Webhook Testing
    createWebhookTest,
    getWebhookTest,
    getWebhookTestHistory,

    // API Documentation
    generateOpenAPISpec,

    // Status
    getFeatureStatus
};
