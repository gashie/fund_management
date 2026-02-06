const requestService = require("../services/request");
const { sendResponse, sendGipResponse } = require("../utils/utilfunc");
const asynHandler = require("../middleware/async");
const {
  formatAmount,
  toSnakeCase,
  convertTimestampToCustomFormat,
} = require("../helper/func");
const { DetectIp, DetectDevice } = require("../utils/devicefuncs");
const globalEventEmitter = require("../utils/eventEmitter");
const { gipTsqUrl, CHANNEL_CODE, FTC_CODE } = require("../config/config");
const { updateItem } = require("../helper/dynamic");

exports.sendRequest = asynHandler(async (req, res) => {
  let { app_id, api_key} = req.headers

  const eventName = "FTD_REQUEST";
  const request_timestamp = convertTimestampToCustomFormat();

  const payload = toSnakeCase(req.body);

  //-*1.-Validate reference and make sure it unique
  //-*2.-Convert amount to padded value
  //-*3.-Generate unique id
  //-*4.-Push to gip
  //-*5.-Push to rtgs service
  //-*6.-Save response + request

  // check src and dest bank
  const srcBankCode = await requestService.findParticipantService(
    payload.src_bank_code
  );
  const destBankCode = await requestService.findParticipantService(
    payload.dest_bank_code
  );

  if (!(srcBankCode && destBankCode)) {
    return sendResponse(res, 0, 200, "Sorry, Participant", []);
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

  let cleanAmount = formatAmount(payload.amount);
  payload.amount = cleanAmount;

  payload.session_id = unique_result.rows[0].session_id;
  payload.tracking_number = unique_result.rows[0].tracking_number;
  payload.request_type = "FTD_REQUEST";
  payload.date_time = request_timestamp;
  payload.client_id = app_id
  //emit event to send api request with payload

  // payload.rtgs_result = rtgs_result;
  payload.ip_address = DetectIp(req);
  payload.user_agent = await DetectDevice(req.headers["user-agent"], req);
  payload.response_code = "000";
  payload.response_message = "success";

  const result = await requestService.saveReqestService(payload);
  let requestResult = result.rows?.[0];
  
  await globalEventEmitter.emit(eventName, payload, requestResult);

  req.customLog = {
    event: eventName,
    sid: payload.session_id,
    sql_action: "INSERT",
  };

  eventTimelinePayload = {
    transaction_id: requestResult.id,
    event_type: payload.request_type,
    event_details: "FTD_CREATED",
    status: "PENDING",
    remarks: requestResult.id,
  };

  await globalEventEmitter.emit("EVENT_TIMELINE", eventTimelinePayload);

  return result.rowCount === 1
    ? sendGipResponse(res, 200, {
        responseCode: payload.response_code,
        responseMessage: payload.response_message,
        referenceNumber: payload.reference_number,
        sessionId: payload.session_id,
      })
    : // ? sendResponse(res, 1, 200, "Record saved", [])
      sendGipResponse(res, 200, {
        responseCode: "999",
        responseMessage: "FAILED",
        referenceNumber: payload.reference_number,
        sessionId: payload.session_id,
      });
});

exports.sendTsqRequest = asynHandler(async (req, res) => {
  const eventName = "TSQ_ENQUIRY";

  const payload = toSnakeCase(req.body);

  //-*1.-Validate reference and make sure it unique
  //-*2.-Convert amount to padded value
  //-*3.-Generate unique id
  //-*4.-Push to gip
  //-*5.-Push to rtgs service
  //-*6.-Save response + request

  // check src and dest bank
  // const srcBankCode = await requestService.findParticipantService(
  //   payload.src_bank_code
  // );

  // if (!(srcBankCode)) {
  //   return sendResponse(res, 0, 200, "Sorry, Participant", []);
  // }

  // find reference
  const ref_result = await requestService.findUniqueReferenceService(
    payload.transaction_reference_number,
    payload.src_bank_code,
    payload.request_timestamp
  );

  if (ref_result.rows.length == 0) {
    return sendGipResponse(res, 200, {
      referenceNumber: req.body.referenceNumber,
      transactionReferenceNumber: req.body.transactionReferenceNumber,
      sessionId: null,
      srcBankCode: null,
      srcAccountNumber: null,
      destBankCode: null,
      destAccountNumber: null,
      amount: null,
      narration: null,
      responseCode: "999",
      responseMessage: "Transaction not found",
      status: "NOT_FOUND",
    });
  }
  let found_result = ref_result.rows[0];
  let gip_payload = {
    dateTime: found_result.date_time,
    accountToCredit: found_result.src_account_number,
    accountToDebit: found_result.dest_account_number,
    nameToCredit: found_result.src_account_name,
    nameToDebit: found_result.dest_account_name,
    amount: found_result.amount,
    trackingNumber: found_result.tracking_number,
    sessionId: found_result.session_id,
    functionCode: FTC_CODE,
    originBank: found_result.src_account_number,
    destBank: found_result.dest_account_number,
    narration: found_result.narration,
    channelCode: CHANNEL_CODE,
  };

  const calback_response = await requestService.makeGipRequestService(
    gip_payload,
    gipTsqUrl
  );
  let gip_response = calback_response.response;

  //make act code decision here
  let codeDetails = await requestService.findActCodeService(
    gip_response.actionCode
  );
  //emit event to send api request with payload
  req.customLog = {
    event: eventName,
    sid: payload?.session_id,
    sql_action: "SELECT",
  };

  eventTimelinePayload = {
    transaction_id: result.rows[0].id,
    event_type: result.rows[0].request_type,
    event_details: "TSQ_FETCHED",
    status: codeDetails.code === "000" ? "SUCCESSFUL" : "FAILED",
    remarks: result.rows[0].id,
  };

  await globalEventEmitter.emit("EVENT_TIMELINE", eventTimelinePayload);

  return ref_result.rowCount === 1
    ? sendGipResponse(res, 200, {
        referenceNumber: gip_response.reference_number,
        transactionReferenceNumber: gip_response.reference_number,
        sessionId: found_result.session_id,
        srcBankCode: gip_response.originBank,
        srcAccountNumber: gip_response.accountToCredit,
        destBankCode: gip_response.destBank,
        destAccountNumber: gip_response.accountToDebit,
        amount: gip_response.amount,
        narration: found_result.narration,
        responseCode: codeDetails.code,
        responseMessage: codeDetails.message,
        status: codeDetails.code === "000" ? "SUCCESSFUL" : "FAILED",
      })
    : // ? sendResponse(res, 1, 200, "Record saved", [])
      sendGipResponse(res, 200, {
        referenceNumber: req.body.referenceNumber,
        transactionReferenceNumber: req.body.transactionReferenceNumber,
        sessionId: null,
        srcBankCode: null,
        srcAccountNumber: null,
        destBankCode: null,
        destAccountNumber: null,
        amount: null,
        narration: null,
        responseCode: "999",
        responseMessage: "Transaction not found",
        status: "NOT_FOUND",
      });
});
