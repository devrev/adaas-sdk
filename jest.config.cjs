module.exports = {
  testPathIgnorePatterns: ['./dist/'],
  // Limit worker memory to prevent Jest from accumulating memory across tests
  workerIdleMemoryLimit: '512MB',
  projects: [
    {
      displayName: 'default',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      // Exclude OOM tests from default project - they need special handling
      testPathIgnorePatterns: [
        'backwards-compatibility.test.ts',
        'oom-handling.test.ts',
      ],
    },
    {
      displayName: 'oom-tests',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/tests/oom-handling/oom-handling.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/oom-handling/jest.setup.ts'],
      // OOM tests need isolation - run in separate workers that get recycled
      maxWorkers: 1,
    },
    {
      displayName: 'backwards-compatibility',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/tests/backwards-compatibility/**/*.test.ts'],
      setupFiles: ['<rootDir>/src/tests/backwards-compatibility/jest.setup.ts'],
    },
  ],
};
