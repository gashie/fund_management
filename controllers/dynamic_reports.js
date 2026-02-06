const reportService = require("../services/global_db_service");
const asynHandler = require("../middleware/async");
const { sendResponse } = require("../utils/utilfunc");
const { toSnakeCase } = require("../helper/func");

exports.mainReportController = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);
  const results = await reportService.runSavedQueryService(payload.query,payload.values);

  sendResponse(res, 1, 200, "Record Found", results);

});


exports.createSavedQuery = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await reportService.createSavedQueryService(payload);

  if (result.rowCount == 1) {
    return sendResponse(res, 1, 200, "Record Saved", []);
  } else {
    return sendResponse(
      res,
      0,
      200,
      "Sorry, error saving record: contact administrator",
      []
    );
  }
});