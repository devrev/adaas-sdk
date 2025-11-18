const { workerData } = require('worker_threads');

require('ts-node').register();

const { Logger } = require('../logger/logger');
const { runWithUserLogContext } = require('../logger/logger.context');

// eslint-disable-next-line no-global-assign
console = new Logger({ event: workerData.event, options: workerData.options });

runWithUserLogContext(() => {
  require(workerData.workerPath);
});
