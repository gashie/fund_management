const Joi = require('joi');

const schema = {
  // Name Enquiry Request Schema
  nameEnquiryRequest: Joi.object({
    srcBankCode: Joi.string()
      .required()
      .label("Source Bank Code")
      .messages({
        "string.pattern.base": "{#label} must be a 6-digit number.",
      }),
    destBankCode: Joi.string()
      .required()
      .label("Destination Bank Code")
      .messages({
        "string.pattern.base": "{#label} must be a 6-digit number.",
      }),
    srcAccountNumber: Joi.string()
      .required()
      .label("Source Account Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
    destAccountNumber: Joi.string()
      .required()
      .label("Destination Account Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
    referenceNumber: Joi.string()
      .required()
      .label("Reference Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
    requestTimestamp: Joi.date()
      .iso()
      .required()
      .label("Request Timestamp")
      .messages({
        "date.iso": "{#label} must be in ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ).",
      }),
  }),

  // FTD Payload Schema
  ftdPayload: Joi.object({
    srcBankCode: Joi.string()
      .required()
      .label("Source Bank Code")
      .messages({
        "string.pattern.base": "{#label} must be a 6-digit number.",
      }),
    destBankCode: Joi.string()
      .required()
      .label("Destination Bank Code")
      .messages({
        "string.pattern.base": "{#label} must be a 6-digit number.",
      }),
    amount: Joi.number()
      .positive()
      .required()
      .label("Amount"),
    srcAccountNumber: Joi.string()
      .required()
      .label("Source Account Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
    srcAccountName: Joi.string()
      .required()
      .label("Source Account Name"),
    destAccountNumber: Joi.string()
      .required()
      .label("Destination Account Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
    destAccountName: Joi.string()
      .required()
      .label("Destination Account Name"),
    narration: Joi.string()
      .required()
      .label("Narration"),
    referenceNumber: Joi.string()
      .required()
      .label("Reference Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
    requestTimestamp: Joi.date()
      .iso()
      .required()
      .label("Request Timestamp")
      .messages({
        "date.iso": "{#label} must be in ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ).",
      }),
    callbackUrl: Joi.string()
      .uri()
      .required()
      .label("Callback URL"),
  }),

  // TSQ Payload Schema
  tsqPayload: Joi.object({
    srcBankCode: Joi.string()
      .required()
      .label("Source Bank Code")
      .messages({
        "string.pattern.base": "{#label} must be a 6-digit number.",
      }),
    transactionReferenceNumber: Joi.string()
      .required()
      .label("Transaction Reference Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
    transactionTimestamp: Joi.date()
      .iso()
      .required()
      .label("Transaction Timestamp")
      .messages({
        "date.iso": "{#label} must be in ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ).",
      }),
    requestTimestamp: Joi.date()
      .iso()
      .required()
      .label("Request Timestamp")
      .messages({
        "date.iso": "{#label} must be in ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ).",
      }),
    referenceNumber: Joi.string()
      .required()
      .label("Reference Number")
      .messages({
        "string.pattern.base": "{#label} must contain only digits.",
      }),
  }),
};

module.exports = schema;
