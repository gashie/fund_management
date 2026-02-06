const { addItem,getItemById,getItems,updateItem } = require('../../helper/dynamic');



async function saveHealthConfig(payload) {
    let results = await addItem('health_check_config', payload);
    return results
}

async function createAlert(payload) {
    let results = await addItem('alerts', payload);
    return results
}

async function viewHealthConfig() {
    const tableName = "health_check_config";
    const columnsToSelect = []; // Use string values for column names
    const conditions = [];
    let results = await getItems(tableName, columnsToSelect, conditions);
    return results
}

async function viewAlert() {
    const tableName = "alerts";
    const columnsToSelect = []; // Use string values for column names
    const conditions = [];
    let results = await getItems(tableName, columnsToSelect, conditions);
    return results
}
async function updateHealthConfig(payload,id) {
    const runupdate = await updateItem(payload, "health_check_config", "id", id);
    return runupdate
}
module.exports = {  saveHealthConfig, viewHealthConfig, updateHealthConfig,createAlert,viewAlert };
