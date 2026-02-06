// approval.js
const GlobalModel = require("../model/Global");
const systemDate = new Date().toISOString().slice(0, 19).replace("T", " ");

async function approveDynamic(
  payload,
  tableName,
  recordId,
  recordValue,
  userId
) {

  //create new approval record
  payload.user_id = userId;
  const approverecord = await addItem("approvals", payload);

  //save to entity
  let approveEntityRecords = {
    approved_at: systemDate,
    approved_by: userId,
    is_approved: payload.is_approved,
  };

  const approveupdate = await GlobalModel.Update(
    approveEntityRecords,
    tableName,
    recordId,
    recordValue
  );

  //insert into history
  const historyData = {
    approval_id: approverecord.rows[0].id,
    user_id: userId,
    action: payload?.is_approved == true ? "Approved" : "Declined",
    comments: payload.comments,
  };

  await addItem("approval_history", historyData);
  return {
    approverecord,
    approveupdate,
  };
}

async function addItem(tableName, payload) {
  // Logic to add new record to the database
  let results = await GlobalModel.Create(payload, tableName, "");
  return results;
}

module.exports = {
  approveDynamic,
};
