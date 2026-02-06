const repositoryFactory = require("../repositories");
const dbTypeFolder = process.env.DB_TYPE || "postgres"; // Use environment variable for dbType

const fileName = "institution";

async function createInstitutionService(payload) {
  const repository = repositoryFactory.getRepository(dbTypeFolder,fileName);
  return await repository.createInstitution(payload);
}

async function viewInstitutionService() {
  const repository = repositoryFactory.getRepository(dbTypeFolder,fileName);
  return await repository.viewInstitution();
}

async function updateInstitutionService(payload,id) {
  const repository = repositoryFactory.getRepository(dbTypeFolder, fileName);
  return await repository.updateInstitution(payload,id);
}




module.exports = {
  createInstitutionService,
  viewInstitutionService,
  updateInstitutionService,
};
