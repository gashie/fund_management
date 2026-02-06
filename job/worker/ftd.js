const { Pool } = require('pg');
const { fetchFtdPendingCallbacks, createFtcRequest, markEventAndCallbackAsComplete, markTsqState, markFailedAndEnqueueJob, markFailed, markFailedError } = require('../db/query');
const npradb = require('../db/db');


/**
 * Helper function to sleep for a given number of milliseconds.
 * Useful for throttling loops or retry logic.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}




async function ftdWorker() {
  console.log("FTD--WORKING");

  while (true) {
    try {
      // 1. Fetch all pending FTD callbacks
      const ftdCallbacks = await fetchFtdPendingCallbacks();

      if (ftdCallbacks.length === 0) {
        await sleep(5000);
        continue;
      }

      for (const record of ftdCallbacks) {
        await processFtdRecord(record);
      }
    } catch (err) {
      console.error('Error in ftdWorker loop:', err);
      // Sleep to avoid spamming if there's a systemic error
      await sleep(5000);
    }
  }
}

async function processFtdRecord(record) {
  const client = await npradb.beginTransaction();
  try {
    console.log("FTD--WORKING");

    // Extract actionCode from callback or event
    const actionCode = record.action_code;
  
    // Step 1: If actionCode in [000, 001], create new FTC event, push
    if (['000'].includes(actionCode)) {
      await createFtcRequest(record, client, record.callback_id);
      // Optionally update record status to COMPLETED
      await markEventAndCallbackAsComplete(record.event_id, record.callback_id, client);
    }
    // Step 2: If actionCode in [909, 912, null, 990]
    else if (['909', '912', null, '990'].includes(actionCode)) {
      await markTsqState(record.event_id, record.callback_id, client); // sets event.tsq_state = true, etc.
    }
    // Step 3: Otherwise => set to FAILED, create outgoing callback
    else {
      console.log("record failed");

      await markFailedAndEnqueueJob(record, client);
    }
    // Finally, commit once
    await npradb.commitTransaction(client);
  } catch (error) {
    // Roll back if anything goes wrong
    await npradb.rollbackTransaction(client);
    console.error(`Error processing FTD record ${record.event_id}:`, error);
    await markFailedError(record.event_id, record.callback_id, client);
  }
}


module.exports = ftdWorker