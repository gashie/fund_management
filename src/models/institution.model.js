/**
 * Institution Model
 * Database operations for institutions and credentials
 */

const { query, transaction } = require('./db');
const crypto = require('crypto');

const InstitutionModel = {
    /**
     * Create a new institution
     */
    async create(data) {
        const webhookSecret = crypto.randomBytes(32).toString('hex');

        const result = await query(`
            INSERT INTO institutions (
                institution_code, institution_name, short_name, bank_code,
                contact_email, contact_phone, webhook_url, webhook_secret,
                ip_whitelist, is_sandbox
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            data.institutionCode,
            data.institutionName,
            data.shortName || null,
            data.bankCode || null,
            data.contactEmail || null,
            data.contactPhone || null,
            data.webhookUrl || null,
            webhookSecret,
            JSON.stringify(data.ipWhitelist || []),
            data.isSandbox || false
        ]);

        return { ...result.rows[0], webhookSecret };
    },

    /**
     * Find institution by ID
     */
    async findById(id) {
        const result = await query(`
            SELECT * FROM institutions WHERE id = $1 AND deleted_at IS NULL
        `, [id]);
        return result.rows[0] || null;
    },

    /**
     * Find institution by code
     */
    async findByCode(code) {
        const result = await query(`
            SELECT * FROM institutions WHERE institution_code = $1 AND deleted_at IS NULL
        `, [code]);
        return result.rows[0] || null;
    },

    /**
     * List all institutions
     */
    async findAll({ page = 1, limit = 20, active } = {}) {
        const offset = (page - 1) * limit;
        let sql = `
            SELECT id, institution_code, institution_name, short_name, bank_code,
                   contact_email, is_active, is_sandbox, created_at
            FROM institutions WHERE deleted_at IS NULL
        `;
        const params = [];

        if (active !== undefined) {
            params.push(active);
            sql += ` AND is_active = $${params.length}`;
        }

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        const countResult = await query('SELECT COUNT(*) FROM institutions WHERE deleted_at IS NULL');

        return {
            data: result.rows,
            total: parseInt(countResult.rows[0].count),
            page,
            limit
        };
    },

    /**
     * Update institution
     */
    async update(id, data) {
        const allowedFields = [
            'institution_name', 'short_name', 'bank_code', 'contact_email',
            'contact_phone', 'webhook_url', 'ip_whitelist', 'is_active', 'is_sandbox'
        ];

        const setClauses = [];
        const values = [id];

        Object.entries(data).forEach(([key, value]) => {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(snakeKey)) {
                values.push(snakeKey === 'ip_whitelist' ? JSON.stringify(value) : value);
                setClauses.push(`${snakeKey} = $${values.length}`);
            }
        });

        if (setClauses.length === 0) return null;

        setClauses.push('updated_at = CURRENT_TIMESTAMP');

        const result = await query(`
            UPDATE institutions SET ${setClauses.join(', ')}
            WHERE id = $1 AND deleted_at IS NULL RETURNING *
        `, values);

        return result.rows[0] || null;
    },

    /**
     * Soft delete institution
     */
    async delete(id) {
        const result = await query(`
            UPDATE institutions SET deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND deleted_at IS NULL RETURNING id
        `, [id]);
        return result.rowCount > 0;
    },

    // ============== CREDENTIALS ==============

    /**
     * Create API credentials
     */
    async createCredential(institutionId, data) {
        const apiKey = `fm_${crypto.randomBytes(24).toString('hex')}`;
        const apiSecret = crypto.randomBytes(32).toString('hex');
        const apiSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');

        const result = await query(`
            INSERT INTO institution_credentials (
                institution_id, api_key, api_secret, api_secret_hash,
                name, permissions, rate_limit_per_minute, rate_limit_per_day, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, api_key, name, permissions, rate_limit_per_minute,
                      rate_limit_per_day, expires_at, created_at
        `, [
            institutionId,
            apiKey,
            apiSecret,
            apiSecretHash,
            data.name || 'Default',
            JSON.stringify(data.permissions || ['nec', 'ft', 'tsq']),
            data.rateLimitPerMinute || 60,
            data.rateLimitPerDay || 10000,
            data.expiresAt || null
        ]);

        return { ...result.rows[0], apiSecret };
    },

    /**
     * Find credential by API key
     */
    async findCredentialByApiKey(apiKey) {
        const result = await query(`
            SELECT ic.*, i.institution_code, i.institution_name, i.webhook_url,
                   i.ip_whitelist, i.is_active as institution_active, i.is_sandbox
            FROM institution_credentials ic
            JOIN institutions i ON ic.institution_id = i.id
            WHERE ic.api_key = $1
              AND ic.is_active = true
              AND ic.revoked_at IS NULL
              AND (ic.expires_at IS NULL OR ic.expires_at > CURRENT_TIMESTAMP)
              AND i.is_active = true
              AND i.deleted_at IS NULL
        `, [apiKey]);
        return result.rows[0] || null;
    },

    /**
     * List credentials for institution
     */
    async findCredentialsByInstitution(institutionId) {
        const result = await query(`
            SELECT id, api_key, name, permissions, rate_limit_per_minute,
                   rate_limit_per_day, expires_at, last_used_at, is_active,
                   created_at, revoked_at
            FROM institution_credentials
            WHERE institution_id = $1 ORDER BY created_at DESC
        `, [institutionId]);
        return result.rows;
    },

    /**
     * Update credential last used
     */
    async updateCredentialLastUsed(credentialId) {
        await query(`
            UPDATE institution_credentials SET last_used_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [credentialId]);
    },

    /**
     * Revoke credential
     */
    async revokeCredential(credentialId, institutionId) {
        const result = await query(`
            UPDATE institution_credentials
            SET is_active = false, revoked_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND institution_id = $2 AND revoked_at IS NULL
            RETURNING id
        `, [credentialId, institutionId]);
        return result.rowCount > 0;
    },

    /**
     * Check and increment rate limit
     */
    async checkRateLimit(credentialId, limit) {
        const windowStart = new Date();
        windowStart.setSeconds(0, 0);

        const result = await query(`
            INSERT INTO institution_rate_limits (credential_id, window_start, window_type, request_count)
            VALUES ($1, $2, 'minute', 1)
            ON CONFLICT (credential_id, window_start, window_type)
            DO UPDATE SET request_count = institution_rate_limits.request_count + 1
            RETURNING request_count
        `, [credentialId, windowStart]);

        return result.rows[0].request_count <= limit;
    }
};

module.exports = InstitutionModel;
