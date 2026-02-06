const repositoryFactory = require("../repositories");
const dbTypeFolder = process.env.DB_TYPE || "postgres"; // Use environment variable for dbType

async function approvalService(
  payload,
  tableName,
  recordId,
  recordValue,
  userId
) {
  const repository = repositoryFactory.getRepository(dbTypeFolder, "approval");
  return await repository.approveDynamic(
    payload,
    tableName,
    recordId,
    recordValue,
    userId
  );
}

module.exports = {
  approvalService,
};
