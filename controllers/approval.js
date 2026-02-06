const approvalService = require("../services/approval");
const asynHandler = require("../middleware/async");
const { sendResponse } = require("../utils/utilfunc");

exports.ApproveOrDeny = asynHandler(async (req, res, next) => {
  let payload = req.body;

  // let user_id = req.user.user_id;
  let user_id = "c9dd54b6-b717-46a0-8964-c4001e4be3a0";
  let tableName =
    payload.approval_type === "rtgs"
      ? "requests"
      : payload.approval_type === "bank_user"
      ? "bank_users"
      : payload.approval_type === "user"
      ? "users"
      : payload.approval_type === "third_party"
      ? "third_parties"
      : payload.approval_type === "third_party_user"
      ? "third_party_users"
      : payload.approval_type === "limit_types"
      ? "limit_types"
      : payload.approval_type === "transaction_limit"
      ? "transaction_limits"
      : "";

  const {approveupdate,approverecord} = await approvalService.approvalService(
    payload,
    tableName,
    "id",
    payload.entity_id,
    user_id
  );

  if (approverecord.rowCount == 1 && approveupdate.rowCount == 1) {    return sendResponse(res, 1, 200, "Record Updated", []);
  } else {
    return sendResponse(res, 0, 200, "Update failed, please try later", []);
  }
});
