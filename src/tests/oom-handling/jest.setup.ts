/**
 * Jest setup file for OOM handling tests.
 *
 * These tests intentionally trigger out-of-memory conditions to test
 * OOM detection and handling. This setup ensures proper cleanup between tests.
 */

// Force garbage collection between tests if available
// This helps prevent memory accumulation across test cases
afterEach(() => {
  // Clear any module caches that might retain memory
  jest.clearAllMocks();
  jest.resetModules();
  
  // Force garbage collection if available (Node.js must be run with --expose-gc)
  if (global.gc) {
    global.gc();
  }
});

afterAll(() => {
  // Final cleanup after all OOM tests complete
  jest.clearAllMocks();
  jest.resetModules();
  
  if (global.gc) {
    global.gc();
  }
});

