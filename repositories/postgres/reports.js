const {
  getItemById,
} = require("../../helper/dynamic");



async function requestReporter(query) {
let results = await getItemById(query.table, query.columnsToSelect, query.conditions);
  return results;
}

module.exports = {
requestReporter
};
