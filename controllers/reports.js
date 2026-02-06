const reportService = require("../services/global_db_service");
const asynHandler = require("../middleware/async");
const { sendResponse } = require("../utils/utilfunc");
const { toSnakeCase } = require("../helper/func");

const { Pool } = require("pg");
const axios = require("axios");

// Initialize PostgreSQL connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bulk_pension",
  password: "admin",
  port: 5432,
});

exports.ma,
  (PoolinReportController = asynHandler(async (req, res) => {
    const payload = toSnakeCase(req.body);
    const results = await requestService.reportService(payload.query[0]);

    if (results.rows.length == 0) {
      return sendResponse(res, 0, 200, "Sorry, No Record Found", []);
    }

    sendResponse(res, 1, 200, "Record Found", results.rows);
  }));

exports.TransactionReport = asynHandler(async (req, res) => {
  const results = await pool.query(
    `SELECT * 
    FROM requests 
    WHERE request_type = 'FTC_REQUEST' 
      AND created_at BETWEEN CURRENT_DATE - INTERVAL '1 day' AND NOW();`
  );

  console.log("results from query", results.rows[0]);

  sendResponse(res, 1, 200, "Record Found", results);

});
