const { workerData } = require('node:worker_threads');

require('ts-node/register');

const { Logger } = require('./logger');
const { runWithUserLogContext } = require('./logger.context');

 
console = new Logger({ event: workerData.event, options: workerData.options });

const runner =
  workerData.mode === 'sdk' ? (fn) => fn() : runWithUserLogContext;

runner(() => {
  console.log(workerData.message);
});
