const { workerData } = require('worker_threads');

require('ts-node').register();

const { Logger } = require('../logger/logger');
// eslint-disable-next-line no-global-assign
console = new Logger({ event: workerData.event, options: workerData.options });

require(workerData.workerPath);
