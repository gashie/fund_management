const uuidV4 = require("uuid");
const { generateApiKey } = require("generate-api-key");
const { SimpleEncrypt } = require("../../helper/devicefuncs");
const { addItem,getItemById } = require('../../helper/dynamic');



async function saveClient(payload) {


    let generatekey = generateApiKey({
        method: "uuidv4",
        name: payload.client_name.replace(/ /g, "_"),
        namespace: uuidV4.v4(),
        prefix: `npra_${payload.client_name.replace(/ /g, "_")}`,
      });
  
      let token = SimpleEncrypt(generatekey, payload.client_name);
  
      let enrollPayload = {
        api_key: token,
        client_name: payload.client_name,
      };
  
      let results = await addItem("api_access", enrollPayload);
      return { client_name: payload.client_name, api_key: generatekey, client_id: results.rows[0].id,results };
}

async function findClient(id) {
    const tableName = "api_access";
    const columnsToSelect = []; // Use string values for column names
    const conditions = [{ column: "id", operator: "=", value: id }];
    let results = await getItemById(tableName, columnsToSelect, conditions);
    return results
}

module.exports = {  saveClient, findClient };
