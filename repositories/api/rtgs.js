const { makeApiCall } = require("../../utils/restClient");

async function makeRtgsRequest(payload) {
  return makeApiCall(
    "http://localhost:3003/api/files/create",
    "POST",
    payload,
    { Accept: "application/json", "Content-Type": "application/json" }
  );
}

module.exports = { makeRtgsRequest };
