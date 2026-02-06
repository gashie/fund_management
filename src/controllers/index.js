/**
 * Controllers Index
 * Export all HTTP controllers
 */

const InstitutionController = require('./institution.controller');
const TransactionController = require('./transaction.controller');
const CallbackController = require('./callback.controller');
const AdminController = require('./admin.controller');
const FeatureController = require('./feature.controller');

module.exports = {
    InstitutionController,
    TransactionController,
    CallbackController,
    AdminController,
    FeatureController
};
