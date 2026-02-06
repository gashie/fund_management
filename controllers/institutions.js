const institionService = require("../services/institution");
const asynHandler = require("../middleware/async");
const { sendResponse } = require("../utils/utilfunc");
const { toSnakeCase } = require("../helper/func");
const { saveCallbackService } = require("../services/request");
const globalEventEmitter = require("../utils/eventEmitter");

exports.createInstitution = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await institionService.createInstitutionService(payload);

  if (result.rowCount == 1) {
    return sendResponse(res, 1, 200, "Record Saved", []);
  } else {
    return sendResponse(
      res,
      0,
      200,
      "Sorry, error saving record: contact administrator",
      []
    );
  }
});

exports.viewInstitutions = asynHandler(async (req, res) => {
  const results = await institionService.viewInstitutionService();

  if (results.rows.length == 0) {
    return sendResponse(res, 0, 200, "Sorry, No Record Found", []);
  }

  sendResponse(res, 1, 200, "Record Found", results.rows);
});

exports.updateInstitution = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const runupdate = await institionService.updateInstitutionService(
    payload,
    payload.id
  );

  if (runupdate.rowCount == 1) {
    return sendResponse(res, 1, 200, "Record Updated", []);
  } else {
    return sendResponse(res, 0, 200, "Update failed, please try later", []);
  }
});

exports.deleteInstitution = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const runupdate = await institionService.updateInstitutionService(
    payload,
    payload.id
  );

  if (runupdate.rowCount == 1) {
    return sendResponse(res, 1, 200, "Record Deleted", []);
  } else {
    return sendResponse(res, 0, 200, "Delete failed, please try later", []);
  }
});

exports.createCallback = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  let body = {
    payload: req.body,
    amount: payload?.amount,
    date_time: payload?.date_time,
    dest_bank: payload?.dest_bank,
    session_id: payload?.session_id,
    action_code: payload?.action_code,
    origin_bank: payload?.origin_bank,
    channel_code: payload?.channel_code,
    approval_code: payload?.approval_code,
    function_code: payload?.function_code,
    name_to_debit: payload?.name_to_debit,
    name_to_credit: payload?.name_to_credit,
    tracking_number: payload?.tracking_number,
    account_to_debit: payload?.account_to_debit,
    account_to_credit: payload?.account_to_credit,
    incoming_url: req.url,
  };
  const result = await saveCallbackService(body);

  eventTimelinePayload = {
    transaction_id: result.rows[0].callback_id,
    event_type: "FT CALLBACK",
    event_details: "Callback Acknowledged",
    status: "PENDING",
    remarks: result.rows[0].callback_id,
  };

  await globalEventEmitter.emit("EVENT_TIMELINE", eventTimelinePayload);

  if (result.rowCount == 1) {
    return sendResponse(res, 1, 200, "Record Saved", []);
  } else {
    return sendResponse(
      res,
      0,
      200,
      "Sorry, error saving record: contact administrator",
      []
    );
  }
});
exports.testCallback = asynHandler(async (req, res) => {
  return sendResponse(res, 1, 200, "Record Saved", [
    {
      srcBankCode: "300307",
      srcAccountNumber: "0011010104334",
      referenceNumber: "6876987987",
      requestTimestamp: "2023-12-03 11:02:00",
      sessionId: "516947236717",
    },
  ]);
});
