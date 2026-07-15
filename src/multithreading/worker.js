const { workerData } = require('node:worker_threads');

require('ts-node').register();

const { Logger, runWithUserLogContext } = require('../logger/logger');

console = new Logger({ event: workerData.event, options: workerData.options });

runWithUserLogContext(() => {
  require(workerData.workerPath);
});
