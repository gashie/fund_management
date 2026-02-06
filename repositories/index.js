const fs = require('fs');
const path = require('path');
const EXPECTED_FUNCTIONS = require('./interface');

function validateModule(module, moduleName) {
    const requiredFunctions = EXPECTED_FUNCTIONS[moduleName] || [];
    
    requiredFunctions.forEach(fn => {
        if (typeof module[fn] !== 'function') {
            throw new Error(`Module "${moduleName}" is missing required function: ${fn}`);
        }
    });
}

function loadRepositoryModules(dbType) {
    const repositoryPath = path.join(__dirname, dbType);
    const repository = {};

    fs.readdirSync(repositoryPath).forEach(file => {
        if (file.endsWith('.js')) {
            const moduleName = path.basename(file, '.js');
            const module = require(path.join(repositoryPath, file));

            // Validate each module based on its specific requirements
            validateModule(module, moduleName);

            // Add to repository collection
            repository[moduleName] = module;
        }
    });

    return repository;
}

function getRepository(dbType, type) {
    const repositories = loadRepositoryModules(dbType);
    const selectedRepository = repositories[type];

    if (!selectedRepository) {
        throw new Error(`Repository type "${type}" not found in "${dbType}"`);
    }

    return selectedRepository;
}

module.exports = { getRepository };
