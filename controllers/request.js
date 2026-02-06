const requestService = require("../services/request");
const humps = require("humps");
const { sendResponse, sendGipResponse } = require("../utils/utilfunc");
const asynHandler = require("../middleware/async");
const {
  formatAmount,
  toSnakeCase,
  convertTimestampToCustomFormat,
} = require("../helper/func");
const { DetectIp, DetectDevice } = require("../utils/devicefuncs");
const globalEventEmitter = require("../utils/eventEmitter");
const { gipNedUrl } = require("../config/config");

exports.sendRequest = asynHandler(async (req, res) => {
  let { app_id, api_key} = req.headers
  const eventName = "NAME_ENQUIRY";
  const functionCode = "231";
  const request_timestamp = convertTimestampToCustomFormat();

  const payload = toSnakeCase(req.body);
  // Emit an event for post-processing (e.g., logging, notifications)
  globalEventEmitter.emit("NAME_ENQUIRY", req.body);

  //-*1.-Validate reference and make sure it unique
  //-*2.-Convert amount to padded value
  //-*3.-Generate unique id
  //-*4.-Push to gip
  //-*5.-Save response + request

  // check src and dest bank
  const srcBankCode = await requestService.findParticipantService(
    payload.src_bank_code
  );
  const destBankCode = await requestService.findParticipantService(
    payload.dest_bank_code
  );

  if (!(srcBankCode && destBankCode)) {
    return sendResponse(
      res,
      0,
      200,
      "Sorry, error with the bank code, does not exist",
      []
    );
  }

  // generate session_id and tracking number
  const unique_result = await requestService.uniqueIdGeneratorService(
    payload.reference_number
  );

  // find reference
  const ref_result = await requestService.findReferenceService(
    payload.reference_number
  );

  if (ref_result.rowCount === 1) {
    return sendResponse(res, 0, 200, "Sorry, this record already exist", []);
  }

  payload.amount = "000000000000";
  payload.request_type = "NAME_ENQUIRY";
  payload.client_id = app_id

  payload.session_id = unique_result.rows[0].session_id;
  payload.tracking_number = unique_result.rows[0].tracking_number;
  payload.ip_address = DetectIp(req);
  payload.user_agent = await DetectDevice(req.headers["user-agent"], req);
  //emit event to send api request with payload
  let gip_payload = {
    accountToCredit: payload.src_account_number,
    accountToDebit: payload.dest_account_number,
    dateTime: request_timestamp,
    destBank: destBankCode.code,
    functionCode: functionCode,
    narration: payload.narration,
    originBank: srcBankCode.code,
    sessionId: payload.session_id,
    trackingNumber: payload.tracking_number,
    amount: payload.amount,
  };

  const nec_result = await requestService.makeGipRequestService(
    gip_payload,
    gipNedUrl
  );
  let gip_response = nec_result;

  payload.gip_response = gip_response.response;

  //make act code decision here
  let codeDetails = await requestService.findActCodeService(
    payload.gip_response.actionCode
  );
  payload.response_code = codeDetails.code;
  payload.response_message = codeDetails.message;
  payload.dest_account_name = gip_response.response.nameToDebit;
  payload.src_account_name = "";
  payload.date_time = request_timestamp;

  const result = await requestService.saveReqestService(payload);
  let requestResult = result.rows[0];
  await globalEventEmitter.emit("NEC", payload, requestResult.id);

  req.customLog = {
    event: eventName,
    sid: payload.session_id,
    sql_action: "INSERT",
  };

  eventTimelinePayload = {
    transaction_id: requestResult.id,
    event_type: requestResult.request_type,
    event_details: "NEC created",
    status: "PENDING",
    remarks: requestResult.id,
  };

  await globalEventEmitter.emit("EVENT_TIMELINE", eventTimelinePayload);
  return result.rowCount === 1
    ? sendGipResponse(res, 200, {
        responseCode: codeDetails.code,
        responseMessage: codeDetails.message,
        status: codeDetails.code === "000" ? "SUCCESSFUL" : "FAILED",
        sessionId: payload.session_id,
        destBankCode: payload.dest_bank_code,
        destAccountNumber: payload.dest_account_number,
        destAccountName: gip_response.response.nameToCredit,
        destAccountName: gip_response.response.nameToDebit,
      })
    : // ? sendResponse(res, 1, 200, "Record saved", [])
      sendResponse(
        res,
        0,
        200,
        "Sorry, error saving record: contact administrator",
        []
      );
});
