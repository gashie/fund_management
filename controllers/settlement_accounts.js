const settlementService = require("../services/settlement");
const asynHandler = require("../middleware/async");
const { sendResponse } = require("../utils/utilfunc");
const { toSnakeCase } = require("../helper/func");
exports.createSettlementAccount = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await settlementService.createSettlementAccountService(
    payload
  );

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

exports.viewSettlementAccount = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const results = await settlementService.viewSettlementAccountService(payload);

  if (results.rows.length == 0) {
    return sendResponse(res, 0, 200, "Sorry, No Record Found", []);
  }

  sendResponse(res, 1, 200, "Record Found", results.rows);
});

exports.updateSettlementAccount = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await settlementService.updateSettlementAccountService(
    payload,
    payload.id
  );

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

exports.deleteSettlementAccount = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await settlementService.updateSettlementAccountService(
    payload,
    payload.id
  );

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
