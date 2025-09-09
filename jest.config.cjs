module.exports = {
  testPathIgnorePatterns: ['./dist/'],
  projects: [
    {
      displayName: 'default',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: ['backwards-compatibility.test.ts'],
    },
    {
      displayName: 'backwards-compatibility',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/tests/backwards-compatibility/**/*.test.ts'],
      setupFiles: ['<rootDir>/src/tests/backwards-compatibility/jest.setup.ts'],
    },
  ],
};
