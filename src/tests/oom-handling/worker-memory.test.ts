import {
  calculateWorkerMemoryConfig,
  ERR_WORKER_OUT_OF_MEMORY,
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

      const result = getTotalAvailableMemoryMb();

      expect(result).toBe(2048);
    });

    it('should cap at LOCAL_DEV_MAX_TOTAL_MEMORY_MB for local development', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;

      const result = getTotalAvailableMemoryMb();

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
      const MEMORY_AVAILABLE_MB = 2048;
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = ""+MEMORY_AVAILABLE_MB;
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.isLambda).toBe(true);
      expect(config.totalAvailableMemoryMb).toBe(MEMORY_AVAILABLE_MB);
      // Worker should get 75% of (Lambda memory - currently used memory)
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const expectedMaxHeap = Math.max(
        Math.floor((MEMORY_AVAILABLE_MB - currentlyUsed) * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedMaxHeap);
    });
  });

  describe('isOOMError', () => {
    describe('with Error objects', () => {
      it('should detect ERR_WORKER_OUT_OF_MEMORY error code on Error object', () => {
        const error = new Error(
          'Worker terminated due to reaching memory limit'
        ) as NodeJS.ErrnoException;
        error.code = ERR_WORKER_OUT_OF_MEMORY;

        expect(isOOMError(error)).toBe(true);
      });

      it('should return false for non-OOM Error objects', () => {
        const error = new Error('Connection timeout') as NodeJS.ErrnoException;
        error.code = 'ECONNREFUSED';

        expect(isOOMError(error)).toBe(false);
      });
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
      // Worker should get 75% of (10240MB - currently used memory)
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const expectedMaxHeap = Math.max(
        Math.floor((10240 - currentlyUsed) * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedMaxHeap);
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
      // Worker gets 75% of (256MB - currently used memory), but MIN is 128MB
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const expectedWorkerMemory = Math.max(
        Math.floor((256 - currentlyUsed) * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedWorkerMemory);
    });

    it('should calculate correct worker memory for Lambda 512MB', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-512';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '512';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.totalAvailableMemoryMb).toBe(512);
      // Worker gets 75% of (512MB - currently used memory)
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const expectedMaxHeap = Math.max(
        Math.floor((512 - currentlyUsed) * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedMaxHeap);
    });

    it('should calculate correct worker memory for Lambda 1024MB', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-1024';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1024';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.totalAvailableMemoryMb).toBe(1024);
      // Worker gets 75% of (1024MB - currently used memory)
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const expectedMaxHeap = Math.max(
        Math.floor((1024 - currentlyUsed) * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedMaxHeap);
    });

    it('should calculate correct worker memory for Lambda 3008MB (max)', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-3008';
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '3008';

      const config = calculateWorkerMemoryConfig(false);

      expect(config.totalAvailableMemoryMb).toBe(3008);
      // Worker gets 75% of (3008MB - currently used memory)
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const expectedMaxHeap = Math.max(
        Math.floor((3008 - currentlyUsed) * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedMaxHeap);
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
      // Worker gets 75% of (1000MB - currently used memory)
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const expectedMaxHeap = Math.max(
        Math.floor((1000 - currentlyUsed) * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedMaxHeap);
    });

    it('should leave memory for parent thread including currently used', () => {
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = '1000';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test';

      const config = calculateWorkerMemoryConfig(false);
      const currentlyUsed = process.memoryUsage().rss / (1024 * 1024);
      const availableAfterCurrent = config.totalAvailableMemoryMb - currentlyUsed;

      // Worker should get 75% of remaining memory after current usage is subtracted
      const expectedWorkerMemory = Math.max(
        Math.floor(availableAfterCurrent * MEMORY_CONSTANTS.WORKER_MEMORY_PERCENTAGE),
        MEMORY_CONSTANTS.MIN_WORKER_HEAP_SIZE_MB
      );
      expect(config.maxOldGenerationSizeMb).toBe(expectedWorkerMemory);

      // Parent gets: currently used memory + 25% of remaining
      const parentMemory =
        config.totalAvailableMemoryMb - config.maxOldGenerationSizeMb;
      expect(parentMemory).toBeGreaterThanOrEqual(currentlyUsed);
    });
  });
});
