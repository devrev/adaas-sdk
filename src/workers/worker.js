const { workerData } = require('worker_threads');

require('ts-node').register();

// Override console with Logger instance
const { Logger } = require('../logger/logger');

// eslint-disable-next-line no-global-assign
console = new Logger({ event: workerData.event, options: workerData.options });

// Now load the actual worker with console already overridden
require(workerData.workerPath);
