module.exports = {
  testPathIgnorePatterns: ['./dist/'],
  projects: [
    {
      displayName: 'default',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: [
        'backwards-compatibility.test.ts',
        // Timeout hanlding is its own project
        'src/tests/timeout-handling/.*.ts',
        // These tests are slow (10-15s per)
        'src/tests/dummy-connector/metadata-extraction.test.ts',
        'src/http/axios-client-internal.test.ts',
        'src/tests/event-data-size-limit/.*.test.ts',
      ],
    },
    {
      displayName: 'backwards-compatibility',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/tests/backwards-compatibility/**/*.test.ts'],
      setupFiles: ['<rootDir>/src/tests/backwards-compatibility/jest.setup.ts'],
    },
    {
      displayName: 'timeout-handling',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/tests/timeout-handling/**/*.test.ts'],
    },
    {
      displayName: 'slow',
      preset: 'ts-jest',
      testMatch: [
        '<rootDir>/src/tests/dummy-connector/metadata-extraction.test.ts',
        '<rootDir>/src/http/axios-client-internal.test.ts',
        '<rootDir>/src/tests/event-data-size-limit/size-limit-1.test.ts',
      ],
    },
  ],
};
