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

    it('should detect ERR_WORKER_OUT_OF_MEMORY error code', () => {
      expect(isOOMError('ERR_WORKER_OUT_OF_MEMORY')).toBe(true);
      expect(isOOMError('Error [ERR_WORKER_OUT_OF_MEMORY]: Worker terminated due to reaching memory limit')).toBe(true);
    });

    it('should detect Worker terminated due to reaching memory limit', () => {
      expect(isOOMError('Worker terminated due to reaching memory limit')).toBe(true);
      expect(isOOMError('Worker terminated due to reaching memory limit: JavaScript heap out of memory')).toBe(true);
    });

    it('should detect JS heap out of memory (abbreviated)', () => {
      expect(isOOMError('JS heap out of memory')).toBe(true);
      expect(isOOMError('FATAL ERROR: JS heap out of memory')).toBe(true);
    });

    it('should detect memory allocation failed', () => {
      expect(isOOMError('memory allocation failed')).toBe(true);
      expect(isOOMError('Error: memory allocation failed during processing')).toBe(true);
    });

    it('should return false for non-OOM errors', () => {
      expect(isOOMError('Connection timeout')).toBe(false);
      expect(isOOMError('File not found')).toBe(false);
      expect(isOOMError('Permission denied')).toBe(false);
      expect(isOOMError('ENOENT: no such file or directory')).toBe(false);
      expect(isOOMError('ECONNREFUSED')).toBe(false);
      expect(isOOMError('TypeError: undefined is not a function')).toBe(false);
    });

    it('should handle empty and undefined-like inputs', () => {
      expect(isOOMError('')).toBe(false);
      expect(isOOMError('   ')).toBe(false);
      expect(isOOMError('null')).toBe(false);
      expect(isOOMError('undefined')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isOOMError('JAVASCRIPT HEAP OUT OF MEMORY')).toBe(true);
      expect(isOOMError('javascript heap out of memory')).toBe(true);
      expect(isOOMError('JavaScript Heap Out Of Memory')).toBe(true);
    });
  });

  describe('edge cases for memory calculations', () => {
    it('should handle very low Lambda memory (128MB)', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '128';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.isLambda).toBe(true);
      expect(config.totalAvailableMemoryMb).toBe(128);
      // Worker should get 75% of 128MB = 96MB, but MIN is 128MB
      expect(config.maxOldGenerationSizeMb).toBe(
        Math.max(
          Math.floor(128 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
          MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
        )
      );
    });

    it('should enforce MIN_WORKER_HEAP_SIZE_MB when calculated value is too low', () => {
      // Simulate a very low memory environment
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '64';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const config = calculateWorkerMemoryConfig(false);

      // 64MB * 0.75 = 48MB, which is below MIN_WORKER_HEAP_SIZE_MB (128MB)
      expect(config.maxOldGenerationSizeMb).toBe(
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
    });

    it('should handle zero memory size gracefully', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '0';

      const result = getLambdaMemoryLimitMb();

      // 0 is not > 0, so should return null
      expect(result).toBeNull();
    });

    it('should handle negative memory size gracefully', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '-512';

      const result = getLambdaMemoryLimitMb();

      // Negative is not > 0, so should return null
      expect(result).toBeNull();
    });

    it('should handle very large Lambda memory (10240MB)', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '10240';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.isLambda).toBe(true);
      expect(config.totalAvailableMemoryMb).toBe(10240);
      // Worker should get 75% of 10240MB = 7680MB
      expect(config.maxOldGenerationSizeMb).toBe(
        Math.floor(10240 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE)
      );
    });

    it('should handle floating point memory size', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1024.5';

      const result = getLambdaMemoryLimitMb();

      // parseInt should truncate to 1024
      expect(result).toBe(1024);
    });

    it('should handle memory size with leading zeros', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '00512';

      const result = getLambdaMemoryLimitMb();

      expect(result).toBe(512);
    });

    it('should handle memory size with whitespace', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = ' 1024 ';

      const result = getLambdaMemoryLimitMb();

      // parseInt handles leading whitespace
      expect(result).toBe(1024);
    });

    it('should return null for empty string memory size', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '';

      const result = getLambdaMemoryLimitMb();

      expect(result).toBeNull();
    });
  });

  describe('Lambda environment simulation', () => {
    it('should correctly detect Lambda environment with all env vars set', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function';
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
      process.env.LAMBDA_TASK_ROOT = '/var/task';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '512';

      expect(isLambdaEnvironment()).toBe(true);
      expect(getLambdaMemoryLimitMb()).toBe(512);

      const config = calculateWorkerMemoryConfig(false);
      expect(config.isLambda).toBe(true);
      expect(config.isLocalDevelopment).toBe(false);
      expect(config.totalAvailableMemoryMb).toBe(512);
    });

    it('should calculate correct worker memory for Lambda 256MB', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-256';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '256';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.totalAvailableMemoryMb).toBe(256);
      // 256 * 0.75 = 192MB for worker, but MIN is 128MB
      const expectedWorkerMemory = Math.max(
        Math.floor(256 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedWorkerMemory);
    });

    it('should calculate correct worker memory for Lambda 512MB', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-512';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '512';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.totalAvailableMemoryMb).toBe(512);
      // 512 * 0.75 = 384MB for worker
      expect(config.maxOldGenerationSizeMb).toBe(
        Math.floor(512 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE)
      );
    });

    it('should calculate correct worker memory for Lambda 1024MB', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-1024';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1024';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.totalAvailableMemoryMb).toBe(1024);
      // 1024 * 0.75 = 768MB for worker
      expect(config.maxOldGenerationSizeMb).toBe(
        Math.floor(1024 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE)
      );
    });

    it('should calculate correct worker memory for Lambda 3008MB (max)', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-3008';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '3008';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.totalAvailableMemoryMb).toBe(3008);
      // 3008 * 0.75 = 2256MB for worker
      expect(config.maxOldGenerationSizeMb).toBe(
        Math.floor(3008 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE)
      );
    });

    it('should use local dev memory cap even when Lambda env vars are not set', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.AWS_EXECUTION_ENV;
      delete process.env.LAMBDA_TASK_ROOT;
      delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;

      const config = calculateWorkerMemoryConfig(true); // isLocalDevelopment = true

      expect(config.isLambda).toBe(false);
      expect(config.isLocalDevelopment).toBe(true);
      expect(config.totalAvailableMemoryMb).toBeLessThanOrEqual(
        MEMORY_CONSTANTS.LOCAL_DEV_MAX_TOTAL_MEMORY_MB
      );
    });

    it('should prefer Lambda memory over local dev cap when in Lambda', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '2048';

      // Even with isLocalDevelopment=true, Lambda memory should be used
      // because getLambdaMemoryLimitMb() returns a value
      const config = calculateWorkerMemoryConfig(true);

      expect(config.totalAvailableMemoryMb).toBe(2048);
      expect(config.isLambda).toBe(true);
    });
  });

  describe('memory percentage allocation', () => {
    it('should allocate WORKER_MEMORY_PERCENTAGE to worker', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1000';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.workerMemoryPercentage).toBe(
        MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE
      );
      expect(config.maxOldGenerationSizeMb).toBe(
        Math.floor(1000 * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE)
      );
    });

    it('should leave ~25% for parent thread', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1000';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test';

      const config = calculateWorkerMemoryConfig(false);

      const parentMemory = config.totalAvailableMemoryMb - config.maxOldGenerationSizeMb;
      const parentPercentage = parentMemory / config.totalAvailableMemoryMb;

      // Parent should get approximately 25% (1 - 0.75)
      expect(parentPercentage).toBeCloseTo(1 - MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE, 2);
    });
  });
});

