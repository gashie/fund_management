/**
 * Resilience Service
 * Circuit breaker, request queuing, and idempotency key management
 */

const { query } = require('../../models/db');
const config = require('../../config');

// ============================================================================
// Circuit Breaker
// ============================================================================

// In-memory circuit breaker state (backed by database for persistence)
const circuitBreakers = new Map();

const CIRCUIT_STATES = {
    CLOSED: 'CLOSED',       // Normal operation
    OPEN: 'OPEN',           // Failing, reject requests
    HALF_OPEN: 'HALF_OPEN'  // Testing recovery
};

/**
 * Get or initialize circuit breaker for a service
 */
const getCircuitBreaker = async (serviceName) => {
    if (!config.features.circuitBreaker) {
        return { state: CIRCUIT_STATES.CLOSED, allowed: true };
    }

    // Check in-memory cache first
    if (circuitBreakers.has(serviceName)) {
        const breaker = circuitBreakers.get(serviceName);

        // Check if we should transition from OPEN to HALF_OPEN
        if (breaker.state === CIRCUIT_STATES.OPEN) {
            const resetTime = new Date(breaker.openedAt.getTime() + config.resilience.circuitBreaker.resetTimeout);
            if (new Date() >= resetTime) {
                breaker.state = CIRCUIT_STATES.HALF_OPEN;
                breaker.halfOpenRequests = 0;
                await persistCircuitState(serviceName, breaker);
            }
        }

        return breaker;
    }

    // Load from database or create new
    const result = await query(
        `SELECT * FROM circuit_breaker_state WHERE service_name = $1`,
        [serviceName]
    );

    let breaker;
    if (result.rows.length > 0) {
        const row = result.rows[0];
        breaker = {
            state: row.state,
            failureCount: row.failure_count,
            successCount: row.success_count,
            lastFailure: row.last_failure_at,
            openedAt: row.opened_at,
            halfOpenRequests: 0
        };
    } else {
        breaker = {
            state: CIRCUIT_STATES.CLOSED,
            failureCount: 0,
            successCount: 0,
            lastFailure: null,
            openedAt: null,
            halfOpenRequests: 0
        };
    }

    circuitBreakers.set(serviceName, breaker);
    return breaker;
};

/**
 * Check if request should be allowed through circuit breaker
 */
const checkCircuitBreaker = async (serviceName) => {
    if (!config.features.circuitBreaker) {
        return { allowed: true, state: CIRCUIT_STATES.CLOSED };
    }

    const breaker = await getCircuitBreaker(serviceName);

    switch (breaker.state) {
        case CIRCUIT_STATES.CLOSED:
            return { allowed: true, state: breaker.state };

        case CIRCUIT_STATES.OPEN:
            return {
                allowed: false,
                state: breaker.state,
                retryAfter: new Date(breaker.openedAt.getTime() + config.resilience.circuitBreaker.resetTimeout)
            };

        case CIRCUIT_STATES.HALF_OPEN:
            // Allow limited requests in half-open state
            if (breaker.halfOpenRequests < config.resilience.circuitBreaker.halfOpenRequests) {
                breaker.halfOpenRequests++;
                return { allowed: true, state: breaker.state };
            }
            return { allowed: false, state: breaker.state };

        default:
            return { allowed: true, state: CIRCUIT_STATES.CLOSED };
    }
};

/**
 * Record successful request
 */
const recordSuccess = async (serviceName) => {
    if (!config.features.circuitBreaker) return;

    const breaker = await getCircuitBreaker(serviceName);

    if (breaker.state === CIRCUIT_STATES.HALF_OPEN) {
        breaker.successCount++;

        // If enough successes in half-open, close the circuit
        if (breaker.successCount >= config.resilience.circuitBreaker.successThreshold) {
            breaker.state = CIRCUIT_STATES.CLOSED;
            breaker.failureCount = 0;
            breaker.successCount = 0;
            breaker.openedAt = null;
        }
    } else if (breaker.state === CIRCUIT_STATES.CLOSED) {
        // Reset failure count on success
        breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }

    await persistCircuitState(serviceName, breaker);
};

/**
 * Record failed request
 */
const recordFailure = async (serviceName, error) => {
    if (!config.features.circuitBreaker) return;

    const breaker = await getCircuitBreaker(serviceName);
    breaker.failureCount++;
    breaker.lastFailure = new Date();

    if (breaker.state === CIRCUIT_STATES.HALF_OPEN) {
        // Any failure in half-open opens the circuit again
        breaker.state = CIRCUIT_STATES.OPEN;
        breaker.openedAt = new Date();
        breaker.successCount = 0;
    } else if (breaker.state === CIRCUIT_STATES.CLOSED) {
        // Check if we should open the circuit
        if (breaker.failureCount >= config.resilience.circuitBreaker.failureThreshold) {
            breaker.state = CIRCUIT_STATES.OPEN;
            breaker.openedAt = new Date();
        }
    }

    await persistCircuitState(serviceName, breaker);
};

/**
 * Persist circuit breaker state to database
 */
const persistCircuitState = async (serviceName, breaker) => {
    await query(
        `INSERT INTO circuit_breaker_state
         (service_name, state, failure_count, success_count, last_failure_at, opened_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (service_name)
         DO UPDATE SET
            state = $2,
            failure_count = $3,
            success_count = $4,
            last_failure_at = $5,
            opened_at = $6,
            updated_at = NOW()`,
        [
            serviceName,
            breaker.state,
            breaker.failureCount,
            breaker.successCount,
            breaker.lastFailure,
            breaker.openedAt
        ]
    );
};

/**
 * Get all circuit breaker states for monitoring
 */
const getAllCircuitStates = async () => {
    const result = await query(
        `SELECT * FROM circuit_breaker_state ORDER BY service_name`
    );
    return result.rows;
};

/**
 * Manually reset a circuit breaker
 */
const resetCircuitBreaker = async (serviceName) => {
    const breaker = {
        state: CIRCUIT_STATES.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailure: null,
        openedAt: null,
        halfOpenRequests: 0
    };

    circuitBreakers.set(serviceName, breaker);
    await persistCircuitState(serviceName, breaker);

    return { success: true, serviceName, state: CIRCUIT_STATES.CLOSED };
};

// ============================================================================
// Request Queuing
// ============================================================================

/**
 * Queue a request for later processing
 */
const queueRequest = async (requestData) => {
    if (!config.features.requestQueuing) {
        return { queued: false, reason: 'Request queuing is disabled' };
    }

    const {
        institutionId,
        requestType,
        payload,
        priority = 'NORMAL',
        maxAttempts = 3,
        scheduledFor = null
    } = requestData;

    const result = await query(
        `INSERT INTO request_queue
         (institution_id, request_type, payload, priority, max_attempts, scheduled_for, status)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), 'PENDING')
         RETURNING *`,
        [institutionId, requestType, JSON.stringify(payload), priority, maxAttempts, scheduledFor]
    );

    return {
        queued: true,
        queueId: result.rows[0].id,
        position: await getQueuePosition(result.rows[0].id)
    };
};

/**
 * Get queue position for a request
 */
const getQueuePosition = async (queueId) => {
    const result = await query(
        `SELECT COUNT(*) as position
         FROM request_queue
         WHERE status = 'PENDING'
         AND (scheduled_for IS NULL OR scheduled_for <= NOW())
         AND id < $1`,
        [queueId]
    );
    return parseInt(result.rows[0].position) + 1;
};

/**
 * Get next requests to process from queue
 */
const getNextQueuedRequests = async (limit = 10) => {
    const result = await query(
        `UPDATE request_queue
         SET status = 'PROCESSING',
             started_at = NOW(),
             attempts = attempts + 1
         WHERE id IN (
             SELECT id FROM request_queue
             WHERE status = 'PENDING'
             AND (scheduled_for IS NULL OR scheduled_for <= NOW())
             AND attempts < max_attempts
             ORDER BY
                 CASE priority
                     WHEN 'URGENT' THEN 1
                     WHEN 'HIGH' THEN 2
                     WHEN 'NORMAL' THEN 3
                     WHEN 'LOW' THEN 4
                 END,
                 created_at
             LIMIT $1
             FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [limit]
    );

    return result.rows.map(row => ({
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    }));
};

/**
 * Mark queued request as completed
 */
const completeQueuedRequest = async (queueId, result) => {
    await query(
        `UPDATE request_queue
         SET status = 'COMPLETED',
             completed_at = NOW(),
             result = $2
         WHERE id = $1`,
        [queueId, JSON.stringify(result)]
    );
};

/**
 * Mark queued request as failed
 */
const failQueuedRequest = async (queueId, error, retry = true) => {
    const checkResult = await query(
        `SELECT attempts, max_attempts FROM request_queue WHERE id = $1`,
        [queueId]
    );

    if (checkResult.rows.length === 0) return;

    const { attempts, max_attempts } = checkResult.rows[0];
    const shouldRetry = retry && attempts < max_attempts;

    await query(
        `UPDATE request_queue
         SET status = $2,
             last_error = $3,
             completed_at = CASE WHEN $2 = 'FAILED' THEN NOW() ELSE NULL END
         WHERE id = $1`,
        [queueId, shouldRetry ? 'PENDING' : 'FAILED', error]
    );
};

/**
 * Get queue statistics
 */
const getQueueStats = async () => {
    const result = await query(
        `SELECT
            status,
            priority,
            COUNT(*) as count,
            AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))) as avg_wait_seconds
         FROM request_queue
         WHERE created_at > NOW() - INTERVAL '24 hours'
         GROUP BY status, priority
         ORDER BY status, priority`
    );

    return result.rows;
};

/**
 * Clear old completed/failed requests
 */
const cleanupQueue = async (olderThanDays = 7) => {
    const result = await query(
        `DELETE FROM request_queue
         WHERE status IN ('COMPLETED', 'FAILED')
         AND completed_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id`,
        [olderThanDays]
    );

    return { deleted: result.rowCount };
};

// ============================================================================
// Idempotency Keys
// ============================================================================

/**
 * Check if request with idempotency key has been processed
 */
const checkIdempotencyKey = async (idempotencyKey, institutionId) => {
    if (!config.features.idempotencyKeys) {
        return { exists: false };
    }

    const result = await query(
        `SELECT * FROM idempotency_keys
         WHERE idempotency_key = $1
         AND institution_id = $2
         AND expires_at > NOW()`,
        [idempotencyKey, institutionId]
    );

    if (result.rows.length === 0) {
        return { exists: false };
    }

    const record = result.rows[0];
    return {
        exists: true,
        status: record.status,
        response: record.response ? JSON.parse(record.response) : null,
        createdAt: record.created_at
    };
};

/**
 * Store idempotency key (mark as processing)
 */
const storeIdempotencyKey = async (idempotencyKey, institutionId, requestHash) => {
    if (!config.features.idempotencyKeys) return { stored: false };

    const expiresAt = new Date(Date.now() + config.resilience.idempotency.ttl);

    try {
        await query(
            `INSERT INTO idempotency_keys
             (idempotency_key, institution_id, request_hash, status, expires_at)
             VALUES ($1, $2, $3, 'PROCESSING', $4)`,
            [idempotencyKey, institutionId, requestHash, expiresAt]
        );
        return { stored: true };
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            // Key already exists, check if it's for the same request
            const existing = await checkIdempotencyKey(idempotencyKey, institutionId);
            return { stored: false, existing };
        }
        throw error;
    }
};

/**
 * Complete idempotency record with response
 */
const completeIdempotencyKey = async (idempotencyKey, institutionId, response) => {
    if (!config.features.idempotencyKeys) return;

    await query(
        `UPDATE idempotency_keys
         SET status = 'COMPLETED',
             response = $3,
             completed_at = NOW()
         WHERE idempotency_key = $1
         AND institution_id = $2`,
        [idempotencyKey, institutionId, JSON.stringify(response)]
    );
};

/**
 * Fail idempotency record
 */
const failIdempotencyKey = async (idempotencyKey, institutionId, error) => {
    if (!config.features.idempotencyKeys) return;

    await query(
        `UPDATE idempotency_keys
         SET status = 'FAILED',
             response = $3,
             completed_at = NOW()
         WHERE idempotency_key = $1
         AND institution_id = $2`,
        [idempotencyKey, institutionId, JSON.stringify({ error })]
    );
};

/**
 * Create hash from request for comparison
 */
const createRequestHash = (request) => {
    const crypto = require('crypto');
    const normalized = JSON.stringify(request, Object.keys(request).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Cleanup expired idempotency keys
 */
const cleanupIdempotencyKeys = async () => {
    const result = await query(
        `DELETE FROM idempotency_keys
         WHERE expires_at < NOW()
         RETURNING idempotency_key`
    );

    return { deleted: result.rowCount };
};

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Execute function with retry logic
 */
const withRetry = async (fn, options = {}) => {
    const {
        maxAttempts = 3,
        delay = 1000,
        backoff = 'exponential', // 'linear', 'exponential', 'fixed'
        onRetry = null
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;

            if (attempt < maxAttempts) {
                let waitTime;
                switch (backoff) {
                    case 'exponential':
                        waitTime = delay * Math.pow(2, attempt - 1);
                        break;
                    case 'linear':
                        waitTime = delay * attempt;
                        break;
                    default:
                        waitTime = delay;
                }

                if (onRetry) {
                    onRetry(attempt, error, waitTime);
                }

                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw lastError;
};

/**
 * Execute with circuit breaker protection
 */
const withCircuitBreaker = async (serviceName, fn) => {
    const check = await checkCircuitBreaker(serviceName);

    if (!check.allowed) {
        const error = new Error(`Circuit breaker OPEN for ${serviceName}`);
        error.circuitBreaker = true;
        error.retryAfter = check.retryAfter;
        throw error;
    }

    try {
        const result = await fn();
        await recordSuccess(serviceName);
        return result;
    } catch (error) {
        await recordFailure(serviceName, error.message);
        throw error;
    }
};

// ============================================================================
// Feature Status
// ============================================================================

/**
 * Get resilience feature status
 */
const getFeatureStatus = () => {
    return {
        circuitBreaker: {
            enabled: config.features.circuitBreaker,
            config: config.features.circuitBreaker ? {
                failureThreshold: config.resilience.circuitBreaker.failureThreshold,
                resetTimeout: config.resilience.circuitBreaker.resetTimeout,
                halfOpenRequests: config.resilience.circuitBreaker.halfOpenRequests
            } : null
        },
        requestQueuing: {
            enabled: config.features.requestQueuing
        },
        idempotencyKeys: {
            enabled: config.features.idempotencyKeys,
            ttl: config.features.idempotencyKeys ? config.resilience.idempotency.ttl : null
        }
    };
};

module.exports = {
    // Circuit Breaker
    CIRCUIT_STATES,
    checkCircuitBreaker,
    recordSuccess,
    recordFailure,
    getAllCircuitStates,
    resetCircuitBreaker,
    withCircuitBreaker,

    // Request Queue
    queueRequest,
    getNextQueuedRequests,
    completeQueuedRequest,
    failQueuedRequest,
    getQueueStats,
    cleanupQueue,

    // Idempotency
    checkIdempotencyKey,
    storeIdempotencyKey,
    completeIdempotencyKey,
    failIdempotencyKey,
    createRequestHash,
    cleanupIdempotencyKeys,

    // Utilities
    withRetry,
    getFeatureStatus
};
