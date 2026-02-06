/**
 * Institution Service
 * Business logic - Functional style
 */

const InstitutionModel = require('../models/institution.model');
const crypto = require('crypto');

/**
 * Safely parse JSON - handles both string and already-parsed values
 * PostgreSQL JSONB columns are auto-parsed by pg driver
 */
const safeJsonParse = (value, defaultValue = []) => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'object') return value; // Already parsed
    try {
        return JSON.parse(value);
    } catch {
        return defaultValue;
    }
};

/**
 * Create institution
 */
const createInstitution = async (data) => {
    const existing = await InstitutionModel.findByCode(data.institutionCode);
    if (existing) {
        throw { status: 409, message: 'Institution code already exists', code: 'DUPLICATE' };
    }

    const institution = await InstitutionModel.create(data);

    return {
        id: institution.id,
        institutionCode: institution.institution_code,
        institutionName: institution.institution_name,
        webhookSecret: institution.webhookSecret,
        createdAt: institution.created_at
    };
};

/**
 * Get institution by ID
 */
const getInstitution = async (id) => {
    const institution = await InstitutionModel.findById(id);
    if (!institution) {
        throw { status: 404, message: 'Institution not found' };
    }
    return institution;
};

/**
 * List institutions
 */
const listInstitutions = async (filters) => {
    return InstitutionModel.findAll(filters);
};

/**
 * Update institution
 */
const updateInstitution = async (id, data) => {
    const institution = await InstitutionModel.update(id, data);
    if (!institution) {
        throw { status: 404, message: 'Institution not found' };
    }
    return institution;
};

/**
 * Delete institution
 */
const deleteInstitution = async (id) => {
    const deleted = await InstitutionModel.delete(id);
    if (!deleted) {
        throw { status: 404, message: 'Institution not found' };
    }
    return true;
};

/**
 * Generate API credentials
 */
const generateCredentials = async (institutionId, data) => {
    const institution = await InstitutionModel.findById(institutionId);
    if (!institution) {
        throw { status: 404, message: 'Institution not found' };
    }

    const credential = await InstitutionModel.createCredential(institutionId, data);

    return {
        id: credential.id,
        apiKey: credential.api_key,
        apiSecret: credential.apiSecret,
        name: credential.name,
        permissions: safeJsonParse(credential.permissions, ['nec', 'ft', 'tsq']),
        rateLimitPerMinute: credential.rate_limit_per_minute,
        createdAt: credential.created_at,
        warning: 'Store apiSecret securely - shown only once'
    };
};

/**
 * List credentials
 */
const listCredentials = async (institutionId) => {
    const credentials = await InstitutionModel.findCredentialsByInstitution(institutionId);
    return credentials.map(c => ({
        ...c,
        permissions: safeJsonParse(c.permissions, ['nec', 'ft', 'tsq']),
        apiKeyPreview: c.api_key.substring(0, 10) + '...'
    }));
};

/**
 * Revoke credential
 */
const revokeCredential = async (institutionId, credentialId) => {
    const revoked = await InstitutionModel.revokeCredential(credentialId, institutionId);
    if (!revoked) {
        throw { status: 404, message: 'Credential not found' };
    }
    return true;
};

/**
 * Authenticate credentials
 */
const authenticateCredentials = async (apiKey, apiSecret) => {
    const credential = await InstitutionModel.findCredentialByApiKey(apiKey);
    if (!credential) return null;

    const secretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');
    if (secretHash !== credential.api_secret_hash) return null;

    await InstitutionModel.updateCredentialLastUsed(credential.id);

    return {
        id: credential.institution_id,
        credentialId: credential.id,
        code: credential.institution_code,
        name: credential.institution_name,
        webhookUrl: credential.webhook_url,
        permissions: safeJsonParse(credential.permissions, ['nec', 'ft', 'tsq']),
        ipWhitelist: safeJsonParse(credential.ip_whitelist, []),
        isSandbox: credential.is_sandbox,
        rateLimit: credential.rate_limit_per_minute
    };
};

/**
 * Check rate limit
 */
const checkRateLimit = async (credentialId, limit) => {
    return InstitutionModel.checkRateLimit(credentialId, limit);
};

module.exports = {
    createInstitution,
    getInstitution,
    listInstitutions,
    updateInstitution,
    deleteInstitution,
    generateCredentials,
    listCredentials,
    revokeCredential,
    authenticateCredentials,
    checkRateLimit
};
