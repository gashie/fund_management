const requestService = require("../services/request");
const { sendResponse, sendGipResponse } = require("../utils/utilfunc");
const asynHandler = require("../middleware/async");
const { formatAmount, toSnakeCase } = require("../helper/func");
const { DetectIp, DetectDevice } = require("../utils/devicefuncs");

exports.sendRequest = asynHandler(async (req, res) => {
  const eventName = "NAME_ENQUIRY";

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
  payload.request_type= "FTC_REQUEST"

  //emit event to send api request with payload

  const rtgs_payload = {
    file_type: "txt", // Include required fields like file_type
    zeroes: "000000000000000000", // Add zeroes field
    callback_url: payload.callback_url, // Specify the callback_url
    transaction_details: [
      {
        file_name: payload.reference_number,
        AccountToCredit: payload.dest_account_number,
        AccountToDebit: payload.src_account_number,
        amount: payload.amount,
        desc1: "GIP",
        desc2: "RTPS",
      },
    ],
  };

  // const rtgs_result = await requestService.makeRtgsRequestService(
  //   rtgs_payload,
  //   srcBankCode,
  //   destBankCode
  // );

  // payload.rtgs_result = rtgs_result;
  payload.ip_address =  DetectIp(req)
  payload.user_agent = await DetectDevice(req.headers["user-agent"], req);
  payload.response_code = "000"
  payload.response_message = "success"

  let callBackPayload = {
    "srcBankCode": payload.src_bank_code,
    "srcAccountNumber": payload.src_account_number,
    "referenceNumber": payload.reference_number,
    "requestTimestamp": payload.request_timestamp,
    "sessionId": payload.session_id,
    "destBankCode": payload.dest_bank_code,
    "destAccountNumber": payload.dest_account_number,
    "narration": payload.narration,
    "responseCode": "000",
    "responseMessage": "Approved",
    "status": "SUCCESSFUL",
    }
  
    let QueuePayload = {payload: callBackPayload, status:"PENDING", retries:0, callback_url:payload.callback_url}
  const result = await requestService.saveReqestService(payload);
  await requestService.saveJobService(QueuePayload);
  req.customLog = {
    event: eventName,
    sid: payload.session_id,
     sql_action:"INSERT"
  };
  return result.rowCount === 1
    ? sendGipResponse(res, 200, {
        responseCode: "000",
        responseMessage: "success",
        referenceNumber: payload.reference_number,
        sessionId: payload.session_id,
      })
    : // ? sendResponse(res, 1, 200, "Record saved", [])
    sendGipResponse(res, 200, {
      responseCode: "999",
      responseMessage: "FAILED",
      referenceNumber: payload.reference_number,
      sessionId: payload.session_id,
    })
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
    payload.transaction_reference_number,payload.src_bank_code,payload.request_timestamp
  );


  //emit event to send api request with payload
  req.customLog = {
    event: eventName,
    sid: payload.session_id,
     sql_action:"SELECT"
  };

  console.log(ref_result.rows[0]);
  
  return ref_result.rowCount === 1
    ? sendGipResponse(res, 200, {
      
        referenceNumber: ref_result.rows[0].reference_number,
        transactionReferenceNumber: "6876987987",
        sessionId: ref_result.rows[0].session_id,
        srcBankCode: ref_result.rows[0].src_bank_code,
        srcAccountNumber: ref_result.rows[0].src_account_number,
        destBankCode: ref_result.rows[0].dest_bank_code,
        destAccountNumber: ref_result.rows[0].dest_account_number,
        amount: ref_result.rows[0].amount,
        narration: ref_result.rows[0].narration,
        responseCode: ref_result.rows[0].response_code,
        responseMessage: "Approved",
        status: "SUCCESSFUL"
        
      })
    : // ? sendResponse(res, 1, 200, "Record saved", [])
    sendGipResponse(
        res,
        200,
        {
          "referenceNumber": req.body.referenceNumber,
          "transactionReferenceNumber": req.body.transactionReferenceNumber,
          "sessionId": null,
          "srcBankCode": null,
          "srcAccountNumber": null,
          "destBankCode": null,
          "destAccountNumber": null,
          "amount": null,
          "narration": null,
          "responseCode": "999",
          "responseMessage": "Transaction not found",
          "status": "NOT_FOUND"
          }
      );
});