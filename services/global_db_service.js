
  const repositoryFactory = require("../repositories");
  const dbType = process.env.DB_TYPE || "postgres"; // Use environment variable for dbType
  
  const type = "request";
  
  async function runSavedQueryService(queryName, requestBody) {
    const type = "request"; // Define a default or specific type here
    const repository = repositoryFactory.getRepository(dbType, type);
    return await repository.dynamicReports(queryName, requestBody);
  }
  async function createSavedQueryService(payload) {
    const type = "request"; // Define a default or specific type here
    const repository = repositoryFactory.getRepository(dbType, type);
    return await repository.saveQuery(payload);
  }
  module.exports = {
    runSavedQueryService,
    createSavedQueryService
  }