const { addItem,getItemById,getItems,updateItem } = require('../../helper/dynamic');



async function saveRateLimit(payload) {
    let results = await addItem('rate_limits', payload);
    return results
}

async function findRateLimit(id) {
    const tableName = "rate_limits";
    const columnsToSelect = []; // Use string values for column names
    const conditions = [{ column: "id", operator: "=", value: id }];
    let results = await getItemById(tableName, columnsToSelect, conditions);
    return results
}
async function viewRateLimit() {
    const tableName = "rate_limits";
    const columnsToSelect = []; // Use string values for column names
    const conditions = [];
    let results = await getItems(tableName, columnsToSelect, conditions);
    return results
}
async function updateRateLimit(payload,id) {
    const runupdate = await updateItem(payload, "rate_limits", "id", id);
    return runupdate
}
module.exports = {  saveRateLimit, findRateLimit, viewRateLimit, updateRateLimit };
