const { sendResponse } = require("../utils/utilfunc");
const { logger } = require("../logs/winston");
const {
  ftdPayload,nameEnquiryRequest,tsqPayload,
} = require("../validation/schema");
module.exports = {
    NecValidator: async (req, res, next) => {
    const options = {
      errors: {
        wrap: {
          label: "",
        },
      },
    };
    const value = await nameEnquiryRequest.validate(req.body, options);
    if (value.error) {
        sendResponse(res, 0, 200, value.error.details[0].message)
      logger.error(value.error.details[0].message);
    } else {
      next();
    }
  },
  ftdValidator: async (req, res, next) => {
    const options = {
      errors: {
        wrap: {
          label: "",
        },
      },
    };
    const value = await ftdPayload.validate(req.body, options);
    if (value.error) {
      sendResponse(res, 0, 200, value.error.details[0].message)
      logger.error(value.error.details[0].message);
    } else {
      next();
    }
  },
  tsqValidator: async (req, res, next) => {
    const options = {
      errors: {
        wrap: {
          label: "",
        },
      },
    };
    const value = await tsqPayload.validate(req.body, options);
    if (value.error) {
      sendResponse(res, 0, 200, value.error.details[0].message)
      logger.error(value.error.details[0].message);
    } else {
      next();
    }
  },
  
};