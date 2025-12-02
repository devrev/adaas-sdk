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
    return Math.min(systemMemoryMb, MEMORY_CONSTANTS.LOCAL_DEV_MAX_TOTAL_MEMORY_MB);
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

  // Calculate worker heap size (75-80% of total available)
  let maxOldGenerationSizeMb = Math.floor(
    totalAvailableMemoryMb * workerMemoryPercentage
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
 * Checks if an error message indicates an OOM (Out-Of-Memory) error.
 * @param errorMessage - The error message to check
 * @returns true if the error indicates OOM
 */
export function isOOMError(errorMessage: string): boolean {
  const oomPatterns = [
    /JavaScript heap out of memory/i,
    /JS heap out of memory/i,
    /FATAL ERROR: .* out of memory/i,
    /Allocation failed - JavaScript heap out of memory/i,
    /FATAL ERROR: Reached heap limit/i,
    /FATAL ERROR: CALL_AND_RETRY_LAST/i,
    /memory allocation failed/i,
    /Worker terminated due to reaching memory limit/i,
    /ERR_WORKER_OUT_OF_MEMORY/i,
  ];

  return oomPatterns.some((pattern) => pattern.test(errorMessage));
}

