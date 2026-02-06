/**
 * Transaction Middleware Layer
 * Handles all NEC and FT request processing with proper state management
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { toSnakeCase, formatAmount, convertTimestampToCustomFormat } = require('../helper/func');

// TSQ Response Code Rules
const TSQ_RULES = {
    // Scenario 1: Transaction found and successful
    SUCCESS: { actionCode: '000', statusCode: '000', action: 'SUCCESS', message: 'Transaction successful' },

    // Scenario 2: Mismatched values
    MISMATCH: { actionCode: '381', statusCode: null, action: 'RETRY', message: 'Mismatched values - use correct values and retry' },

    // Scenario 3: Previous day transaction
    PREVIOUS_DAY: { actionCode: '381', statusCode: null, action: 'MANUAL_CHECK', message: 'Check settlement report or contact GhIPSS' },

    // Scenario 4: Field validation error
    VALIDATION_ERROR: { actionCode: '999', statusCode: null, action: 'FIX_REQUEST', message: 'Ensure all required fields are passed' },

    // Scenario 5: Being processed by receiving institution
    PROCESSING: { actionCode: '000', statusCode: '990', action: 'RETRY_LATER', message: 'Retry at 5 min intervals', retryInterval: 5 },

    // Scenario 6: Found at GhIPSS but not at receiving institution
    NOT_AT_RECEIVER: { actionCode: '000', statusCode: '381', action: 'FAIL', message: 'Fail original transaction' },

    // Scenario 7: Exception during TSQ
    EXCEPTION: { actionCode: '990', statusCode: null, action: 'RETRY_LATER', message: 'Retry at 5 min intervals', retryInterval: 5 },
};

// Inconclusive action codes that require TSQ
const INCONCLUSIVE_CODES = ['909', '912', '990', null, undefined, ''];

/**
 * Determines the TSQ action based on response codes
 */
function determineTsqAction(actionCode, statusCode) {
    // Scenario 1: Success
    if (actionCode === '000' && statusCode === '000') {
        return TSQ_RULES.SUCCESS;
    }

    // Scenario 5: Processing
    if (actionCode === '000' && statusCode === '990') {
        return TSQ_RULES.PROCESSING;
    }

    // Scenario 6: Not at receiver
    if (actionCode === '000' && statusCode === '381') {
        return TSQ_RULES.NOT_AT_RECEIVER;
    }

    // Scenario 2 & 3: Mismatch
    if (actionCode === '381' && !statusCode) {
        return TSQ_RULES.MISMATCH;
    }

    // Scenario 4: Validation error
    if (actionCode === '999' && !statusCode) {
        return TSQ_RULES.VALIDATION_ERROR;
    }

    // Scenario 7: Exception
    if (actionCode === '990' && !statusCode) {
        return TSQ_RULES.EXCEPTION;
    }

    // Default: Unknown combination
    return { actionCode, statusCode, action: 'UNKNOWN', message: 'Unknown response combination' };
}

/**
 * Transaction State Machine
 */
const TransactionStateMachine = {
    INITIATED: ['NEC_PENDING', 'FTD_PENDING', 'FAILED'],
    NEC_PENDING: ['NEC_SUCCESS', 'NEC_FAILED'],
    NEC_SUCCESS: ['FTD_PENDING', 'COMPLETED'],  // NEC only can complete here
    NEC_FAILED: ['FAILED'],
    FTD_PENDING: ['FTD_SUCCESS', 'FTD_FAILED', 'FTD_TSQ', 'TIMEOUT'],
    FTD_TSQ: ['FTD_SUCCESS', 'FTD_FAILED', 'TIMEOUT'],
    FTD_SUCCESS: ['FTC_PENDING'],
    FTD_FAILED: ['FAILED'],
    FTC_PENDING: ['FTC_SUCCESS', 'FTC_FAILED', 'FTC_TSQ', 'TIMEOUT'],
    FTC_TSQ: ['FTC_SUCCESS', 'FTC_FAILED', 'TIMEOUT'],
    FTC_SUCCESS: ['COMPLETED'],
    FTC_FAILED: ['REVERSAL_PENDING'],  // CRITICAL: FTC failure triggers reversal
    REVERSAL_PENDING: ['REVERSAL_SUCCESS', 'REVERSAL_FAILED'],
    REVERSAL_SUCCESS: ['FAILED'],  // Transaction failed but money returned
    REVERSAL_FAILED: ['FAILED'],  // CRITICAL: Needs manual intervention
    COMPLETED: [],
    FAILED: [],
    TIMEOUT: [],
};

/**
 * Validates state transition
 */
function canTransitionTo(currentStatus, newStatus) {
    const allowedTransitions = TransactionStateMachine[currentStatus];
    return allowedTransitions && allowedTransitions.includes(newStatus);
}

/**
 * Middleware to authenticate institution API credentials
 */
async function authenticateInstitution(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['api_key'];
    const apiSecret = req.headers['x-api-secret'] || req.headers['api_secret'];

    if (!apiKey || !apiSecret) {
        return res.status(401).json({
            responseCode: '401',
            responseMessage: 'Missing API credentials',
            status: 'UNAUTHORIZED'
        });
    }

    try {
        const pool = req.app.get('db');
        const result = await pool.query(`
            SELECT
                ic.id as credential_id,
                ic.institution_id,
                ic.api_secret_hash,
                ic.permissions,
                ic.rate_limit_per_minute,
                ic.is_active as credential_active,
                i.id as institution_id,
                i.institution_code,
                i.institution_name,
                i.webhook_url,
                i.ip_whitelist,
                i.is_active as institution_active,
                i.is_sandbox
            FROM institution_credentials ic
            JOIN institutions i ON ic.institution_id = i.id
            WHERE ic.api_key = $1
              AND ic.is_active = true
              AND ic.revoked_at IS NULL
              AND (ic.expires_at IS NULL OR ic.expires_at > CURRENT_TIMESTAMP)
              AND i.is_active = true
              AND i.deleted_at IS NULL
        `, [apiKey]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                responseCode: '401',
                responseMessage: 'Invalid API credentials',
                status: 'UNAUTHORIZED'
            });
        }

        const credential = result.rows[0];

        // Verify API secret (compare hash)
        const secretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');
        if (secretHash !== credential.api_secret_hash) {
            return res.status(401).json({
                responseCode: '401',
                responseMessage: 'Invalid API credentials',
                status: 'UNAUTHORIZED'
            });
        }

        // Check IP whitelist
        if (credential.ip_whitelist && credential.ip_whitelist.length > 0) {
            const clientIp = req.ip || req.connection.remoteAddress;
            if (!credential.ip_whitelist.includes(clientIp)) {
                return res.status(403).json({
                    responseCode: '403',
                    responseMessage: 'IP not authorized',
                    status: 'FORBIDDEN'
                });
            }
        }

        // Update last used
        await pool.query(
            'UPDATE institution_credentials SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
            [credential.credential_id]
        );

        // Attach institution info to request
        req.institution = {
            id: credential.institution_id,
            credentialId: credential.credential_id,
            code: credential.institution_code,
            name: credential.institution_name,
            webhookUrl: credential.webhook_url,
            permissions: credential.permissions,
            isSandbox: credential.is_sandbox
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            responseCode: '500',
            responseMessage: 'Authentication service error',
            status: 'ERROR'
        });
    }
}

/**
 * Check rate limiting for institution
 */
async function checkRateLimit(req, res, next) {
    try {
        const pool = req.app.get('db');
        const credentialId = req.institution.credentialId;

        // Get current minute window
        const windowStart = new Date();
        windowStart.setSeconds(0, 0);

        // Upsert rate limit record
        const result = await pool.query(`
            INSERT INTO institution_rate_limits (credential_id, window_start, window_type, request_count)
            VALUES ($1, $2, 'minute', 1)
            ON CONFLICT (credential_id, window_start, window_type)
            DO UPDATE SET request_count = institution_rate_limits.request_count + 1
            RETURNING request_count
        `, [credentialId, windowStart]);

        const count = result.rows[0].request_count;

        // Check against limit (get from credentials or use default)
        const limitResult = await pool.query(
            'SELECT rate_limit_per_minute FROM institution_credentials WHERE id = $1',
            [credentialId]
        );
        const limit = limitResult.rows[0]?.rate_limit_per_minute || 60;

        if (count > limit) {
            return res.status(429).json({
                responseCode: '429',
                responseMessage: 'Rate limit exceeded',
                status: 'TOO_MANY_REQUESTS',
                retryAfter: 60 - new Date().getSeconds()
            });
        }

        next();
    } catch (error) {
        console.error('Rate limit check error:', error);
        // Don't block on rate limit errors, just log
        next();
    }
}

/**
 * Check if institution has permission for the operation
 */
function checkPermission(operation) {
    return (req, res, next) => {
        const permissions = req.institution.permissions || [];
        if (!permissions.includes(operation) && !permissions.includes('*')) {
            return res.status(403).json({
                responseCode: '403',
                responseMessage: `Not authorized for ${operation} operations`,
                status: 'FORBIDDEN'
            });
        }
        next();
    };
}

/**
 * Validate participant bank codes
 */
async function validateParticipants(req, res, next) {
    try {
        const pool = req.app.get('db');
        const payload = toSnakeCase(req.body);

        const srcBankCode = payload.src_bank_code;
        const destBankCode = payload.dest_bank_code;

        // Check both bank codes exist and are active
        const result = await pool.query(`
            SELECT bank_code, bank_name, supports_nec, supports_ft
            FROM participants
            WHERE bank_code IN ($1, $2)
              AND is_active = true
        `, [srcBankCode, destBankCode]);

        const participants = {};
        result.rows.forEach(row => {
            participants[row.bank_code] = row;
        });

        if (!participants[srcBankCode]) {
            return res.status(400).json({
                responseCode: '381',
                responseMessage: `Invalid source bank code: ${srcBankCode}`,
                status: 'VALIDATION_ERROR'
            });
        }

        if (!participants[destBankCode]) {
            return res.status(400).json({
                responseCode: '381',
                responseMessage: `Invalid destination bank code: ${destBankCode}`,
                status: 'VALIDATION_ERROR'
            });
        }

        req.participants = {
            source: participants[srcBankCode],
            destination: participants[destBankCode]
        };

        next();
    } catch (error) {
        console.error('Participant validation error:', error);
        return res.status(500).json({
            responseCode: '500',
            responseMessage: 'Validation service error',
            status: 'ERROR'
        });
    }
}

/**
 * Check for duplicate reference number
 */
async function checkDuplicateReference(req, res, next) {
    try {
        const pool = req.app.get('db');
        const payload = toSnakeCase(req.body);
        const referenceNumber = payload.reference_number;

        const result = await pool.query(
            'SELECT id, status FROM transactions WHERE reference_number = $1',
            [referenceNumber]
        );

        if (result.rows.length > 0) {
            const existing = result.rows[0];
            return res.status(409).json({
                responseCode: '094',  // Duplicate record
                responseMessage: 'Duplicate reference number',
                status: 'DUPLICATE',
                existingTransactionId: existing.id,
                existingStatus: existing.status
            });
        }

        next();
    } catch (error) {
        console.error('Duplicate check error:', error);
        return res.status(500).json({
            responseCode: '500',
            responseMessage: 'Validation service error',
            status: 'ERROR'
        });
    }
}

/**
 * Generate unique transaction IDs
 */
async function generateTransactionIds(req, res, next) {
    try {
        const pool = req.app.get('db');

        const result = await pool.query('SELECT * FROM generate_transaction_ids()');

        if (result.rows.length === 0) {
            throw new Error('Failed to generate transaction IDs');
        }

        req.transactionIds = {
            sessionId: result.rows[0].session_id,
            trackingNumber: result.rows[0].tracking_number
        };

        next();
    } catch (error) {
        console.error('ID generation error:', error);
        return res.status(500).json({
            responseCode: '500',
            responseMessage: 'Failed to generate transaction identifiers',
            status: 'ERROR'
        });
    }
}

/**
 * Create transaction record
 */
async function createTransaction(transactionType) {
    return async (req, res, next) => {
        try {
            const pool = req.app.get('db');
            const payload = toSnakeCase(req.body);
            const dateTime = convertTimestampToCustomFormat();

            // Calculate timeout
            const timeoutMinutes = transactionType === 'NEC' ? 1 : 60;
            const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

            const result = await pool.query(`
                INSERT INTO transactions (
                    institution_id,
                    credential_id,
                    reference_number,
                    session_id,
                    tracking_number,
                    transaction_type,
                    amount,
                    amount_formatted,
                    src_bank_code,
                    src_account_number,
                    src_account_name,
                    dest_bank_code,
                    dest_account_number,
                    dest_account_name,
                    narration,
                    status,
                    client_callback_url,
                    client_ip,
                    user_agent,
                    request_timestamp,
                    timeout_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                RETURNING *
            `, [
                req.institution.id,
                req.institution.credentialId,
                payload.reference_number,
                req.transactionIds.sessionId,
                req.transactionIds.trackingNumber,
                transactionType,
                payload.amount || 0,
                formatAmount(payload.amount || 0),
                payload.src_bank_code,
                payload.src_account_number,
                payload.src_account_name || null,
                payload.dest_bank_code,
                payload.dest_account_number,
                payload.dest_account_name || null,
                payload.narration || null,
                'INITIATED',
                payload.callback_url || req.institution.webhookUrl,
                req.ip || req.connection.remoteAddress,
                req.headers['user-agent'],
                dateTime,
                timeoutAt
            ]);

            req.transaction = result.rows[0];

            // Create audit log entry
            await pool.query(`
                INSERT INTO audit_log (entity_type, entity_id, action, new_value, triggered_by, ip_address)
                VALUES ('transaction', $1, 'created', $2, $3, $4)
            `, [
                req.transaction.id,
                JSON.stringify({ status: 'INITIATED', type: transactionType }),
                'api',
                req.ip
            ]);

            next();
        } catch (error) {
            console.error('Transaction creation error:', error);
            return res.status(500).json({
                responseCode: '500',
                responseMessage: 'Failed to create transaction',
                status: 'ERROR'
            });
        }
    };
}

/**
 * Log GIP event
 */
async function logGipEvent(pool, transactionId, eventType, eventSequence, sessionId, trackingNumber, functionCode, requestPayload, responsePayload, actionCode, status) {
    const requestSentAt = new Date();

    await pool.query(`
        INSERT INTO gip_events (
            transaction_id,
            event_type,
            event_sequence,
            session_id,
            tracking_number,
            function_code,
            request_payload,
            response_payload,
            action_code,
            status,
            request_sent_at,
            response_received_at,
            duration_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
        transactionId,
        eventType,
        eventSequence,
        sessionId,
        trackingNumber,
        functionCode,
        requestPayload,
        responsePayload,
        actionCode,
        status,
        requestSentAt,
        new Date(),
        Date.now() - requestSentAt.getTime()
    ]);
}

/**
 * Update transaction status with validation
 */
async function updateTransactionStatus(pool, transactionId, newStatus, additionalFields = {}, triggeredBy = 'system') {
    // Get current status
    const current = await pool.query(
        'SELECT status FROM transactions WHERE id = $1',
        [transactionId]
    );

    if (current.rows.length === 0) {
        throw new Error('Transaction not found');
    }

    const currentStatus = current.rows[0].status;

    // Validate transition
    if (!canTransitionTo(currentStatus, newStatus)) {
        throw new Error(`Invalid state transition: ${currentStatus} -> ${newStatus}`);
    }

    // Build update query
    const setClauses = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [transactionId, newStatus];
    let paramIndex = 3;

    for (const [key, value] of Object.entries(additionalFields)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
    }

    // Add completed_at if terminal state
    if (['COMPLETED', 'FAILED', 'TIMEOUT'].includes(newStatus)) {
        setClauses.push('completed_at = CURRENT_TIMESTAMP');
    }

    await pool.query(
        `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = $1`,
        values
    );

    // Audit log
    await pool.query(`
        INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, triggered_by)
        VALUES ('transaction', $1, 'status_change', $2, $3, $4)
    `, [
        transactionId,
        JSON.stringify({ status: currentStatus }),
        JSON.stringify({ status: newStatus, ...additionalFields }),
        triggeredBy
    ]);
}

/**
 * Queue a job
 */
async function queueJob(pool, jobType, payload, priority = 0, scheduledFor = new Date()) {
    await pool.query(`
        INSERT INTO jobs (job_type, payload, priority, scheduled_for)
        VALUES ($1, $2, $3, $4)
    `, [jobType, payload, priority, scheduledFor]);
}

/**
 * Schedule TSQ check
 */
async function scheduleTsqCheck(pool, transactionId, tsqType, sessionId, trackingNumber, delayMinutes = 5) {
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

    await pool.query(`
        INSERT INTO tsq_queue (
            transaction_id,
            tsq_type,
            target_session_id,
            target_tracking_number,
            scheduled_for
        ) VALUES ($1, $2, $3, $4, $5)
    `, [transactionId, tsqType, sessionId, trackingNumber, scheduledFor]);

    // Also update transaction to mark TSQ is required
    await pool.query(`
        UPDATE transactions
        SET tsq_required = true, tsq_next_attempt_at = $2
        WHERE id = $1
    `, [transactionId, scheduledFor]);
}

/**
 * Schedule reversal
 */
async function scheduleReversal(pool, transactionId) {
    await pool.query(`
        UPDATE transactions
        SET reversal_required = true, status = 'REVERSAL_PENDING'
        WHERE id = $1
    `, [transactionId]);

    await queueJob(pool, 'PROCESS_REVERSAL', { transactionId }, 10);  // High priority
}

/**
 * Queue client callback
 */
async function queueClientCallback(pool, transactionId, institutionId, callbackUrl, payload) {
    await pool.query(`
        INSERT INTO client_callbacks (
            transaction_id,
            institution_id,
            callback_url,
            callback_payload,
            next_attempt_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [transactionId, institutionId, callbackUrl, payload]);

    await queueJob(pool, 'SEND_CLIENT_CALLBACK', { transactionId }, 5);
}

module.exports = {
    // Middleware functions
    authenticateInstitution,
    checkRateLimit,
    checkPermission,
    validateParticipants,
    checkDuplicateReference,
    generateTransactionIds,
    createTransaction,

    // Helper functions
    logGipEvent,
    updateTransactionStatus,
    queueJob,
    scheduleTsqCheck,
    scheduleReversal,
    queueClientCallback,
    determineTsqAction,
    canTransitionTo,

    // Constants
    TSQ_RULES,
    INCONCLUSIVE_CODES,
    TransactionStateMachine
};
