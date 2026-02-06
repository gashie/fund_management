// In autoCreateEnrollment.js
const { sendResponse, sendCookie } = require("../utils/utilfunc");
const { SimpleDecrypt } = require("../helper/devicefuncs");
const { getItemById } = require("../functions/dynamic");

const autoGenerateCookie = async (req, res, next, userIp) => {

    // Function implementation
    let { app_id, api_key} = req.headers
        //decrypt license and check if it match the one in the db, if yes,
        // Search for user in db
        const tableName = "api_access";
        const columnsToSelect = []; // Use string values for column names
        const conditions = [
          { column: "id", operator: "=", value: app_id },
        ];
        let results = await getItemById(tableName, columnsToSelect, conditions);
        let ObjectInfo = results.rows[0];

        if (!ObjectInfo) {
            //device mac not in db
            return sendResponse(res, 0, 401, "Unauthorized access, channel not found");
        }
        //----check device activation too

        //validate lince 
        let token = SimpleDecrypt(ObjectInfo.api_key, ObjectInfo.client_name);
        if (token !== api_key) {
            //licensense does not match
            return sendResponse(res, 0, 401, "Unauthorized access");
        }

        if (ObjectInfo.enabled == false) {
            //access not enabled
            return sendResponse(res, 0, 401, "Unauthorized access");
        }


        let channelInfo = {
            client_name:ObjectInfo.name,
            rate_limit_per_minute:ObjectInfo.rate_limit_per_minute,
            client_ip:ObjectInfo.client_ip,
            allowed_endpoints:ObjectInfo.allowed_endpoints,
            enabled:ObjectInfo.enabled
        
        }

        sendCookie(channelInfo, 1, 200, res, req);
        // Call next middleware
        req.channelInfo = channelInfo;
        return next();

};


module.exports = { autoGenerateCookie };