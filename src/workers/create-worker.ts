import { isMainThread, Worker, WorkerOptions } from 'node:worker_threads';

import { calculateWorkerMemoryConfig } from '../common/worker-memory';
import {
  WorkerData,
  WorkerEvent,
  WorkerMemoryConfig,
  WorkerResourceLimits,
} from '../types/workers';

/**
 * Result of creating a worker, including memory configuration.
 */
export interface CreateWorkerResult {
  worker: Worker;
  memoryConfig: WorkerMemoryConfig;
  resourceLimits: WorkerResourceLimits;
}

/**
 * Creates a worker thread with optional memory limits.
 * Memory limits are calculated based on the environment:
 * - For Lambda: Uses AWS_LAMBDA_FUNCTION_MEMORY_SIZE (75% for worker)
 * - For local development: Caps total at 1024MB (75% for worker = ~768MB)
 * - For other environments: Uses system memory or V8 heap limit
 *
 * @param workerData - Worker data including event, state, and options
 * @returns Promise resolving to CreateWorkerResult with worker and memory config
 */
async function createWorker<ConnectorState>(
  workerData: WorkerData<ConnectorState>
): Promise<CreateWorkerResult> {
  return new Promise<CreateWorkerResult>((resolve, reject) => {
    if (isMainThread) {
      const workerFile = __dirname + '/worker.js';

      // Calculate memory configuration based on environment
      const isLocalDevelopment =
        workerData.options?.isLocalDevelopment ?? false;
      const enableMemoryLimits =
        workerData.options?.enableMemoryLimits !== false;
      const testMemoryLimitMb = workerData.options?.testMemoryLimitMb;

      const memoryConfig = calculateWorkerMemoryConfig(isLocalDevelopment);

      // Allow test override for memory limit
      const effectiveMemoryLimitMb =
        testMemoryLimitMb ?? memoryConfig.maxOldGenerationSizeMb;

      const resourceLimits: WorkerResourceLimits = {
        maxOldGenerationSizeMb: effectiveMemoryLimitMb,
      };

      // Build worker options
      const workerOptions: WorkerOptions = {
        workerData,
      };

      // Apply resource limits if enabled
      if (enableMemoryLimits) {
        workerOptions.resourceLimits = {
          maxOldGenerationSizeMb: resourceLimits.maxOldGenerationSizeMb,
        };

        console.info(
          `Worker memory limits configured: ` +
            `maxOldGenerationSizeMb=${resourceLimits.maxOldGenerationSizeMb}MB, ` +
            `totalAvailable=${memoryConfig.totalAvailableMemoryMb.toFixed(
              0
            )}MB, ` +
            `isLambda=${memoryConfig.isLambda}, ` +
            `isLocalDevelopment=${memoryConfig.isLocalDevelopment}`
        );
      }

      const worker: Worker = new Worker(workerFile, workerOptions);

      worker.on(WorkerEvent.WorkerError, (error) => {
        console.error('Worker error', error);
        reject(error);
      });
      worker.on(WorkerEvent.WorkerOnline, () => {
        console.info(
          'Worker is online. Started processing the task with event type: ' +
            workerData.event.payload.event_type +
            '.'
        );
        resolve({ worker, memoryConfig, resourceLimits });
      });
    } else {
      reject(new Error('Worker threads can not start more worker threads.'));
    }
  });
}

export { createWorker };
