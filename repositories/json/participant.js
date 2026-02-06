

let {routingData} = require('../../config/members');

async function saveRoutingItem(payload) {
    // Add a new item to the routing data
    routingData.push(payload); // Simulate adding to the JSON array
    return {rowCount:1};
}

async function findRoutingItem(code) {
    return routingData.find(item => item.code === code);
}

async function viewRoutingItems() {
    // Retrieve all items
    return routingData;
}

async function updateRoutingItem(payload, code) {
    // Update an item by its code
    const index = routingData.findIndex(item => item.code === code);
    if (index === -1) throw new Error('Item not found');

    routingData[index] = { ...routingData[index], ...payload }; // Merge the payload
    return {rowCount:1};
}

module.exports = { saveRoutingItem, findRoutingItem, viewRoutingItems, updateRoutingItem };
