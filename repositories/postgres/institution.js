const {
  addItem,
  getItemById,
  getItems,
  updateItem,
} = require("../../helper/dynamic");

async function createInstitution(payload) {
  let results = await addItem("institutions", payload);
  return results;
}

async function viewInstitution() {
  const tableName = "institutions";
  const columnsToSelect = [];
  const conditions = [];
  let results = await getItems(tableName, columnsToSelect, conditions);
  return results;
}
async function updateInstitution(payload, id) {
  const runupdate = await updateItem(payload, "institutions", "id", id);
  return runupdate;
}

module.exports = {
  createInstitution,
  viewInstitution,
  updateInstitution,
};
