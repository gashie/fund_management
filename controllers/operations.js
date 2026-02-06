// *FIRST CONTROLLER*

// 1.create institution controller
// 2.view institution controller
// 3.update institution controller
// 4.delete institution controller

// *SECOND CONTROLLER*

// 1.create settlement accounts
// 2.view settlement accounts
// 3.update settlement accounts
// 4.delete settlement accounts

// *THIRD CONTROLLER*

// 1.view audit logs controller

// *FOURTH CONTROLLER

// i.   view pending rtgs files controller -- (from the request table, where approved is pending) 1
// ii.  action pending rtgs files (approve/decline) (from the request table, where approved is pending) 5
// iii. view archived rtgs files (filed already worked on) (from the request table, where approved is approved/declined) 2
// iv.  view current day's transactions (searchable by debit and credit instition) (from the request table) 3
// v.   view archived transactions (searchable by date, date range, debit and credit instition) (from the request table) 4
const requestService = require("../services/request");
//audit logs
exports.viewAuditLogs = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await requestService.viewAuditLogService(payload);

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

exports.viewPendingRTGS = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await requestService.viewPendingRTGSService(payload);

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

exports.RTGSApproval = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await requestService.RTGSApprovalService(payload);

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

exports.viewArchivedRTGS = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await requestService.viewArchivedRTGSService(payload);

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

exports.viewCurrentDayTransaction = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  const result = await requestService.viewCurrentDayTransactionService(payload);

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

exports.viewArchivedTransaction = asynHandler(async (req, res) => {
  const payload = toSnakeCase(req.body);

  //create institution
  const result = await requestService.viewArchivedTransactionService(payload);

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


