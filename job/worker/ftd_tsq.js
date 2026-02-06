// ftdTsqWorker.js
const { gipTsqUrl } = require("../../config/config");
const { addItem } = require("../../helper/dynamic");
const { makeGipRequestService } = require("../../services/request");
const npradb = require("../db/db");
const {
  fetchFtdTsqRecords,
  updateTsqIteration,
  markFailedAndEnqueueJob,
  markEventAndCallbackAsComplete,
  markTsqState,
  markFailed,
  createFtcRequest,
} = require("../db/query");
const config = require("./config.json"); // { tsq: { intervalMinutes, maxIterations } }
const { tsqPayload } = require("../../validation/schema");
const globalEventEmitter = require("../../utils/eventEmitter");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ftdTsqWorker() {
  console.log("FTD-TSQ--WORKING");

  while (true) {
    try {
      const ftdTsqRecords = await fetchFtdTsqRecords(); // read-only select, no transaction

      if (ftdTsqRecords.length === 0) {
        await sleep(5000);
        continue;
      }

      for (const record of ftdTsqRecords) {
        await processFtdTsqRecord(record);
      }
    } catch (err) {
      console.error("Error in ftdTsqWorker loop:", err);
      await sleep(5000);
    }
  }
}

async function processFtdTsqRecord(record) {

  const client = await npradb.beginTransaction();
  try {
    console.log("FTD-TSQ--WORKING");

    const apiResult = await makeGipRequestService(record, gipTsqUrl);

    let finalStatus = apiResult?.response;
    // if (finalStatus === "FAILED") {
    //   await markFailedAndEnqueueJob(record, client);
    // } else

    if (["000"].includes(finalStatus.actionCode)) {
      await createFtcRequest(record, client);
      await markEventAndCallbackAsComplete(
        record.event_id,
        record.callback_id,
        client
      );
    } else if (["909", "912", null, "990"].includes(finalStatus.actionCode)) {
      //save the tsq event in tsq and retry tracking table

      // If we've hit max TSQ attempts, fail; else remain in TSQ
      if ((record.tsq_attempts || 0) >= config.tsq.maxIterations) {
        await markFailedAndEnqueueJob(record, client);
      } else {
        // increment TSQ attempt, remain TSQ
        let tsqRetryPayload = {
          tsq_payload: record,
          tsq_response: apiResult.response,
          session_id: apiResult.response.sessionId,
          details: "TSQ STATE",
          action_code: apiResult.response.actionCode,
          callback_id: record.callback_id,
        };

        globalEventEmitter.emit("NEC", tsqRetryPayload);

        await updateTsqIteration(record, client); // e.g. increments a tsq_attempts column by 1
        await markTsqState(record.event_id, record.callback_id, client);
      }
    } else {
      // fallback
      await markFailed(record.event_id, record.callback_id, client);
    }

    await npradb.commitTransaction(client);
  } catch (error) {
    await npradb.rollbackTransaction(client);
    console.error(`Error processing FTD TSQ record ${record.id}:`, error);
    await markFailed(record.event_id, record.callback_id, client);
  }
}

module.exports = ftdTsqWorker;
