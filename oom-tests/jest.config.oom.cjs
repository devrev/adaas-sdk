module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/oom-tests/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/oom-tests/tsconfig.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/oom-tests/jest.setup.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',
  collectCoverage: false,
  verbose: true,
  detectOpenHandles: true,
};
