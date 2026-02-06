const EventEmitter = require("events");

class GlobalEventEmitter extends EventEmitter {}
const globalEventEmitter = new GlobalEventEmitter();

// Optional: Set max listeners to avoid warnings
globalEventEmitter.setMaxListeners(20);

module.exports = globalEventEmitter;
