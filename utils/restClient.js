const axios = require("axios")
async function makeApiCall(
  url,
  method = "POST",
  data = null,
  headers = {},
  authType = null,
  authValue = null
) {
  try {
    const config = {
      method: method.toUpperCase(),
      url,
      headers,
    };

    if (authType && authValue) {
      if (authType.toLowerCase() === "basic") {
        config.auth = {};
      } else if (authType.toLowerCase() === "bearer") {
        config.headers["Authorization"] = `Bearer ${authValue}`;
      } else {
        // Handle other authentication types as needed
        // Add conditions for other auth types
      }
    }

    if (data) {
      if (
        headers["Content-Type"] &&
        headers["Content-Type"].toLowerCase() === "application/json"
      ) {
        config.data = data;
      } else if (data instanceof FormData) {
        config.data = data;
        Object.assign(headers, data.getHeaders());
      } else {
        config.data = JSON.stringify(data);
        headers["Content-Type"] = "application/json";
      }
    }

    const response = await axios(config);
    console.log(config);
    
    //store response;
    return response.data;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  makeApiCall,
};
