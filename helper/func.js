const dotenv = require("dotenv");
const _ = require('lodash');
const jwt = require("jsonwebtoken");
dotenv.config({ path: "./config/config.env" });
const { DetectIp, MainEnc } = require("../utils/devicefuncs");

module.exports = {
  formatAmount: (amount) => {
    // Convert the amount to a string with two decimal places
    const amountStr = (amount * 100).toFixed(0); // Multiplies by 100 to account for cents and removes decimal

    // Pad with leading zeros to ensure the length is 13
    const formattedAmount = amountStr.padStart(12, '0');

    return formattedAmount;
  },

  setJwt: (UserInfo, req) => {
    // let device = await DetectDevice(req.headers['user-agent'], req)
    let userIp = DetectIp(req);
    // UserInfo.devcrb = device
    UserInfo.devirb = userIp;
    let EncUserInfo = MainEnc(UserInfo); //encrypt entire user information
    const accessToken = jwt.sign(
      { EncUserInfo },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "24hrs" }
    );

    // // Create token and share
    return accessToken;
  },


  /**
   * Convert an object or array of objects from camelCase to snake_case.
   * @param {Object|Array} payload - The payload to convert.
   * @returns {Object|Array} - Converted payload in snake_case.
   */
  toSnakeCase: (payload) => {
    if (Array.isArray(payload)) {
      return payload.map((item) => _.mapKeys(item, (value, key) => _.snakeCase(key)));
    }
    return _.mapKeys(payload, (value, key) => _.snakeCase(key));
  },

  /**
   * Convert an object or array of objects from snake_case to camelCase.
   * @param {Object|Array} payload - The payload to convert.
   * @returns {Object|Array} - Converted payload in camelCase.
   */
  toCamelCase: (payload) => {
    if (Array.isArray(payload)) {
      return payload.map((item) => _.mapKeys(item, (value, key) => _.camelCase(key)));
    }
    return _.mapKeys(payload, (value, key) => _.camelCase(key));
  },
  convertTimestampToCustomFormat:()=> {
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-based
    const year = String(date.getFullYear()).slice(-2); // So this will get last 2 digits of year
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

};
