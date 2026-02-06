const repositoryFactory = require("../repositories");
const dbTypeFolder = process.env.DB_TYPE || "postgres"; // Use environment variable for dbType

const file = "settlement_account";
async function createSettlementAccountService(payload) {
    const repository = repositoryFactory.getRepository(
     dbTypeFolder,
      file
    );
    return await repository.createSettlementAccount(payload);
  }
  
  async function viewSettlementAccountService(payload) {
    const repository = repositoryFactory.getRepository(
      dbTypeFolder,
      file
    );
    return await repository.viewSettlementAccount(payload);
  }
  
  async function updateSettlementAccountService(payload,id) {
    const repository = repositoryFactory.getRepository(
      dbTypeFolder,
      file
    );
    return await repository.updateSettlementAccount(payload,id);
  }


module.exports = {
  createSettlementAccountService,
  viewSettlementAccountService,
  updateSettlementAccountService,
};
