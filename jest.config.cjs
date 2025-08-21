module.exports = {
  preset: 'ts-jest',
  testPathIgnorePatterns: [
    './dist/',
    // Exclude timeout tests by default - they should only run with test:full or test:cov
    './src/tests/timeout-handling/'
  ],
};