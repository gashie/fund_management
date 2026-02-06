const repositoryFactory = require("../repositories");
const dbTypeFolder = process.env.DB_TYPE || "postgres"; // Use environment variable for dbType

const fileName = "api_access";

async function createApiAccessService(payload) {
  const repository = repositoryFactory.getRepository(dbTypeFolder,fileName);
  return await repository.saveClient(payload);
}

async function findApiAccessService(id) {
    const repository = repositoryFactory.getRepository(dbType, type);
    return await repository.findClient(id);
  }


module.exports = {
    createApiAccessService,
    findApiAccessService
};
