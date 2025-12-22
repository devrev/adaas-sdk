const { workerData } = require('worker_threads');

require('ts-node').register();

const { Logger } = require('../logger/logger');
 
console = new Logger({ event: workerData.event, options: workerData.options });

require(workerData.workerPath);
