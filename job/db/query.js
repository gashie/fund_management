const {

  CHANNEL_CODE,
  CALLBACK_URL,
  FTC_CODE,
} = require("../../config/config");
const dotenv = require('dotenv');

const gipUrl = "http://172.21.8.21:9000/SwitchGIP/WSGIP"
// Load environment variables
dotenv.config({ path: './config/config.env' });
const { makeGipRequestService } = require("../../services/request");
const npradb = require("./db"); // your dynamic CRUD + transaction helpers
const pool = require("./pool");
const config = require("../worker/config.json");
const globalEventEmitter = require("../../utils/eventEmitter");
const { convertTimestampToCustomFormat } = require("../../helper/func");

/**
 * Create an FTC_REQUEST event in the `event` table.
 * Wraps the insert in a transaction.
 * @param {Object} record - Data needed to create the new event.
 * @returns {Object} The newly created event row.
 */
async function createFtcRequest(record, client, request_id) {
  const request_timestamp = convertTimestampToCustomFormat();
  try {
    const unique_result = await npradb.uniqueIdNoParam();
    // payload for the new event
    const ftcPayload = {
      accountToCredit: record.src_account_number,
      accountToDebit: record.dest_account_number,
      channelCode: CHANNEL_CODE,
      dateTime: request_timestamp, //autogenerate here
      destBank: record.src_bank_code,
      functionCode: FTC_CODE,
      narration: record.narration,
      originBank: record.dest_bank_code,
      callbackUrl: CALLBACK_URL,
      sessionId: unique_result.rows[0].session_id, //autogenerate here
      trackingNumber: unique_result.rows[0].tracking_number, //autogenerate here
      amount: record.amount,
      nameToCredit: record.src_account_name,
      nameToDebit: record.dest_account_name,
    };



    let event_response = await makeGipRequestService(ftcPayload, gipUrl);
    let eventPayload = {
      event_name: "FTC_REQUEST",
      event_payload: ftcPayload,
      event_url: gipUrl,
      event_response: event_response.response,
      status: "PENDING",
      callback: record.callback,
      session_id: unique_result.rows[0].session_id,
      action_code: event_response.response.actionCode,
      tracking_number: unique_result.rows[0].tracking_number,
      approval_code: event_response.response.actionCode,
      dest_account_number: record.dest_account_number,
      src_account_number: record.src_account_number,
      dest_account_name: record.dest_account_name,
      src_account_name: record.src_account_name,
      src_bank_code: record.dest_account_number,
      dest_bank_code: record.src_account_number,
      request_id: record.request_id,
      request_date_time: request_timestamp,
      request_tracking_number: record.request_tracking_number,
      parent_event_id: record.event_id,
      parent_session_id: record.session_id,
      parent_tracking_number: record.tracking_number,
      parent_callback_url: record.callback,
    };

    // Use npradb.Create with the transaction client
    const newFtc = await npradb.Create(eventPayload, "event", null, client);

    eventTimelinePayload = {
      transaction_id: newFtc.event_id,
      event_type: newFtc.event_name,
      event_details: "FTC_CREATED",
      status: "PENDING",
      remarks: newFtc.event_id,
    };

    await globalEventEmitter.emit("EVENT_TIMELINE", eventTimelinePayload);

    return newFtc;
  } catch (err) {
    throw err; // bubble up the error
  }
}
async function createFtcTsqRequest(record, client, request_id) {
  let dateTime = convertTimestampToCustomFormat();


  try {
    // payload for the new event
    console.log('showing record',record);
    
    const ftcPayload = {
      accountToCredit: record.src_account_number,
      accountToDebit: record.dest_account_number,
      channelCode: CHANNEL_CODE,
      dateTime: record.event_payload.dateTime,
      destBank: record.src_bank_code,
      functionCode: FTC_CODE,
      narration: record.narration,
      originBank: record.dest_bank_code,
      callbackUrl: CALLBACK_URL,
      sessionId: record.session_id, //autogenerate here
      trackingNumber: record.tracking_number, //autogenerate here
      amount: record?.event_payload?.amount,
      nameToCredit: record.src_account_name,
      nameToDebit: record.dest_account_name,
    };



    let event_response = await makeGipRequestService(ftcPayload, gipUrl);
    let eventPayload = {
      event_name: "TSQ_REQUEST",
      event_payload: ftcPayload,
      event_url: gipUrl,
      event_response: event_response.response,
      status: "PENDING",
      callback: record.callback,
      session_id: record.session_id,
      action_code: event_response.response.actionCode,
      tracking_number: record.tracking_number,
      approval_code: event_response.response.actionCode,
      dest_account_number: record.dest_account_number,
      src_account_number: record.src_account_number,
      dest_account_name: record.dest_account_name,
      src_account_name: record.src_account_name,
      src_bank_code: record.dest_account_number,
      dest_bank_code: record.src_account_number,
      request_id: record.request_id,
      request_date_time: record.request_date_time,
      request_tracking_number: record.request_tracking_number,
      parent_event_id: record.event_id,
      parent_session_id: record.session_id,
      parent_tracking_number: record.tracking_number,
      parent_callback_url: record.callback,
    };

    // Use npradb.Create with the transaction client
    const newFtc = await npradb.Create(eventPayload, "event", null, client);

    eventTimelinePayload = {
      transaction_id: newFtc.event_id,
      event_type: newFtc.event_name,
      event_details: "TSQ_CREATED",
      status: "PENDING",
      remarks: newFtc.event_id,
    };

    await globalEventEmitter.emit("EVENT_TIMELINE", eventTimelinePayload);

    return event_response.response;
  } catch (err) {
    throw err; // bubble up the error
  }
}
async function createFtcRetryRequest(record, client, request_id) {

  try {
    const unique_result = await npradb.uniqueIdNoParam();
    // payload for the new event
    const ftcPayload = {
      accountToCredit: record.src_account_number,
      accountToDebit: record.dest_account_number,
      channelCode: CHANNEL_CODE,
      dateTime: record.request_timestamp, //autogenerate here
      destBank: record.src_bank_code,
      functionCode: FTC_CODE,
      narration: record.narration,
      originBank: record.dest_bank_code,
      callbackUrl: CALLBACK_URL,
      sessionId: unique_result.rows[0].session_id, //autogenerate here
      trackingNumber: unique_result.rows[0].tracking_number, //autogenerate here
      amount: record.amount,
      nameToCredit: record.src_account_name,
      nameToDebit: record.dest_account_name,
    };



    let event_response = await makeGipRequestService(ftcPayload, gipUrl);
    let eventPayload = {
      event_name: "FTC_REQUEST",
      event_payload: ftcPayload,
      event_url: gipUrl,
      event_response: event_response.response,
      status: "PENDING",
      callback: record.callback,
      session_id: unique_result.rows[0].session_id,
      action_code: event_response.response.actionCode,
      tracking_number: unique_result.rows[0].tracking_number,
      approval_code: event_response.response.actionCode,
      dest_account_number: record.dest_account_number,
      src_account_number: record.src_account_number,
      dest_account_name: record.dest_account_name,
      src_account_name: record.src_account_name,
      src_bank_code: record.dest_account_number,
      dest_bank_code: record.src_account_number,
      request_id: record.request_id,
      request_date_time: record.request_date_time,
      request_tracking_number: record.request_tracking_number,
      parent_event_id: record.event_id,
      parent_session_id: record.session_id,
      parent_tracking_number: record.tracking_number,
      parent_callback_url: record.callback,
    };

    // Use npradb.Create with the transaction client
    const newFtc = await npradb.Create(eventPayload, "event", null, client);

    eventTimelinePayload = {
      transaction_id: newFtc.event_id,
      event_type: newFtc.event_name,
      event_details: "FTC_REQUEST",
      status: "PENDING",
      remarks: newFtc.event_id,
    };

    await globalEventEmitter.emit("EVENT_TIMELINE", eventTimelinePayload);

    return event_response.response;
  } catch (err) {
    throw err; // bubble up the error
  }
}
/**
 * Mark an event/callback as FAILED and enqueue a job in `job_queue`.
 * @param {Object} record - Must contain `event_id`, `callback_id`, etc.
 */
async function markFailedAndEnqueueJob(record, client) {
  try {
    // 1) Update event -> FAILED
    if (record.event_id) {
      await npradb.Update(
        { status: "FAILED" },
        "event",
        "event_id",
        record.event_id,
        client
      );
    }

    // 2) Update callback -> FAILED
    if (record.callback_id) {
      await npradb.Update(
        { status: "FAILED" },
        "callback",
        "callback_id",
        record.callback_id,
        client
      );
    }

    // 3) Insert a job into `job_queue`
    // const jobPayload = {
    //   reason: "markFailedAndEnqueueJob",
    //   record:record.payload,
    // };
    const jobPayload = { payload: record.payload }
    await npradb.Create({ payload: jobPayload }, "job_queue", null, client);

    console.log("Event & callback marked FAILED, job enqueued.");
  } catch (err) {
    throw err;
  }
}

/**
 * Mark an event & callback as COMPLETED in a single transaction.
 */
async function markEventAndCallbackAsComplete(eventId, callbackId, client) {
  try {
    if (eventId) {
      await npradb.Update(
        { status: "COMPLETED" },
        "event",
        "event_id",
        eventId,
        client
      );
    }
    if (callbackId) {
      await npradb.Update(
        { status: "COMPLETED" },
        "callback",
        "callback_id",
        callbackId,
        client
      );
    }

    console.log(`Event ${eventId} & Callback ${callbackId} => COMPLETED`);
  } catch (err) {
    throw err;
  }
}
/**
 * Create a new "outgoing" callback record.
 */
async function createOutgoingCallback(record, client) {
  try {
    const payload = {
      payload: record.payload || {}, // JSONB of the callback info
      action_code: record.action_code || null,
      status: "PENDING",
      outgoing_url: record.outgoing_url || null,
    };

    const newCallback = await npradb.Create(payload, "callback", null, client);

    console.log("Created outgoing callback:", newCallback.id);
    return newCallback;
  } catch (err) {
    throw err;
  }
}
/**
 * Add a new job to the job_queue.
 */
async function sendJobToQueue(record, client) {
  try {
    const jobPayload = {
      type: "OUTGOING_CALLBACK",
      data: record,
    };
    const newJob = await npradb.Create(
      { payload: jobPayload },
      "job_queue",
      null,
      client
    );

    console.log("Enqueued job:", newJob.id);
    return newJob;
  } catch (err) {
    throw err;
  }
}

/**
 * Mark an event & callback as SUCCESS in one transaction.
 */
async function markSuccess(eventId, callbackId, client) {
  try {
    if (eventId) {
      await npradb.Update(
        { status: "SUCCESS" },
        "event",
        "event_id",
        eventId,
        client
      );
    }
    if (callbackId) {
      await npradb.Update(
        { status: "SUCCESS" },
        "callback",
        "callback_id",
        callbackId,
        client
      );
    }

    console.log(`Event ${eventId} & Callback ${callbackId} => SUCCESS`);
  } catch (err) {
    throw err;
  }
}

/**
 * Mark event & callback as FAILED in one transaction (no job queue insertion).
 */
async function markFailed(eventId, callbackId, client) {
  try {
    if (eventId) {
      await npradb.Update(
        { status: "FAILED" },
        "event",
        "event_id",
        eventId,
        client
      );
    }
    if (callbackId) {
      await npradb.Update(
        { status: "FAILED" },
        "callback",
        "callback_id",
        callbackId,
        client
      );
    }

    console.log(`Event ${eventId} & Callback ${callbackId} => FAILED`);
  } catch (err) {
    throw err;
  }
}
async function markFailedError(eventId, callbackId, client) {
  try {
    if (eventId) {
      await npradb.Update(
        { status: "FAILED_ERROR" },
        "event",
        "event_id",
        eventId,
        client
      );
    }
    if (callbackId) {
      await npradb.Update(
        { status: "FAILED_ERROR" },
        "callback",
        "callback_id",
        callbackId,
        client
      );
    }

    console.log(`Event ${eventId} & Callback ${callbackId} => FAILED_ERROR`);
  } catch (err) {
    throw err;
  }
}

/**
 * Mark event & callback as TSQ_STATE, also set event.tsq_state = true if that column exists.
 */
async function markTsqState(eventId, callbackId, client) {
  try {
    if (eventId) {
      await npradb.Update(
        { status: "TSQ_STATE", tsq_state: true },
        "event",
        "event_id",
        eventId,
        client
      );
    }
    if (callbackId) {
      await npradb.Update(
        { status: "TSQ_STATE" },
        "callback",
        "callback_id",
        callbackId,
        client
      );
    }
    console.log(`Event ${eventId} & Callback ${callbackId} => TSQ_STATE`);
  } catch (err) {
    throw err;
  }
}

/**
 * Perform the TSQ check (Status Query).
 * GIP API call. Returns a final status code or actionCode.
 */
async function performTsqCheck(record, client) {
  try {
    // Example: Make an HTTP request to  "GIP"
    // const response = await axios.post('https://processor.example.com/tsq', { record });
    // let finalStatus = response.data.action_code;
    // return finalStatus;

    // For demonstration, pick from random:
    const possibleCodes = ["000", "001", "909", "912", "990", "FAILED"];
    const randomIndex = Math.floor(Math.random() * possibleCodes.length);
    const finalStatus = possibleCodes[randomIndex];
    console.log(`TSQ check for record ${record.id} => ${finalStatus}`);
    return finalStatus;
  } catch (error) {
    console.error("performTsqCheck error:", error.message);
    // Return some fallback status or throw
    return "FAILED";
  }
}

/**
 * Fetch pending FTD callbacks by joining callback + event tables.
 */
const fetchFtdPendingCallbacks = async () => {
  const sql = `
    SELECT 
      c.*, 
      e.*,
      c.action_code,
      e.action_code AS event_action_code
    FROM callback c
    JOIN event e ON e.session_id = c.session_id
    WHERE c.status = 'PENDING'
      AND e.event_name = 'FTD_REQUEST'
      AND e.tsq_state = false
    LIMIT 20
  `;
  const { rows } = await pool.query(sql);
  return rows;
};

/**
 * Fetch pending records with no callback by joining callback + event tables.
 */
const fetchPendingTsqRecords = async () => {
  const sql = `
    SELECT 
  e.*, 
  c.action_code AS callback_action_code,
  c.status AS callback_status
FROM event e
LEFT JOIN callback c ON e.session_id = c.session_id
WHERE e.event_name IN ('FTD_REQUEST', 'FTC_REQUEST')
  AND e.status IN ('PENDING', 'TSQ_STATE')
  AND e.created_at <= NOW() - INTERVAL '1 minutes'
  AND (c.callback_id IS NULL)
LIMIT 20;

  `;
  const { rows } = await pool.query(sql);
  return rows;
};

/**
 * Fetch pending FTD callbacks by joining callback + event tables.
 */
const fetchFtcFailedRecords = async () => {
  const sql = `
    SELECT 
      c.*, 
      e.*,
      c.action_code,
      e.action_code AS event_action_code
    FROM callback c
    JOIN event e ON e.session_id = c.session_id
    WHERE c.status = 'FAILED'
      AND e.event_name = 'FTC_REQUEST'
      AND e.tsq_state = false
    LIMIT 20
  `;
  const { rows } = await pool.query(sql);
  return rows;
};

// ---------- fetchFtdTsqRecords ----------
const fetchFtdTsqRecords = async () => {
  const sql = `
    SELECT 
      c.*, 
      e.*,
      c.action_code,
      e.action_code AS event_action_code
    FROM callback c
    JOIN event e ON e.session_id = c.session_id
    WHERE c.status = 'TSQ_STATE'
      AND e.event_name = 'FTD_REQUEST'
      AND e.tsq_state = true
    LIMIT 20
  `;
  const { rows } = await pool.query(sql);
  return rows;
};

// ---------- fetchFtcTsqRecords ----------
const fetchFtcTsqRecords = async () => {
  const sql = `
    SELECT 
      c.*, 
      e.*,
      c.action_code,
      e.action_code AS event_action_code
    FROM callback c
    JOIN event e ON e.session_id = c.session_id
    WHERE c.status = 'TSQ_STATE'
      AND e.event_name = 'FTC_REQUEST'
      AND e.tsq_state = true
    LIMIT 20
  `;
  const { rows } = await pool.query(sql);
  return rows;
};

// ---------- fetchFtcPendingCallbacks ----------
const fetchFtcPendingCallbacks = async () => {
  const sql = `
    SELECT 
      c.*, 
      e.*,
      c.action_code,
      e.action_code AS event_action_code
    FROM callback c
    JOIN event e ON e.session_id = c.session_id
    WHERE c.status = 'PENDING'
      AND e.event_name = 'FTC_REQUEST'
      AND e.tsq_state = false
    LIMIT 20
  `;
  const { rows } = await pool.query(sql);
  return rows;
};
/**
 * Save (create) a new outgoing callback record in the `callback` table.
 * Uses a transaction with beginTransaction/commitTransaction/rollbackTransaction.
 *
 * @param {Object} record - Data needed for the outgoing callback.
 * @returns {Promise<Object>} The newly saved callback record.
 */
async function saveOutgoingCallback(record, client = null) {
  try {
    // Use a passed-in client or fallback to pool
    const usedClient = client;

    const payload = {
      payload: {
        srcBankCode: record.src_bank_code,
        srcAccountNumber: record.src_account_number,
        referenceNumber: record.reference_number,
        requestTimestamp: record.request_timestamp,
        sessionId: record.session_id,
        destBankCode: record.dest_bank_code,
        destAccountNumber: record.dest_account_number,
        narration: record.narration,
        responseCode: "000",
        responseMessage: "Approved",
        status: "SUCCESSFUL",
      },
      status: "PENDING",
      retries: 0,
      callback_url: record.callback,
    };

    // Simply create the record using npradb.Create without wrapping in a new transaction
    const newCallback = await npradb.Create(
      payload,
      "job_queue",
      null,
      usedClient
    );
    console.log(`pushing new job: Created job ${newCallback.id}`);

    return newCallback;
  } catch (err) {
    console.error("Error in saveOutgoingCallback:", err.message);
    throw err;
  }
}

async function updateTsqIteration(record, client) {
  // example: increment attempts, set next tsq time
  await npradb.Update(
    {
      tsq_attempts: (record.tsq_attempts || 0) + 1,
      next_tsq_time: new Date(Date.now() + config.tsq.intervalMinutes * 60_000),
    },
    "event",
    "event_id",
    record.event_id,
    client
  );
}

module.exports = {
  createFtcRequest,
  markFailedAndEnqueueJob,
  markEventAndCallbackAsComplete,
  createOutgoingCallback,
  sendJobToQueue,
  markSuccess,
  markFailed,
  markFailedError,
  markTsqState,
  performTsqCheck,
  fetchFtdPendingCallbacks,
  fetchFtcPendingCallbacks,
  fetchFtcTsqRecords,
  fetchFtdTsqRecords,
  saveOutgoingCallback,
  updateTsqIteration,
  createFtcTsqRequest,
  fetchFtcFailedRecords,
  createFtcRetryRequest,
  fetchPendingTsqRecords
};
