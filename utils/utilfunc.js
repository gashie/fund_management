const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { logger } = require("../logs/winston");
dotenv.config({ path: "./config/config.env" });
const { DetectDevice, DetectIp, MainEnc } = require("./devicefuncs");
const systemDate = new Date().toISOString().slice(0, 19).replace("T", " ");
// const { ApiCall } = require("./autoCalls");

module.exports = {
  sendResponse: (res, status, code, message, data) => {
    status == 0 ? logger.error(message) : logger.info(message);
    res.status(code).json({
      status: status,
      message: message,
      data: data ? data : [],
    });
  },

  sendGipResponse: (res,code, payload) => {
    res.status(code).json(payload);
  },

  CatchHistory: async (data, req) => {
    (data.service_name = process.env.ServiceName),
      // data.service_info,
      // data.location_info,
      // data.extra_data,
      (data.date_ended = systemDate);
    data.created_at = systemDate;
    data.device = await DetectDevice(req.headers["user-agent"], req);
    data.ip = DetectIp(req);
    data.url = req.path;

    console.log(data);
    //    ApiCall(`${process.env.AuditUrl}api/v1/savelogs`, 'POST', ``, data)
  },
  accessCode: () => {
    require("crypto").randomBytes(48, function (err, buffer) {
      var token = buffer.toString("hex");
    });
  },
  sendCookie: async (UserInfo, status, code, res, req) => {
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

    // // Create secure cookie with refresh token
    const options = {
      httpOnly: true, //accessible only by web server
      secure: false, //https
      // sameSite: 'None', //cross-site cookie
      maxAge: 1 * 24 * 60 * 60 * 1000, //cookie expiry: set to match rT
    };
    logger.info("Logged in successfully");
    return res.status(code).cookie("cid", accessToken, options);
  },

  clearResponse: (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.cid) return res.sendStatus(204); //No content
    res.clearCookie("cid", {
      httpOnly: true,
      secure: false,
      expires: new Date(Date.now() + 10 * 1000),
    });
    logger.info("Logged out");
    return res.json({ Message: "Logged out" });
  },
  removeFile: async (dir, file) => {
    const fs = require("fs").promises;
    const path = require("path");
    await fs.unlink(path.join(dir, file));
    console.log("Deleted", file);
    return;
  },
};
