module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Set the root directory to the project root
  rootDir: '..',
  
  // Test patterns - include both OOM integration tests and unit tests
  testMatch: [
    '**/oom-tests/**/*.test.ts',
    '**/oom-tests/**/*.spec.ts',
    '**/src/common/__tests__/memory-monitor.test.ts'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    './dist/',
    './node_modules/'
  ],
  
  // Module paths
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform settings
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        lib: ['es2020'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true
      }
    }]
  },
  
  // Test setup
  setupFilesAfterEnv: ['<rootDir>/oom-tests/jest.setup.ts'],
  
  // Timeout settings - OOM tests may take longer
  testTimeout: 120000, // 2 minutes per test
  
  // Memory and performance settings
  maxWorkers: 1, // Run tests sequentially to avoid memory conflicts
  workerIdleMemoryLimit: '512MB',
  
  // Coverage settings
  collectCoverage: false, // Disable coverage for OOM tests
  
  // Verbose output for debugging
  verbose: true,
  
  // Detect open handles (useful for OOM debugging)
  detectOpenHandles: true,
  forceExit: true,
  
  // Reporter configuration
  reporters: ['default']
};

