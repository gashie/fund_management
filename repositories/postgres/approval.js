// approval.js
const { updateItem, addItem } = require("../../helper/dynamic");
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
  //approval payload

  const approverecord = await addItem("approvals", payload);

  //save to entity
  let approveEntityRecords = {
    approved_at: systemDate,
    approved_by: userId ?? 1,
    is_approved: payload.is_approved,
    approval_status : payload?.is_approved == true ? "Approved" : "Declined"


  };
  if (payload.approval_type === "rtgs") {
    approveEntityRecords.rtgs_status = payload?.is_approved == true ? "Approved" : "Declined"

  }
  
  const approveupdate = await updateItem(
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

module.exports = {
  approveDynamic,
};
