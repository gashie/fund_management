const ftcWorker = require("./worker/ftc");
const ftdWorker = require("./worker/ftd");
// const ftdTsqWorker = require("./worker/ftd_tsq");
// const ftcTsqWorker = require("./worker/ftc_tsq");
// const ftcRetryWorker = require("./worker/ftc_retry");
const mainTsqWorker = require("./worker/tsq");

async function startAllServices() {
  ftdWorker(); // never returns
  ftcWorker(); // never returns
  //mainTsqWorker();
  // ftdTsqWorker(); // never returns
  // ftcTsqWorker(); // never returns
  // ftcRetryWorker()
}

startAllServices();
