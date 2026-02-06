const {
  addItem,
  getItems,
  updateItem,
} = require("../../helper/dynamic");

async function createSettlementAccount(payload) {
  let results = await addItem("settlement_accounts", payload);
  return results;
}

async function viewSettlementAccount() {
  const tableName = "settlement_accounts";
  const columnsToSelect = [];
  const conditions = [];
  let results = await getItems(tableName, columnsToSelect, conditions);
  return results;
}

async function updateSettlementAccount(payload,id) {
  const runupdate = await updateItem(payload, "settlement_accounts", "id", id);
  return runupdate;
}

module.exports = {
  createSettlementAccount,
  viewSettlementAccount,
  updateSettlementAccount,
};
