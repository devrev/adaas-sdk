const { workerData } = require('node:worker_threads');

require('ts-node/register');

const { Logger } = require('./logger');
const { runWithUserLogContext } = require('./logger.context');

// eslint-disable-next-line no-global-assign
console = new Logger({ event: workerData.event, options: workerData.options });

const runner =
  workerData.mode === 'sdk' ? (fn) => fn() : runWithUserLogContext;

runner(() => {
  console.log(workerData.message);
});
