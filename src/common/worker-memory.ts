import * as os from 'os';
import * as v8 from 'v8';

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
 * For other environments: Uses system total memory or V8 heap limit
 *
 * @param isLocalDevelopment - Whether running in local development mode
 * @returns Total available memory in MB
 */
export function getTotalAvailableMemoryMb(isLocalDevelopment: boolean): number {
  // For Lambda, use the configured memory limit
  const lambdaMemory = getLambdaMemoryLimitMb();
  if (lambdaMemory !== null) {
    return lambdaMemory;
  }

  // For local development, cap at LOCAL_DEV_MAX_TOTAL_MEMORY_MB
  if (isLocalDevelopment) {
    const systemMemoryMb = os.totalmem() / (1024 * 1024);
    return Math.min(
      systemMemoryMb,
      MEMORY_CONSTANTS.LOCAL_DEV_MAX_TOTAL_MEMORY_MB
    );
  }

  // For other environments, use the smaller of system memory or V8 heap limit
  const systemMemoryMb = os.totalmem() / (1024 * 1024);
  const heapStats = v8.getHeapStatistics();
  const heapLimitMb = heapStats.heap_size_limit / (1024 * 1024);

  return Math.min(systemMemoryMb, heapLimitMb);
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
  const totalAvailableMemoryMb = getTotalAvailableMemoryMb(isLocalDevelopment);
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
 * Regex patterns to detect OOM errors from error messages.
 * Used as a fallback when the error code is not available.
 */
const OOM_MESSAGE_PATTERNS = [
  /JavaScript heap out of memory/i,
  /JS heap out of memory/i,
  /FATAL ERROR: .* out of memory/i,
  /Allocation failed - JavaScript heap out of memory/i,
  /FATAL ERROR: Reached heap limit/i,
  /FATAL ERROR: CALL_AND_RETRY_LAST/i,
  /memory allocation failed/i,
  /Worker terminated due to reaching memory limit/i,
];

/**
 * Checks if an error indicates an OOM (Out-Of-Memory) error.
 *
 * This function first checks for the Node.js error code `ERR_WORKER_OUT_OF_MEMORY`
 * which is the standard way to detect worker thread OOM errors.
 * Falls back to regex pattern matching on the error message for other OOM scenarios.
 *
 * @param error - The error to check (can be an Error object or string message)
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
    // Fall back to checking the message
    return OOM_MESSAGE_PATTERNS.some((pattern) => pattern.test(error.message));
  }

  // If it's a string, check against patterns (including the error code as a string)
  if (typeof error === 'string') {
    // Check if the string contains the error code
    if (error.includes(ERR_WORKER_OUT_OF_MEMORY)) {
      return true;
    }
    return OOM_MESSAGE_PATTERNS.some((pattern) => pattern.test(error));
  }

  return false;
}
