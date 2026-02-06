const { convertTimestampToCustomFormat } = require('../../helper/func');
const { sendSoapRequest } = require('../../utils/soapClient');
const { makeApiCall } = require('../../utils/restClient');
const { gipUrl, CHANNEL_CODE } = require('../../config/config');



async function makeNecRequest(payload, srcBankCode, destBankCode) {
    const request_timestamp = convertTimestampToCustomFormat();
    const soapPayload = {
        'soapenv:Body': {
            'com:GIPTransaction': {
                'ReqGIPTransaction': {
                    Amount: payload.amount,
                    datetime: request_timestamp,
                    TrackingNum: payload.tracking_number,
                    FunctionCode: 230,
                    OrigineBank: srcBankCode.participant,
                    DestBank: destBankCode.participant,
                    SessionID: payload.session_id,
                    ChannelCode: 100,
                    NameToDebit: 'PDM',
                    AccountToCredit: payload.dest_account_number,
                    Narration: payload.narration,
                },
            },
        },
    };

    try {
        // Make the SOAP request

        const { xmlResponse, jsonResponse } = await sendSoapRequest(
            'http://localhost:3004/NED',
            soapPayload
        );

        // Log the responses


        return { jsonResponse };
    } catch (error) {
        console.error('Error during SOAP request:', error);
        throw error;
    }
}

async function gipGeneral(payload, url) {
    const body = {
        ...payload,
        channelCode: CHANNEL_CODE
    }

    try {
        // Make the SOAP request
        const response = await makeApiCall(
            url, "POST",
            body,
        );

        // Log the responses
        return { response };
    } catch (error) {
        console.error('Error during rest request:', error);
        throw error;
    }
}

module.exports = { makeNecRequest, gipGeneral };
