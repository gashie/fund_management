/**
 * Models Index
 * Export all database models
 */

const db = require('./db');
const InstitutionModel = require('./institution.model');
const TransactionModel = require('./transaction.model');
const CallbackModel = require('./callback.model');
const EventModel = require('./event.model');
const ParticipantModel = require('./participant.model');

module.exports = {
    db,
    InstitutionModel,
    TransactionModel,
    CallbackModel,
    EventModel,
    ParticipantModel
};
