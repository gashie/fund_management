// ftcRetryWorker.js
const npradb = require("../db/db");
const {
  fetchFtcFailedRecords,
  createFtcRequest,
  markSuccess,
  markFailed,
  sendJobToQueue,
  saveOutgoingCallback,
  markTsqState,
  markFailedError,
  createFtcTsqRequest
} = require("../db/query");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ftcRetryWorker() {
    console.log("FTC-RETRY--WORKING");
    
  while (true) {
    try {
      // Read-only query; no transaction needed
      const failedRecords = await fetchFtcFailedRecords();
      if (failedRecords.length === 0) {
        await sleep(5000);
        continue;
      }
      for (const record of failedRecords) {
        await processFtcRetryRecord(record);
      }
    } catch (err) {
      console.error("Error in ftcRetryWorker loop:", err);
      await sleep(5000);
    }
  }
}

async function processFtcRetryRecord(record) {
    const client = await npradb.beginTransaction();
    try {
        console.log("FTC-RETRY--WORKING");
        let finalStatus = await createFtcTsqRequest(record, client, record.callback_id);
        console.log("Initial TSQ response:", finalStatus);
      const actionCode = finalStatus.actionCode;
  
      // If the response indicates success (action code 000)
      if (['000'].includes(actionCode)) {
        await saveOutgoingCallback(record, client);
        await markSuccess(record.event_id, record.callback_id, client);
      }
      // If the response indicates an inconclusive result (909, 912, null, 990)
      else if (['909', '912', null, '990'].includes(actionCode)) {
        await markTsqState(record.event_id, record.callback_id, client);
      }
      // Any other response results in a failure.
      else {
        await markFailed(record.event_id, record.callback_id, client);
      }
      await npradb.commitTransaction(client);
    } catch (error) {
      await npradb.rollbackTransaction(client);
      console.error(`Error processing FTC retry record ${record.id}:`, error);
      await markFailedError(record.event_id, record.callback_id, client);
    }
  }
  

module.exports = ftcRetryWorker;
