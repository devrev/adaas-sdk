// Jest setup for OOM tests

// Extend Jest timeout globally for OOM tests
jest.setTimeout(120000); // 2 minutes

// Global test hooks
beforeAll(() => {
  console.log('🧪 Starting OOM Test Suite');
  console.log(`📊 Initial Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
  
  // Enable garbage collection if available
  if (global.gc) {
    console.log('♻️  Garbage collection is available');
    global.gc();
  } else {
    console.log('⚠️  Garbage collection is not available. Run with --expose-gc for better memory management');
  }
});

afterAll(() => {
  console.log(`📊 Final Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log('✅ OOM Test Suite Completed');
  
  // Final cleanup
  if (global.gc) {
    global.gc();
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in OOM Test:', error);
  
  // Log memory usage when exception occurs
  const memUsage = process.memoryUsage();
  console.error(`💾 Memory at exception: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB heap, ${(memUsage.rss / 1024 / 1024).toFixed(1)}MB RSS`);
  
  // Don't exit immediately, let Jest handle it
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection in OOM Test:', reason);
  console.error('Promise:', promise);
  
  // Log memory usage when rejection occurs
  const memUsage = process.memoryUsage();
  console.error(`💾 Memory at rejection: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB heap, ${(memUsage.rss / 1024 / 1024).toFixed(1)}MB RSS`);
});

// Memory monitoring utilities
global.logMemoryUsage = (label: string = 'Memory Usage') => {
  const memUsage = process.memoryUsage();
  console.log(`📊 ${label}:`);
  console.log(`   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   External: ${(memUsage.external / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(1)}MB`);
};

global.forceGC = () => {
  if (global.gc) {
    console.log('♻️  Forcing garbage collection...');
    global.gc();
    console.log(`📊 Memory after GC: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
  } else {
    console.log('⚠️  Garbage collection not available');
  }
};

// TypeScript declarations for global functions
declare global {
  function logMemoryUsage(label?: string): void;
  function forceGC(): void;
  var gc: (() => void) | undefined;
}

