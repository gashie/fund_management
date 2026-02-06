const express = require("express");
const router = express.Router();

const requestController = require("../controllers/request");
const requestftcController = require("../controllers/request_ftc");
const institutionController = require("../controllers/institutions");
const settlementAccountController = require("../controllers/settlement_accounts")
const reportController = require("../controllers/reports")
const approvalController = require("../controllers/approval");
const reportsController = require("../controllers/reports")
const apiAccessController = require("../controllers/accesscontrol")
// const ipAccessMiddleware = require("../middleware/ipmiddleware");
const { NecValidator, ftdValidator, tsqValidator } = require("../middleware/validator");
const verifyToken = require("../middleware/keycloak"); //old token verifier
const { createSavedQuery, mainReportController } = require("../controllers/dynamic_reports");
const { protectApi } = require("../middleware/auth"); //new token verifier

router.post("/debit/v1/ne",protectApi,NecValidator, requestController.sendRequest);
router.post("/debit/v1/ft",protectApi, ftdValidator,requestftcController.sendRequest);
router.post("/debit/v1/tsq",protectApi, tsqValidator, requestftcController.sendTsqRequest);

router.post("/create-institution", institutionController.createInstitution);
router.post("/view-institutions", institutionController.viewInstitutions);
router.post("/update-institution", institutionController.updateInstitution);
router.post("/delete-institution", institutionController.deleteInstitution);

router.post("/create-settlement-account", settlementAccountController.createSettlementAccount);
router.post("/view-settlement-accounts", settlementAccountController.viewSettlementAccount);
router.post("/update-settlement-account", settlementAccountController.updateSettlementAccount);
router.post("/delete-settlement-account", settlementAccountController.deleteSettlementAccount);

// router.post("/report", reportController.mainReportController);

router.post("/approval", approvalController.ApproveOrDeny);
router.post("/debit/v1/callback", institutionController.createCallback);

//test env
router.post("/debit/v1/test/ne",protectApi,NecValidator, requestController.sendRequest);
router.post("/debit/v1/test/ft",protectApi,ftdValidator,requestftcController.sendRequest);
router.post("/debit/v1/test/tsq",protectApi,tsqValidator, requestftcController.sendTsqRequest);
router.post("/debit/v1/test/report",protectApi, reportController.TransactionReport)

router.post("/debit/v1/savequery", createSavedQuery)
router.post("/debit/v1/rundynamicreport", mainReportController)

router.post("/create_api", apiAccessController.createAPiAccess)
router.post("/auth",protectApi, apiAccessController.VerifyAPiAccess)
module.exports = router;
