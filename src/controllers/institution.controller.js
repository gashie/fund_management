/**
 * Institution Controller
 * HTTP handlers for institution management
 * No database queries - delegates to services
 */

const InstitutionService = require('../services/institution.service');

/**
 * Create institution
 * POST /institutions
 */
exports.create = async (req, res, next) => {
    try {
        const result = await InstitutionService.createInstitution(req.body);
        res.status(201).json({
            success: true,
            message: 'Institution created successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List institutions
 * GET /institutions
 */
exports.list = async (req, res, next) => {
    try {
        const { page, limit, active } = req.query;
        const result = await InstitutionService.listInstitutions({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            active: active === 'true' ? true : active === 'false' ? false : undefined
        });
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get institution
 * GET /institutions/:id
 */
exports.get = async (req, res, next) => {
    try {
        const result = await InstitutionService.getInstitution(req.params.id);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update institution
 * PUT /institutions/:id
 */
exports.update = async (req, res, next) => {
    try {
        const result = await InstitutionService.updateInstitution(req.params.id, req.body);
        res.json({
            success: true,
            message: 'Institution updated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete institution
 * DELETE /institutions/:id
 */
exports.delete = async (req, res, next) => {
    try {
        await InstitutionService.deleteInstitution(req.params.id);
        res.json({
            success: true,
            message: 'Institution deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Generate API credentials
 * POST /institutions/:id/credentials
 */
exports.generateCredentials = async (req, res, next) => {
    try {
        const result = await InstitutionService.generateCredentials(req.params.id, req.body);
        res.status(201).json({
            success: true,
            message: 'API credentials generated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List credentials
 * GET /institutions/:id/credentials
 */
exports.listCredentials = async (req, res, next) => {
    try {
        const result = await InstitutionService.listCredentials(req.params.id);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Revoke credential
 * DELETE /institutions/:institutionId/credentials/:credentialId
 */
exports.revokeCredential = async (req, res, next) => {
    try {
        await InstitutionService.revokeCredential(req.params.institutionId, req.params.credentialId);
        res.json({
            success: true,
            message: 'Credential revoked successfully'
        });
    } catch (error) {
        next(error);
    }
};
