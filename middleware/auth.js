const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { DetectDevice, DetectIp, MainDec } = require("../helper/devicefuncs")

const asynHandler = require("../middleware/async");
const { sendResponse, CatchHistory } = require("../utils/utilfunc");
const { autoGenerateCookie } = require("../helper/auto");

dotenv.config({ path: "./config/config.env" });
const systemDate = new Date().toISOString().slice(0, 19).replace("T", " ");
exports.protectApi = asynHandler(async (req, res, next) => {

    // let device = await DetectDevice(req.headers['user-agent'], req)

    try {
        let userIp = DetectIp(req);
        let token;
    
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req?.cookies?.cid) {
            token = req?.cookies?.cid;
        }
    
        //make sure token exists
        if (!token) {
            console.log('no token, Generate new');
            try {
                return await autoGenerateCookie(req, res,next,userIp); // Call autoGenerateCookie function
                // return next();
            } catch (error) {
                console.error('Error generating cookie:', error);
                return sendResponse(res, 0, 500, 'Internal Server Error');
            }
        }
    
        // Verify token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        let tokenInfo = decoded.EncUserInfo;
        let decryptToken = MainDec(tokenInfo);
        let checkIp = decryptToken?.devirb;
    
        if (checkIp === userIp) {
            req.channelInfo = decryptToken;
            return next();
        } else {
            console.log('IPCheck =', checkIp === userIp);
            console.log('Channel want to bypass, but access denied');
            CatchHistory({ api_response: `Channel login failed: device or ip mismatch`, function_name: 'protect-middleware', date_started: systemDate, sql_action: "", event: "Middleware to protect routes", actor: '' }, req)
            return sendResponse(res, 0, 401, 'Sorry Login not successful');
        }
    } catch (error) {
        console.log(error);
        CatchHistory({ api_response: `Channel login failed: invalid token or token has expired`, function_name: 'protect-middleware', date_started: systemDate, sql_action: "", event: "Middleware to protect routes", actor: '' }, req)
        return sendResponse(res, 0, 401, 'Sorry Login not successful');
    }
    
});