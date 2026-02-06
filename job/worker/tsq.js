// mainTsqWorker.js
const { gipTsqUrl } = require("../../config/config");
const { makeGipRequestService } = require("../../services/request");
const npradb = require("../db/db");
const {
    fetchPendingTsqRecords,      // Should return all TSQ-eligible records (pending)
    updateTsqIteration,
    markTsqState,
    markFailed,
    markFailedAndEnqueueJob,
    sendJobToQueue,
    markSuccess,
    createOutgoingCallback,
    createFtcTsqRequest,
    createFtcRequest,
    markEventAndCallbackAsComplete,
} = require("../db/query");
const config = require("./config.json");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mainTsqWorker() {
    // Wait for an initial delay (in minutes) before starting if configured.
    if (config.tsq.startDelayMinutes) {
        console.log(`TSQ Worker waiting ${config.tsq.startDelayMinutes} minute(s) before starting...`);
        await sleep(config.tsq.startDelayMinutes * 60000);
    }
    console.log("MAIN-TSQ-WORKER STARTING");

    while (true) {
        try {
            // Fetch all pending TSQ records (regardless of event_name)
            const pendingRecords = await fetchPendingTsqRecords();
            if (pendingRecords.length === 0) {
                await sleep(5000);
                continue;
            }
            for (const record of pendingRecords) {
                await processTsqRecord(record);
            }
        } catch (err) {
            console.error("Error in mainTsqWorker loop:", err);
            await sleep(5000);
        }
    }
}

async function processTsqRecord(record) {
    const client = await npradb.beginTransaction();
    try {
        let attempts = record.tsq_attempts || 0;
        let finalStatus = await createFtcTsqRequest(record, client, record.callback_id);
        console.log(`Initial TSQ response for record ${record.event_id}:`, finalStatus);

        // Loop while response is inconclusive and max iterations not reached.
        while (["909", "912", null, "990"].includes(finalStatus?.actionCode) &&
            attempts < config.tsq.maxIterations) {
            await updateTsqIteration(record, client);  // This helper updates tsq_attempts in the DB.
            attempts = (record.tsq_attempts || 0) + 1;     // Update our local counter.
            console.log(`Record ${record.event_id}: TSQ attempt ${attempts} - waiting ${config.tsq.intervalMinutes} minute(s) before retry.`);
            await sleep(config.tsq.intervalMinutes * 60000);
            finalStatus = await createFtcTsqRequest(record, client, record.callback_id);
            console.log(`Record ${record.event_id}: TSQ attempt ${attempts} response:`, finalStatus);
        }

        if (record.event_name === "FTD_REQUEST") {
            if (["000"].includes(finalStatus?.actionCode)) {
                // For FTD, on a successful TSQ response, create new FTC and mark complete.
                await createFtcRequest(record, client);
                await markEventAndCallbackAsComplete(record.event_id, record.callback_id, client);
            } else if (["909", "912", null, "990"].includes(finalStatus?.actionCode)) {
                // If still inconclusive after max iterations, mark as failed.
                if (attempts >= config.tsq.maxIterations) {
                    await markFailedAndEnqueueJob(record, client);
                } else {
                    await markTsqState(record.event_id, record.callback_id, client);
                }
            } else {
                await markFailed(record.event_id, record.callback_id, client);
            }
        } else if (record.event_name === "FTC_REQUEST") {
            // For FTC, if successful, create outgoing callback, enqueue job, and mark success.
            if (["000"].includes(finalStatus?.actionCode)) {
                await createOutgoingCallback(record, client);
                await sendJobToQueue(record, client);
                await markSuccess(record.event_id, record.callback_id, client);
            } else if (["909", "912", null, "990"].includes(finalStatus?.actionCode)) {
                if (attempts >= config.tsq.maxIterations) {
                    await markFailed(record.event_id, record.callback_id, client);
                } else {
                    await updateTsqIteration(record, client);
                    await markTsqState(record.event_id, record.callback_id, client);
                }
            } else {
                await markFailed(record.event_id, record.callback_id, client);
            }
        } else {
            // Fallback for any other event_name: mark as failed.
            await markFailed(record.event_id, record.callback_id, client);
        }
        await npradb.commitTransaction(client);
    } catch (error) {
        await npradb.rollbackTransaction(client);
        console.error(`Error processing TSQ record ${record.event_id}:`, error);
        // Optionally mark as failed if rollback occurred.
        await markFailed(record.event_id, record.callback_id, client);
    }
}

module.exports = mainTsqWorker;
