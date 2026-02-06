// ftcTsqWorker.js
const { gipTsqUrl } = require("../../config/config");
const { makeGipRequestService } = require("../../services/request");
const npradb = require("../db/db");
const {
  fetchFtcTsqRecords,
  updateTsqIteration,
  markTsqState,
  markFailed,
  sendJobToQueue,
  markSuccess,
  createOutgoingCallback,
  createFtcTsqRequest,
} = require("../db/query");
const config = require("./config.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ftcTsqWorker() {
  console.log("FTC-TSQ--WORKING");

  while (true) {
    try {
      const ftcTsqRecords = await fetchFtcTsqRecords();

      if (ftcTsqRecords.length === 0) {
        await sleep(5000);
        continue;
      }

      for (const record of ftcTsqRecords) {
        await processFtcTsqRecord(record);
      }
    } catch (err) {
      console.error("Error in ftcTsqWorker loop:", err);
      await sleep(5000);
    }
  }
}

async function processFtcTsqRecord(record) {
  const client = await npradb.beginTransaction();
  try {
    console.log("FTC-TSQ--WORKING");
    let attempts = record.tsq_attempts || 0;
    let finalStatus = await createFtcTsqRequest(record, client, record.callback_id);
    console.log("Initial TSQ response:", finalStatus);

    // Loop while the response is inconclusive and we haven't exhausted iterations.
    while (["909", "912", null, "990"].includes(finalStatus?.actionCode) &&
           attempts < config.tsq.maxIterations) {
      // Increment the TSQ attempt in the database.
      await updateTsqIteration(record, client); // This function should update record.tsq_attempts.
      // Retrieve the latest tsq_attempts if needed:
      attempts = record.tsq_attempts ? record.tsq_attempts + 1 : attempts + 1;
      
      // Wait for the configured interval (in minutes)
      await sleep(config.tsq.intervalMinutes * 60000);
      
      finalStatus = await createFtcTsqRequest(record, client, record.callback_id);
      console.log(`TSQ attempt ${attempts} response:`, finalStatus);
    }
    
    if (["909", "912", null, "990"].includes(finalStatus?.actionCode)) {
      // If still inconclusive after max iterations, mark as FAILED.
      await markFailed(record.event_id, record.callback_id, client);
    } else if (finalStatus?.actionCode === "000") {
      // Success: create outgoing callback, enqueue job, mark SUCCESS.
      await createOutgoingCallback(record, client);
      await sendJobToQueue(record, client);
      await markSuccess(record.event_id, record.callback_id, client);
    } else {
      // Any other unexpected response: mark as FAILED.
      await markFailed(record.event_id, record.callback_id, client);
    }
    
    await npradb.commitTransaction(client);
  } catch (error) {
    await npradb.rollbackTransaction(client);
    console.error(`Error processing FTC TSQ record ${record.id}:`, error);
    // Optionally mark as failed outside the transaction:
    await markFailed(record.event_id, record.callback_id, client);
  }
}


module.exports = ftcTsqWorker;
