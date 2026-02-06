/**
 * Security Service
 * Handles IP whitelist, request signing, API key rotation, fraud detection, encryption
 */

const crypto = require('crypto');
const config = require('../../config');
const { query } = require('../../models/db');

// ============================================================================
// IP WHITELIST
// ============================================================================

/**
 * Validate client IP against whitelist
 */
const validateIpWhitelist = (clientIp, ipWhitelist) => {
    if (!config.features.ipWhitelist) return { valid: true };
    if (!ipWhitelist || ipWhitelist.length === 0) return { valid: true };

    const isValid = ipWhitelist.some(allowedIp => {
        // Exact match
        if (allowedIp === clientIp) return true;
        // CIDR notation (simplified)
        if (allowedIp.includes('/')) {
            return isIpInCidr(clientIp, allowedIp);
        }
        // Wildcard (e.g., 192.168.1.*)
        if (allowedIp.includes('*')) {
            const pattern = allowedIp.replace(/\./g, '\\.').replace(/\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(clientIp);
        }
        return false;
    });

    return {
        valid: isValid,
        message: isValid ? null : `IP ${clientIp} not in whitelist`
    };
};

/**
 * Simple CIDR check
 */
const isIpInCidr = (ip, cidr) => {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);
    return (ipNum & mask) === (rangeNum & mask);
};

const ipToNumber = (ip) => {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
};

// ============================================================================
// REQUEST SIGNING
// ============================================================================

/**
 * Validate request signature
 */
const validateRequestSignature = (signature, timestamp, body, apiSecret) => {
    if (!config.features.requestSigning) return { valid: true };

    const now = Math.floor(Date.now() / 1000);
    const reqTimestamp = parseInt(timestamp);

    // Check timestamp validity
    if (Math.abs(now - reqTimestamp) > config.security.signatureValiditySeconds) {
        return {
            valid: false,
            message: 'Request timestamp expired'
        };
    }

    // Calculate expected signature
    const data = `${timestamp}.${JSON.stringify(body)}`;
    const expectedSignature = crypto.createHmac('sha256', apiSecret).update(data).digest('hex');

    const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );

    // Log signature validation (for debugging)
    if (config.features.requestLogs) {
        logSignatureValidation(signature, expectedSignature, isValid).catch(console.error);
    }

    return {
        valid: isValid,
        message: isValid ? null : 'Invalid request signature'
    };
};

/**
 * Generate request signature (for client use)
 */
const generateRequestSignature = (body, apiSecret, timestamp = null) => {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const data = `${ts}.${JSON.stringify(body)}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
    return { signature, timestamp: ts };
};

const logSignatureValidation = async (received, expected, isValid) => {
    try {
        await query(`
            INSERT INTO request_signatures (signature_received, signature_expected, is_valid, failure_reason)
            VALUES ($1, $2, $3, $4)
        `, [received, expected, isValid, isValid ? null : 'Signature mismatch']);
    } catch (err) {
        console.error('Failed to log signature validation:', err);
    }
};

// ============================================================================
// API KEY ROTATION
// ============================================================================

/**
 * Check if API key needs rotation
 */
const checkKeyRotationStatus = async (credentialId, createdAt) => {
    if (!config.features.apiKeyRotation) return { needsRotation: false };

    const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const { keyRotationDays, keyRotationWarningDays } = config.security;

    return {
        needsRotation: ageInDays >= keyRotationDays,
        warningPeriod: ageInDays >= (keyRotationDays - keyRotationWarningDays),
        daysUntilExpiry: Math.max(0, Math.floor(keyRotationDays - ageInDays)),
        ageInDays: Math.floor(ageInDays)
    };
};

/**
 * Rotate API key
 */
const rotateApiKey = async (credentialId, rotatedBy = 'system') => {
    if (!config.features.apiKeyRotation) {
        throw { status: 400, message: 'API key rotation feature is disabled' };
    }

    // Generate new key
    const newApiKey = crypto.randomBytes(32).toString('hex');
    const newApiSecret = crypto.randomBytes(32).toString('hex');
    const newKeyHash = crypto.createHash('sha256').update(newApiKey).digest('hex');
    const newSecretHash = crypto.createHash('sha256').update(newApiSecret).digest('hex');

    // Get current key hash
    const current = await query(`
        SELECT api_key, api_secret_hash FROM api_credentials WHERE id = $1
    `, [credentialId]);

    if (current.rows.length === 0) {
        throw { status: 404, message: 'Credential not found' };
    }

    const oldKeyHash = crypto.createHash('sha256').update(current.rows[0].api_key).digest('hex');
    const gracePeriodEnds = new Date(Date.now() + config.security.keyGracePeriodHours * 60 * 60 * 1000);

    // Update credential
    await query(`
        UPDATE api_credentials
        SET api_key = $1, api_secret_hash = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
    `, [newApiKey, newSecretHash, credentialId]);

    // Log rotation
    await query(`
        INSERT INTO api_key_rotations (credential_id, old_key_hash, new_key_hash, rotated_by, grace_period_ends_at, reason)
        VALUES ($1, $2, $3, $4, $5, 'MANUAL')
    `, [credentialId, oldKeyHash, newKeyHash, rotatedBy, gracePeriodEnds]);

    return {
        apiKey: newApiKey,
        apiSecret: newApiSecret,
        gracePeriodEnds,
        warning: 'Store these credentials securely - shown only once'
    };
};

// ============================================================================
// FRAUD DETECTION
// ============================================================================

/**
 * Check transaction for fraud indicators
 */
const checkFraudIndicators = async (transaction, institution) => {
    if (!config.features.fraudDetection) return { flagged: false, alerts: [] };

    const alerts = [];
    const { fraud } = config.security;

    // 1. Amount check
    if (transaction.amount > fraud.maxAmountPerTransaction) {
        alerts.push({
            type: 'AMOUNT',
            severity: 'HIGH',
            description: `Amount ${transaction.amount} exceeds limit ${fraud.maxAmountPerTransaction}`
        });
    }

    // 2. Velocity check (transactions per minute)
    const velocityResult = await query(`
        SELECT COUNT(*) as count FROM transactions
        WHERE institution_id = $1
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '${fraud.velocityWindowMinutes} minutes'
    `, [institution.id]);

    if (parseInt(velocityResult.rows[0].count) >= fraud.maxTransactionsPerMinute) {
        alerts.push({
            type: 'VELOCITY',
            severity: 'MEDIUM',
            description: `Transaction velocity exceeds ${fraud.maxTransactionsPerMinute} per ${fraud.velocityWindowMinutes} minutes`
        });
    }

    // 3. Daily amount check
    const dailyResult = await query(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE institution_id = $1
          AND DATE(created_at) = CURRENT_DATE
          AND status NOT IN ('FAILED', 'TIMEOUT')
    `, [institution.id]);

    const dailyTotal = parseFloat(dailyResult.rows[0].total) + transaction.amount;
    if (dailyTotal > fraud.maxDailyAmount) {
        alerts.push({
            type: 'DAILY_LIMIT',
            severity: 'HIGH',
            description: `Daily total ${dailyTotal} would exceed limit ${fraud.maxDailyAmount}`
        });
    }

    // 4. Suspicious hours check
    const hour = new Date().getHours();
    if (hour >= fraud.suspiciousHoursStart && hour < fraud.suspiciousHoursEnd) {
        alerts.push({
            type: 'TIME',
            severity: 'LOW',
            description: `Transaction during suspicious hours (${fraud.suspiciousHoursStart}:00 - ${fraud.suspiciousHoursEnd}:00)`
        });
    }

    // 5. Duplicate detection (same amount, accounts within 5 minutes)
    const duplicateResult = await query(`
        SELECT id FROM transactions
        WHERE institution_id = $1
          AND amount = $2
          AND src_account_number = $3
          AND dest_account_number = $4
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        LIMIT 1
    `, [institution.id, transaction.amount, transaction.srcAccountNumber, transaction.destAccountNumber]);

    if (duplicateResult.rows.length > 0) {
        alerts.push({
            type: 'DUPLICATE',
            severity: 'MEDIUM',
            description: 'Potential duplicate transaction detected'
        });
    }

    // Save alerts if any
    if (alerts.length > 0) {
        for (const alert of alerts) {
            await saveFraudAlert(null, institution.id, alert);
        }
    }

    const maxSeverity = alerts.reduce((max, a) => {
        const order = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
        return order[a.severity] > order[max] ? a.severity : max;
    }, 'LOW');

    return {
        flagged: alerts.some(a => ['HIGH', 'CRITICAL'].includes(a.severity)),
        alerts,
        maxSeverity,
        shouldBlock: alerts.some(a => a.severity === 'CRITICAL')
    };
};

const saveFraudAlert = async (transactionId, institutionId, alert) => {
    await query(`
        INSERT INTO fraud_alerts (transaction_id, institution_id, alert_type, severity, description, details)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [transactionId, institutionId, alert.type, alert.severity, alert.description, JSON.stringify(alert)]);
};

// ============================================================================
// ENCRYPTION AT REST
// ============================================================================

/**
 * Encrypt sensitive data
 */
const encrypt = (plaintext) => {
    if (!config.features.encryptionAtRest) return plaintext;

    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(config.security.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv(config.security.encryptionAlgorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt sensitive data
 */
const decrypt = (ciphertext) => {
    if (!config.features.encryptionAtRest) return ciphertext;
    if (!ciphertext || !ciphertext.includes(':')) return ciphertext;

    try {
        const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = crypto.scryptSync(config.security.encryptionKey, 'salt', 32);

        const decipher = crypto.createDecipheriv(config.security.encryptionAlgorithm, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        console.error('Decryption error:', err.message);
        return ciphertext;
    }
};

/**
 * Mask sensitive data for display
 */
const maskAccountNumber = (accountNumber) => {
    if (!accountNumber || accountNumber.length < 6) return accountNumber;
    return accountNumber.slice(0, 3) + '*'.repeat(accountNumber.length - 6) + accountNumber.slice(-3);
};

// ============================================================================
// RATE LIMITING TIERS
// ============================================================================

/**
 * Get rate limit for institution tier
 */
const getRateLimitForTier = (tier) => {
    if (!config.features.rateLimitTiers) return 100; // Default

    const tiers = {
        'BASIC': 50,
        'STANDARD': 100,
        'PREMIUM': 500,
        'ENTERPRISE': 2000,
        'UNLIMITED': 999999
    };

    return tiers[tier] || tiers['STANDARD'];
};

/**
 * Check rate limit with tier consideration
 */
const checkRateLimitWithTier = async (credentialId, tier, customLimit = null) => {
    const limit = customLimit || getRateLimitForTier(tier);

    const result = await query(`
        SELECT COUNT(*) as count FROM transactions
        WHERE credential_id = $1
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
    `, [credentialId]);

    const currentCount = parseInt(result.rows[0].count);

    return {
        allowed: currentCount < limit,
        current: currentCount,
        limit,
        remaining: Math.max(0, limit - currentCount),
        resetIn: 60 // seconds
    };
};

module.exports = {
    // IP Whitelist
    validateIpWhitelist,
    isIpInCidr,

    // Request Signing
    validateRequestSignature,
    generateRequestSignature,

    // API Key Rotation
    checkKeyRotationStatus,
    rotateApiKey,

    // Fraud Detection
    checkFraudIndicators,
    saveFraudAlert,

    // Encryption
    encrypt,
    decrypt,
    maskAccountNumber,

    // Rate Limiting
    getRateLimitForTier,
    checkRateLimitWithTier
};
