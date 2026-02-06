const fs = require('fs');
const path = require('path');
const globalEventEmitter = require('../utils/eventEmitter');

const eventsPath = __dirname;

fs.readdirSync(eventsPath).forEach((file) => {
    if (file !== 'index.js' && file.endsWith('.js')) {
        require(path.join(eventsPath, file)); // Dynamically import the file
        console.log(`Loaded event listener from: ${file}`);
    }
});
