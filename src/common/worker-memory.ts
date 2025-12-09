import * as os from 'os';

import { WorkerMemoryConfig } from '../types/workers';

/**
 * Constants for memory limit calculation.
 */
export const MEMORY_CONSTANTS = {
  /** Percentage of memory to allocate to worker thread (75-80%) */
  WORKER_MEMORY_PERCENTAGE: 0.75,
  /** Maximum memory cap for local development in MB */
  LOCAL_DEV_MAX_TOTAL_MEMORY_MB: 1024,
  /** Minimum heap size for worker in MB */
  MIN_WORKER_HEAP_SIZE_MB: 128,
  /** Default heap size when unable to determine system memory */
  DEFAULT_WORKER_HEAP_SIZE_MB: 512,
} as const;

/**
 * Detects if the current environment is AWS Lambda.
 * @returns true if running in AWS Lambda
 */
export function isLambdaEnvironment(): boolean {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );
}

/**
 * Gets the AWS Lambda memory limit from environment variable.
 * @returns Lambda memory limit in MB, or null if not in Lambda
 */
export function getLambdaMemoryLimitMb(): number | null {
  const memorySize = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
  if (memorySize) {
    const parsed = parseInt(memorySize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

/**
 * Gets the total available memory based on the environment.
 * For Lambda: Uses AWS_LAMBDA_FUNCTION_MEMORY_SIZE
 * For local development: Caps at LOCAL_DEV_MAX_TOTAL_MEMORY_MB
 *
 * @returns Total available memory in MB
 */
export function getTotalAvailableMemoryMb(): number {
  // For Lambda, use the configured memory limit
  const lambdaMemory = getLambdaMemoryLimitMb();
  if (lambdaMemory) {
    return lambdaMemory;
  }

  // For local development, cap at LOCAL_DEV_MAX_TOTAL_MEMORY_MB
  const systemMemoryMb = os.totalmem() / (1024 * 1024);
  return Math.min(
    systemMemoryMb,
    MEMORY_CONSTANTS.LOCAL_DEV_MAX_TOTAL_MEMORY_MB
  );
}

/**
 * Calculates the worker memory configuration based on the environment.
 *
 * @param isLocalDevelopment - Whether running in local development mode
 * @returns Worker memory configuration
 */
export function calculateWorkerMemoryConfig(
  isLocalDevelopment: boolean = false
): WorkerMemoryConfig {
  const isLambda = isLambdaEnvironment();
  const totalAvailableMemoryMb = getTotalAvailableMemoryMb();
  const workerMemoryPercentage = MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE;

  const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);

  // Calculate worker heap size (75-80% of total available)
  let maxOldGenerationSizeMb = Math.floor(
    (totalAvailableMemoryMb - currentlyUsed) * workerMemoryPercentage
  );

  // Ensure minimum heap size
  maxOldGenerationSizeMb = Math.max(
    maxOldGenerationSizeMb,
    MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
  );

  return {
    maxOldGenerationSizeMb,
    totalAvailableMemoryMb,
    isLambda,
    isLocalDevelopment,
    workerMemoryPercentage,
  };
}

/**
 * Node.js error code for worker thread OOM.
 * @see https://nodejs.org/api/errors.html#err_worker_out_of_memory
 */
export const ERR_WORKER_OUT_OF_MEMORY = 'ERR_WORKER_OUT_OF_MEMORY';

/**
 * Checks if an error indicates an OOM (Out-Of-Memory) error.
 *
 * This function first checks for the Node.js error code `ERR_WORKER_OUT_OF_MEMORY`
 * which is the standard way to detect worker thread OOM errors.
 *
 * @param error - The error to check (has to be an Error object)
 * @returns true if the error indicates OOM
 * @see https://nodejs.org/api/errors.html#err_worker_out_of_memory
 */
export function isOOMError(error: Error | string): boolean {
  // If it's an Error object, check the code property first
  if (error instanceof Error) {
    // Node.js worker thread OOM errors have this code
    if ((error as NodeJS.ErrnoException).code === ERR_WORKER_OUT_OF_MEMORY) {
      return true;
    }
  }

  return false;
}
