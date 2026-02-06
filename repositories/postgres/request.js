const { addItem, getItemById, getItems, updateItem } = require('../../helper/dynamic');
const npradb = require('../../model/Global');
const { uniqueIds, uniqueIdNoParam } = require('../../model/Request');



async function saveRequests(payload) {
  let results = await addItem('requests', payload);
  return results
}

async function saveQuery(payload) {
  let results = await addItem('saved_queries', payload);
  return results
}

async function saveEvents(payload) {
  let results = await addItem('event', payload);
  return results
}
async function saveEventTimeLine(payload) {
  let results = await addItem('request_logs', payload);
  return results
}
async function saveTSQLogs(payload) {
  let results = await addItem('tsq_logs', payload);
  return results
}

async function saveCallback(payload) {
  let results = await addItem('callback', payload);
  return results
}
async function saveJob(payload) {
  let results = await addItem('job_queue', payload);
  return results
}

async function findReference(reference_number) {
  const tableName = "requests";
  const columnsToSelect = []; // Use string values for column names
  const conditions = [{ column: "reference_number", operator: "=", value: reference_number }];
  let results = await getItemById(tableName, columnsToSelect, conditions);
  return results
}
async function findUniqueReference(reference_number, src_bank_code, request_timestamp) {
  const tableName = "requests";
  const columnsToSelect = []; // Use string values for column names
  const conditions = [
    { column: "reference_number", operator: "=", value: reference_number },
    { column: "src_bank_code", operator: "=", value: src_bank_code },
    { column: "request_timestamp", operator: "=", value: request_timestamp }


  ];

  let results = await getItemById(tableName, columnsToSelect, conditions);
  return results
}

async function generateRef(reference_number) {
  let results = await uniqueIds(reference_number);
  return results
}
async function generateRefNoParam() {
  let results = await uniqueIdNoParam();
  return results
}

async function dynamicReports(queryName, requestBody) {
  // 1. Fetch from saved_queries
  const fetchSql = `SELECT base_query, conditions FROM saved_queries WHERE query_name = $1`;
  const result = await npradb.Execute(fetchSql, [queryName]);
  if (result.rows.length === 0) {
    throw new Error(`No saved query found for "${queryName}"`);
  }

  const { base_query, conditions } = result.rows[0];
  let query = base_query;
  let values = [];
  let whereClauses = [];

  // 2. Parse conditions (assume it's an array of {column, operator, value})
  if (conditions && Array.isArray(conditions)) {
    conditions.forEach((cond, idx) => {
      // e.g., cond.value = ":id" means pull requestBody.id
      const paramKey = cond.value.startsWith(':')
        ? cond.value.slice(1)
        : cond.value;
      const paramValue = requestBody[paramKey];

      if (paramValue !== undefined) {
        whereClauses.push(`"${cond.column}" ${cond.operator} $${values.length + 1}`);
        values.push(paramValue);
      }
    });

    // If we have whereClauses, append them
    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
  }

  // 3. Execute final query
  const finalResult = await npradb.Execute(query, values);
  console.log(finalResult);
  
  return finalResult.rows;
}
module.exports = {
  saveRequests,
  findReference,
  generateRef,
  saveJob,
  findUniqueReference,
  saveCallback,
  saveEvents,
  saveEventTimeLine,
  saveTSQLogs,
  dynamicReports,
  generateRefNoParam,
  saveQuery
};
