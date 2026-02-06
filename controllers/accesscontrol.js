const apiAccessService = require("../services/api_access");
const asynHandler = require("../middleware/async");
const { sendResponse } = require("../utils/utilfunc");
const { toSnakeCase } = require("../helper/func");

exports.createAPiAccess = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const {results,client_id,api_key,client_name} = await apiAccessService.createApiAccessService(payload);

  if (results.rowCount == 1) {
    return sendResponse(res, 1, 200, "New channel added", {
      client_id,api_key,client_name
    });
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

exports.VerifyAPiAccess = asynHandler(async (req, res, next) => {
  let userData = req.channelInfo;

  return sendResponse(res, 1, 200, "Loggedin", userData);
})