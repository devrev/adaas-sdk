import {
  calculateWorkerMemoryConfig,
  getLambdaMemoryLimitMb,
  getTotalAvailableMemoryMb,
  isLambdaEnvironment,
  isOOMError,
  MEMORY_CONSTANTS,
} from '../../common/worker-memory';

describe('worker-memory utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isLambdaEnvironment', () => {
    it('should return false when not in Lambda', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.AWS_EXECUTION_ENV;
      delete process.env.LAMBDA_TASK_ROOT;

      expect(isLambdaEnvironment()).toBe(false);
    });

    it('should return true when AWS_LAMBDA_FUNCTION_NAME is set', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      expect(isLambdaEnvironment()).toBe(true);
    });

    it('should return true when AWS_EXECUTION_ENV is set', () => {
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';

      expect(isLambdaEnvironment()).toBe(true);
    });

    it('should return true when LAMBDA_TASK_ROOT is set', () => {
      process.env.LAMBDA_TASK_ROOT = '/var/task';

      expect(isLambdaEnvironment()).toBe(true);
    });
  });

  describe('getLambdaMemoryLimitMb', () => {
    it('should return null when not in Lambda', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;

      expect(getLambdaMemoryLimitMb()).toBeNull();
    });

    it('should return memory limit when AWS_LAMBDA_FUNCTION_MEMORY_SIZE is set', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1024';

      expect(getLambdaMemoryLimitMb()).toBe(1024);
    });

    it('should return null for invalid memory size', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = 'invalid';

      expect(getLambdaMemoryLimitMb()).toBeNull();
    });
  });

  describe('getTotalAvailableMemoryMb', () => {
    it('should use Lambda memory when in Lambda environment', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '2048';

      const result = getTotalAvailableMemoryMb(false);

      expect(result).toBe(2048);
    });

    it('should cap at LOCAL_DEV_MAX_TOTAL_MEMORY_MB for local development', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;

      const result = getTotalAvailableMemoryMb(true);

      expect(result).toBeLessThanOrEqual(
        MEMORY_CONSTANTS.LOCAL_DEV_MAX_TOTAL_MEMORY_MB
      );
    });
  });

  describe('calculateWorkerMemoryConfig', () => {
    it('should calculate memory config for local development', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;

      const config = calculateWorkerMemoryConfig(true);

      expect(config.isLocalDevelopment).toBe(true);
      expect(config.isLambda).toBe(false);
      expect(config.workerMemoryPercentage).toBe(
        MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE
      );
      expect(config.maxOldGenerationSizeMb).toBeGreaterThanOrEqual(
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      // For local dev, should be capped
      expect(config.totalAvailableMemoryMb).toBeLessThanOrEqual(
        MEMORY_CONSTANTS.LOCAL_DEV_MAX_TOTAL_MEMORY_MB
      );
    });

    it('should calculate memory config for Lambda environment', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1024';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.isLambda).toBe(true);
      expect(config.totalAvailableMemoryMb).toBe(1024);
      // Worker should get 75% of Lambda memory
      expect(config.maxOldGenerationSizeMb).toBe(
        Math.floor(1024 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE)
      );
    });
  });

  describe('isOOMError', () => {
    it('should detect JavaScript heap out of memory', () => {
      expect(isOOMError('JavaScript heap out of memory')).toBe(true);
      expect(isOOMError('FATAL ERROR: JavaScript heap out of memory')).toBe(
        true
      );
    });

    it('should detect allocation failed errors', () => {
      expect(
        isOOMError('Allocation failed - JavaScript heap out of memory')
      ).toBe(true);
    });

    it('should detect heap limit errors', () => {
      expect(isOOMError('FATAL ERROR: Reached heap limit')).toBe(true);
    });

    it('should detect CALL_AND_RETRY_LAST errors', () => {
      expect(isOOMError('FATAL ERROR: CALL_AND_RETRY_LAST')).toBe(true);
    });

    it('should return false for non-OOM errors', () => {
      expect(isOOMError('Connection timeout')).toBe(false);
      expect(isOOMError('File not found')).toBe(false);
      expect(isOOMError('Permission denied')).toBe(false);
    });
  });
});

