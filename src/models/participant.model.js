/**
 * Participant Model
 * Database operations for GIP participant banks
 */

const { query } = require('./db');

const ParticipantModel = {
    /**
     * Find participant by bank code
     */
    async findByCode(bankCode) {
        const result = await query(`
            SELECT * FROM participants WHERE bank_code = $1 AND is_active = true
        `, [bankCode]);
        return result.rows[0] || null;
    },

    /**
     * Check if bank codes are valid participants
     */
    async validateBankCodes(srcBankCode, destBankCode) {
        const result = await query(`
            SELECT bank_code, bank_name, supports_nec, supports_ft
            FROM participants
            WHERE bank_code IN ($1, $2) AND is_active = true
        `, [srcBankCode, destBankCode]);

        const participants = {};
        result.rows.forEach(row => {
            participants[row.bank_code] = row;
        });

        return {
            source: participants[srcBankCode] || null,
            destination: participants[destBankCode] || null,
            valid: !!participants[srcBankCode] && !!participants[destBankCode]
        };
    },

    /**
     * List all active participants
     */
    async findAll() {
        const result = await query(`
            SELECT * FROM participants WHERE is_active = true ORDER BY bank_name
        `);
        return result.rows;
    },

    /**
     * Create participant
     */
    async create(data) {
        const result = await query(`
            INSERT INTO participants (bank_code, bank_name, short_name, swift_code, supports_nec, supports_ft)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            data.bankCode,
            data.bankName,
            data.shortName || null,
            data.swiftCode || null,
            data.supportsNec !== false,
            data.supportsFt !== false
        ]);
        return result.rows[0];
    },

    /**
     * Update participant
     */
    async update(bankCode, data) {
        const setClauses = [];
        const values = [bankCode];

        const fields = ['bank_name', 'short_name', 'swift_code', 'is_active', 'supports_nec', 'supports_ft'];
        Object.entries(data).forEach(([key, value]) => {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (fields.includes(snakeKey)) {
                values.push(value);
                setClauses.push(`${snakeKey} = $${values.length}`);
            }
        });

        if (setClauses.length === 0) return null;

        setClauses.push('updated_at = CURRENT_TIMESTAMP');

        const result = await query(`
            UPDATE participants SET ${setClauses.join(', ')}
            WHERE bank_code = $1 RETURNING *
        `, values);

        return result.rows[0] || null;
    }
};

module.exports = ParticipantModel;
