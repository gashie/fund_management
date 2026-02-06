const { addItem,getItemById,getItems,updateItem } = require('../../helper/dynamic');

async function getGatewayConfig() {
    // const query = 'SELECT * FROM gateway_config';
    // const result = await dbConfig.query(query);
    return [{ "id": 1, "name": "Cardo" }];
}

async function saveGateWay(payload) {
    let results = await addItem('gateway_config', payload);
    return results
}

async function findGateWay(id) {
    const tableName = "gateway_config";
    const columnsToSelect = []; // Use string values for column names
    const conditions = [{ column: "id", operator: "=", value: id }];
    let results = await getItemById(tableName, columnsToSelect, conditions);
    return results
}
async function viewGateWay() {
    const tableName = "gateway_config";
    const columnsToSelect = []; // Use string values for column names
    const conditions = [];
    let results = await getItems(tableName, columnsToSelect, conditions);
    return results
}
async function updateGateWay(payload,id) {
    const runupdate = await updateItem(payload, "gateway_config", "id", id);
    return runupdate
}
module.exports = { getGatewayConfig, saveGateWay, findGateWay, viewGateWay, updateGateWay };
