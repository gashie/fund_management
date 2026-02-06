const {
  CALLBACK_URL,
  FTD_CODE,
  CHANNEL_CODE,
  gipFtdUrl,
  gipNecUrl,
} = require("../config/config");
const { convertTimestampToCustomFormat } = require("../helper/func");
const service = require("../services/request");
const globalEventEmitter = require("../utils/eventEmitter");
const ftdEventName = "FTD_REQUEST";

globalEventEmitter.on("NEC", async (payload, request_id) => {
  const dateTime = convertTimestampToCustomFormat();
  try {
    await service.logEvents(payload);

    let eventPayload = {
      event_name: ftdEventName,
      event_payload: payload,
      event_url: gipNecUrl,
      event_response: payload.gip_response,
      status: "PENDING",
      callback: "",
      session_id: payload.session_id,
      action_code: "",
      tracking_number: payload.reference_number,
      approval_code: payload.response_code,
      dest_account_number: payload.dest_account_number,
      src_account_number: payload.src_account_number,
      dest_account_name: payload.dest_account_name,
      src_account_name: payload.src_account_name,
      src_bank_code: payload.src_bank_code,
      request_id: request_id,
    };

    await service.saveEventService(eventPayload);
  } catch (error) {
    console.error("Error handling NAME_ENQUIRY event:", error.message);
  }
});

globalEventEmitter.on("EVENT_TIMELINE", async (payload) => {
  //   SAVE-EVENT TIMELINE
  console.log("EVENT_TIMELINE calling", payload);

  await service.saveEventTimelineService(payload);
});

globalEventEmitter.on(ftdEventName, async (payload, requestResult) => {
  let dateTime = convertTimestampToCustomFormat();
  try {
    let ftdPayload = {
      accountToCredit: payload.src_account_number,
      accountToDebit: payload.dest_account_number,
      channelCode: CHANNEL_CODE,
      dateTime,
      destBank: payload.dest_bank_code,
      functionCode: FTD_CODE,
      narration: payload.narration,
      originBank: payload.src_bank_code,
      callbackUrl: CALLBACK_URL,
      sessionId: payload.session_id,
      trackingNumber: payload.tracking_number,
      amount: payload.amount,
      nameToCredit: payload.src_account_name,
      nameToDebit: payload.dest_account_name,
      src_bank_code: payload.src_bank_code,
      request_id: requestResult.id,
    };
    let event_response = await service.makeGipRequestService(
      ftdPayload,
      gipFtdUrl
    );
    let final_response = event_response.response;
    let eventPayload = {
      event_name: ftdEventName,
      event_payload: ftdPayload,
      event_url: gipFtdUrl,
      event_response: event_response.response,
      status: "PENDING",
      callback: payload.callback_url,
      session_id: payload.session_id,
      action_code: final_response.actionCode,
      tracking_number: payload.tracking_number,
      approval_code: final_response.actionCode,
      dest_account_number: payload.dest_account_number,
      src_account_number: payload.src_account_number,
      dest_account_name: payload.dest_account_name,
      src_account_name: payload.src_account_name,
      src_bank_code: payload.src_bank_code,
      request_id: requestResult.id,
      request_date_time:requestResult.date_time,
      request_tracking_number:requestResult.tracking_number,
      dest_bank_code:requestResult.dest_bank_code
    };
    await service.saveEventService(eventPayload);
  } catch (error) {
    console.error("Error handling FTD event:", error.message);
  }
});

globalEventEmitter.on("FTC", async (payload) => {
  try {
    await service.logEvents(payload);
  } catch (error) {
    console.error("Error handling NAME_ENQUIRY event:", error.message);
  }
});

globalEventEmitter.on("TSQ", async (payload) => {
  try {
    console.log("TSQ calling", payload);

    await service.saveTSQLogs(payload);
  } catch (error) {
    console.error("Error handling TSQ event:", error.message);
  }
});
