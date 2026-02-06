/**
 * Institution Controller v2
 * Handles institution management and API credential generation
 */

const crypto = require('crypto');

/**
 * Create a new institution
 */
exports.createInstitution = async (req, res) => {
    try {
        const pool = req.app.get('db');
        const {
            institutionCode,
            institutionName,
            shortName,
            bankCode,
            contactEmail,
            contactPhone,
            webhookUrl,
            ipWhitelist,
            isSandbox
        } = req.body;

        // Check for duplicate institution code
        const existing = await pool.query(
            'SELECT id FROM institutions WHERE institution_code = $1 AND deleted_at IS NULL',
            [institutionCode]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Institution code already exists',
                code: 'DUPLICATE_INSTITUTION'
            });
        }

        // Generate webhook secret
        const webhookSecret = crypto.randomBytes(32).toString('hex');

        const result = await pool.query(`
            INSERT INTO institutions (
                institution_code,
                institution_name,
                short_name,
                bank_code,
                contact_email,
                contact_phone,
                webhook_url,
                webhook_secret,
                ip_whitelist,
                is_sandbox
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            institutionCode,
            institutionName,
            shortName || null,
            bankCode || null,
            contactEmail || null,
            contactPhone || null,
            webhookUrl || null,
            webhookSecret,
            JSON.stringify(ipWhitelist || []),
            isSandbox || false
        ]);

        const institution = result.rows[0];

        res.status(201).json({
            success: true,
            message: 'Institution created successfully',
            data: {
                id: institution.id,
                institutionCode: institution.institution_code,
                institutionName: institution.institution_name,
                webhookSecret: webhookSecret,  // Only returned once at creation
                createdAt: institution.created_at
            }
        });

    } catch (error) {
        console.error('Create institution error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create institution',
            error: error.message
        });
    }
};

/**
 * List all institutions
 */
exports.listInstitutions = async (req, res) => {
    try {
        const pool = req.app.get('db');
        const { page = 1, limit = 20, active } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT
                id,
                institution_code,
                institution_name,
                short_name,
                bank_code,
                contact_email,
                is_active,
                is_sandbox,
                created_at
            FROM institutions
            WHERE deleted_at IS NULL
        `;

        const params = [];
        if (active !== undefined) {
            params.push(active === 'true');
            query += ` AND is_active = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM institutions WHERE deleted_at IS NULL'
        );

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count)
            }
        });

    } catch (error) {
        console.error('List institutions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list institutions'
        });
    }
};

/**
 * Get institution details
 */
exports.getInstitution = async (req, res) => {
    try {
        const pool = req.app.get('db');
        const { id } = req.params;

        const result = await pool.query(`
            SELECT
                i.*,
                (SELECT COUNT(*) FROM institution_credentials WHERE institution_id = i.id AND revoked_at IS NULL) as active_credentials,
                (SELECT COUNT(*) FROM transactions WHERE institution_id = i.id) as total_transactions
            FROM institutions i
            WHERE i.id = $1 AND i.deleted_at IS NULL
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Institution not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get institution error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get institution'
        });
    }
};

/**
 * Update institution
 */
exports.updateInstitution = async (req, res) => {
    try {
        const pool = req.app.get('db');
        const { id } = req.params;
        const updates = req.body;

        // Build update query dynamically
        const allowedFields = [
            'institution_name', 'short_name', 'bank_code',
            'contact_email', 'contact_phone', 'webhook_url',
            'ip_whitelist', 'is_active', 'is_sandbox'
        ];

        const setClauses = [];
        const values = [id];

        Object.entries(updates).forEach(([key, value]) => {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(snakeKey)) {
                values.push(snakeKey === 'ip_whitelist' ? JSON.stringify(value) : value);
                setClauses.push(`${snakeKey} = $${values.length}`);
            }
        });

        if (setClauses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        setClauses.push('updated_at = CURRENT_TIMESTAMP');

        const result = await pool.query(`
            UPDATE institutions
            SET ${setClauses.join(', ')}
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Institution not found'
            });
        }

        res.json({
            success: true,
            message: 'Institution updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update institution error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update institution'
        });
    }
};

/**
 * Generate API credentials for institution
 */
exports.generateCredentials = async (req, res) => {
    try {
        const pool = req.app.get('db');
        const { id: institutionId } = req.params;
        const {
            name,
            permissions,
            rateLimitPerMinute,
            rateLimitPerDay,
            expiresAt
        } = req.body;

        // Verify institution exists
        const institution = await pool.query(
            'SELECT id FROM institutions WHERE id = $1 AND deleted_at IS NULL',
            [institutionId]
        );

        if (institution.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Institution not found'
            });
        }

        // Generate API key and secret
        const apiKey = `fm_${crypto.randomBytes(24).toString('hex')}`;
        const apiSecret = crypto.randomBytes(32).toString('hex');
        const apiSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');

        const result = await pool.query(`
            INSERT INTO institution_credentials (
                institution_id,
                api_key,
                api_secret,
                api_secret_hash,
                name,
                permissions,
                rate_limit_per_minute,
                rate_limit_per_day,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, api_key, name, permissions, rate_limit_per_minute, rate_limit_per_day, expires_at, created_at
        `, [
            institutionId,
            apiKey,
            apiSecret,  // Store encrypted in production
            apiSecretHash,
            name || 'Default',
            JSON.stringify(permissions || ['nec', 'ft', 'tsq']),
            rateLimitPerMinute || 60,
            rateLimitPerDay || 10000,
            expiresAt || null
        ]);

        const credential = result.rows[0];

        // IMPORTANT: apiSecret is only returned ONCE at creation
        res.status(201).json({
            success: true,
            message: 'API credentials generated successfully',
            data: {
                id: credential.id,
                apiKey: credential.api_key,
                apiSecret: apiSecret,  // Only returned once - must be stored by client
                name: credential.name,
                permissions: JSON.parse(credential.permissions),
                rateLimitPerMinute: credential.rate_limit_per_minute,
                rateLimitPerDay: credential.rate_limit_per_day,
                expiresAt: credential.expires_at,
                createdAt: credential.created_at
            },
            warning: 'Store the apiSecret securely - it will not be shown again'
        });

    } catch (error) {
        console.error('Generate credentials error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate credentials'
        });
    }
};

/**
 * List credentials for institution
 */
exports.listCredentials = async (req, res) => {
    try {
        const pool = req.app.get('db');
        const { id: institutionId } = req.params;

        const result = await pool.query(`
            SELECT
                id,
                api_key,
                name,
                permissions,
                rate_limit_per_minute,
                rate_limit_per_day,
                expires_at,
                last_used_at,
                is_active,
                created_at,
                revoked_at
            FROM institution_credentials
            WHERE institution_id = $1
            ORDER BY created_at DESC
        `, [institutionId]);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                ...row,
                permissions: JSON.parse(row.permissions),
                apiKeyPreview: row.api_key.substring(0, 10) + '...'
            }))
        });

    } catch (error) {
        console.error('List credentials error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list credentials'
        });
    }
};

/**
 * Revoke credential
 */
exports.revokeCredential = async (req, res) => {
    try {
        const pool = req.app.get('db');
        const { institutionId, credentialId } = req.params;

        const result = await pool.query(`
            UPDATE institution_credentials
            SET is_active = false,
                revoked_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND institution_id = $2 AND revoked_at IS NULL
            RETURNING id
        `, [credentialId, institutionId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Credential not found or already revoked'
            });
        }

        res.json({
            success: true,
            message: 'Credential revoked successfully'
        });

    } catch (error) {
        console.error('Revoke credential error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke credential'
        });
    }
};
