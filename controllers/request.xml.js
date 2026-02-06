const requestService = require("../services/request");
const humps = require("humps");
const { sendResponse, sendGipResponse } = require("../utils/utilfunc");
const asynHandler = require("../middleware/async");
const { formatAmount, toSnakeCase } = require("../helper/func");
const { DetectIp, DetectDevice } = require("../utils/devicefuncs");
const globalEventEmitter = require('../utils/eventEmitter');

exports.sendRequest = asynHandler(async (req, res) => {
  const eventName = "NAME_ENQUIRY";

  const payload = toSnakeCase(req.body);
   // Emit an event for post-processing (e.g., logging, notifications)
   globalEventEmitter.emit('NAME_ENQUIRY', req.body);

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
    return sendResponse(res, 0, 200, "Sorry, error with the bank code, does not exist", []);
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
  payload.request_type= "NAME_ENQUIRY"

  payload.session_id = unique_result.rows[0].session_id;
  payload.tracking_number = unique_result.rows[0].tracking_number;
  payload.ip_address =  DetectIp(req)
  payload.user_agent = await DetectDevice(req.headers["user-agent"], req)
  //emit event to send api request with payload

  const nec_result = await requestService.makeNecRequestService(
    payload,
    srcBankCode,
    destBankCode
  );
  let gip_response =
    nec_result.jsonResponse["soapenv:Body"]["com:GIPTransaction"]
      .ReqGIPTransaction;

  payload.gip_response = gip_response;

  //make act code decision here
  let codeDetails = await requestService.findActCodeService(
    gip_response.ActCode
  );
  payload.response_code = codeDetails.code
  payload.response_message = codeDetails.message
  payload.dest_account_name = "Kwaku Manu"
   payload.src_account_name = "Fautina Abdulai"

  const result = await requestService.saveReqestService(payload);
  req.customLog = {
    event: eventName,
    sid: payload.session_id,
    sql_action:"INSERT"
  };

  return result.rowCount === 1
    ? sendGipResponse(res, 200, {
        responseCode: codeDetails.code,
        responseMessage: codeDetails.message,
        status: codeDetails.code === "000" ? "SUCCESSFUL" : "FAILED",
        sessionId: payload.session_id,
        destBankCode: payload.dest_bank_code,
        destAccountNumber: gip_response.AccountToCredit,
        destAccountName: gip_response.NameToCredit,
        destAccountName: "Kwaku Manu"
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
