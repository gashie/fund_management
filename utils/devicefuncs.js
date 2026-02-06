
// At request level
const DeviceDetector = require('node-device-detector');
const ClientHints = require('node-device-detector/client-hints')

const crypto = require('crypto')
module.exports = {


    DetectDevice: async (agent, req) => {


        const detector = new DeviceDetector({
            clientIndexes: true,
            deviceIndexes: true,
            deviceAliasCode: false,
            indexes: false,
            // ... all options scroll to Setter/Getter/Options
        });

        const clientHints = new ClientHints();
        const clientHintData = clientHints.parse(req.headers);

        // result promise
        // added for 2.0.4 version or later
        const resulttwo = await detector.detect(agent, clientHintData);
        return JSON.stringify(resulttwo)
    },

    DetectIp: (req) => {
        var ip = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress;
        return ip.split(':').pop()
    },
    MainEnc: (obj) => {  //encrypt device information and ip
        // Create an encryptor:
        var encryptor = require('simple-encryptor')("process.env.MainEncKey");
        var objEnc = encryptor.encrypt(obj);
        // Should print gibberish:
        return objEnc
    },
    MainDec: (obj) => { //decrypt device information and ip
        // Create a decryptor:
        var encryptor = require('simple-encryptor')("process.env.MainEncKey");
        // var objDec = encryptor.decrypt(obj?.replace(/^["'](.+(?=["']$))["']$/, '$1'));

        var objDec = encryptor.decrypt(obj);

        // Should print correct result:
        return objDec
    },
    SimpleEncrypt: (data = '', encryptionKey = '') => { //decrypt device information and ip
        const initializationVector = crypto.randomBytes(16);
        const hashedEncryptionKey = crypto.createHash('sha256').update(encryptionKey).digest('hex').substring(0, 32);
        const cipher = crypto.createCipheriv('aes256', hashedEncryptionKey, initializationVector);

        let encryptedData = cipher.update(Buffer.from(data, 'utf-8'));
        encryptedData = Buffer.concat([encryptedData, cipher.final()]);

        return `${initializationVector.toString('hex')}:${encryptedData.toString('hex')}`;

    },
    SimpleDecrypt: (encryptedData = '', encryptionKey = '') => { //decrypt device information and ip
        const [initializationVectorAsHex, encryptedDataAsHex] = encryptedData?.split(':');
        const initializationVector = Buffer.from(initializationVectorAsHex, 'hex');
        const hashedEncryptionKey = crypto.createHash('sha256').update(encryptionKey).digest('hex').substring(0, 32);
        const decipher = crypto.createDecipheriv('aes256', hashedEncryptionKey, initializationVector);
        
        let decryptedText = decipher.update(Buffer.from(encryptedDataAsHex, 'hex'));
        decryptedText = Buffer.concat([decryptedText, decipher.final()]);
      
        return decryptedText.toString();

    },
};