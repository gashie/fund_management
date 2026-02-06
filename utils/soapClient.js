const axios = require('axios');
const { parseStringPromise } = require('xml2js');

// Helper to convert JSON to XML
const buildXmlRequest = (requestObject) => {
    const Builder = require('xml2js').Builder;
    const builder = new Builder({ headless: true });
    return builder.buildObject(requestObject);
};

/**
 * Function to make a SOAP API request
 * @param {string} url - The endpoint URL
 * @param {object} payload - The payload to be sent in JSON format
 * @returns {Promise<{xmlResponse: string, jsonResponse: object}>} - Response in XML and JSON formats
 */
const sendSoapRequest = async (url, payload) => {
    try {
        // Convert JSON payload to XML
        const xmlPayload = buildXmlRequest(payload);

        // Send the request using axios
        const response = await axios.post(url, xmlPayload, {
            headers: { 'Content-Type': 'application/xml' },
        });

        const xmlResponse = response.data;

        // Convert XML response to JSON
        const jsonResponse = await parseStringPromise(xmlResponse, { explicitArray: false });

        // Return both formats
        return {
            xmlResponse,
            jsonResponse,
        };
    } catch (error) {
        console.error('Error making SOAP request:', error);
        throw new Error('Failed to send SOAP request');
    }
};



module.exports = { sendSoapRequest };
