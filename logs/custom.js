const config = require("../config/config");
const { addItem } = require("../functions/dynamic");
const { DetectDevice, DetectIp } = require("../utils/devicefuncs");

const systemDate = new Date().toISOString();

const logMiddleware = async (req, res, next) => {
  req.startTime = process.hrtime();
  let { app_id, api_key} = req.headers
  // Pre-fetch async data to avoid multiple logging
  const device = await DetectDevice(req.headers["user-agent"], req);
  const location = "Unknown Location";

  // Ensure req.customLog exists, if not create it
  req.customLog = req.customLog || {};

  // Wrap res.json to capture response data
  const originalJson = res.json;
  res.json = function (data) {
    req.customLog.response_data = data; // Capture the response data here
    originalJson.apply(res, arguments); // Send the response to the client
  };

  res.on("finish", () => {
    const [seconds, nanoseconds] = process.hrtime(req.startTime);
    const responseTime = (seconds * 1e9 + nanoseconds) / 1e6; // Convert to ms

    // Build the logData by merging default data with any custom data
    const logData = {
      service_name: config.service_name,
      function_name: req.route ? req.route.path : 'Unknown',
      payload: req.body,
      method: req.method,
      url: req.originalUrl,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      device: JSON.parse(device),
      location: location,
      sql_action: req.customLog.sql_action || 'SELECT',
      api_response: res.statusCode,
      response_data: req.customLog.response_data ,
      response_time: `${responseTime.toFixed(4)} ms`,
      actor: req.customLog.actor || 'Unknown',
      event: req.customLog.event || 'Generic Event',
      date_started: req.customLog.date_started || systemDate,
      date_ended: new Date().toISOString(),
      response_message: req.customLog.response_data.message || "",
      response_code: req.customLog.response_data.status,
      sid: req.customLog.sid || req?.user?.sid || "",
      user_id: req?.user?.user_id || "",
      client_id:app_id,
      api_secret:api_key,
    };

    logCentralized(logData); // Log once here
  });

  next();
};

// // Global error handler middleware
// const errorHandlerMiddleware = (err, req, res, next) => {
//     // Find the first non-node_modules occurrence in the stack trace
//     const appStackLine = err.stack
//       .split('\n')
//       .find(line => !line.includes('node_modules') && line.includes(process.cwd())); // Looks for your app's root directory
  
//     const fileName = appStackLine ? appStackLine.match(/\((.*):\d+:\d+\)/)?.[1] : 'Unknown File';
//     const lineNumber = appStackLine ? appStackLine.match(/:(\d+):\d+\)/)?.[1] : 'Unknown Line';
  
//     const errorLogData = {
//       service_name: process.env.ServiceName || 'Gip-Limit',
//       error_message: err.message || "Internal Server Error",
//       error_type: err.name || 'Unknown Error',  // Error type (e.g., TypeError, DatabaseError)
//       stack_trace: err.stack || 'No stack trace available',  // Full stack trace
//       file_name: fileName, // Extracted application file name
//       line_number: lineNumber, // Extracted line number from the application
//       sql_error_code: err.code || "No SQL error code",  // PostgreSQL error code
//       sql_action: req.customLog.sql_action || 'Unknown SQL Action',  // SQL action from request
//       db_file: err.file || "No database file info",  // Database file causing the error
//       db_line: err.line || "No database line info",  // Line number in the database file
//       db_routine: err.routine || "No database routine info",  // Routine in the PostgreSQL error
//       method: req.method,
//       url: req.originalUrl,
//       ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
//       user_agent: req.headers['user-agent'],
//       date_occurred: new Date().toISOString(),
//       actor: req?.user?.username || 'Unknown',  // User context if applicable
//       request_body: req.body,  // Optional: capture request body (for debugging)
//     };
  
//     // Log the error details
//     logCentralized(errorLogData);
  
//     // Send an appropriate response back to the client
//     res.status(500).json({
//       message: "An internal server error occurred",
//       error_code: err.code || "UNKNOWN_ERROR",
//       details: err.message || "Unknown error occurred",
//     });
//   };
  
  

// Utility function for centralizing log
const logCentralized = async (logData) => {
  addItem("logs",logData)
  // console.log(logData); // Ensure the log data is centralized
};

module.exports = {
  logMiddleware,
  // errorHandlerMiddleware,
};
