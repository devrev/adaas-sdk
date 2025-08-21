#!/usr/bin/env ts-node

/**
 * Demo script to show OOM testing capabilities
 * Run with: npx ts-node oom-tests/demo-oom.ts
 */

import { createOOMTestRunner } from './oom-test-helpers';
import { OOMScenario } from './types';

async function runDemo() {
  console.log('🧪 ADaaS SDK OOM Testing Demo');
  console.log('==============================\n');

  const testRunner = createOOMTestRunner();

  try {
    // Demo Scenario 1: Simple Memory Growth
    console.log('📊 Demo 1: Simple Memory Growth');
    const scenario1: OOMScenario = {
      name: 'Demo Memory Growth',
      description: 'Allocate memory gradually to demonstrate monitoring',
      memoryTarget: 50 * 1024 * 1024, // 50MB
      iterations: 100,
      iterationDelay: 50,
      timeoutMs: 30000,
    };

    const result1 = await testRunner.runScenario(scenario1, () => {
      const chunks: Buffer[] = [];
      for (let i = 0; i < 50; i++) {
        // Allocate 1MB chunks
        const chunk = Buffer.alloc(1024 * 1024, `demo-chunk-${i}`);
        chunks.push(chunk);
        
        if (i % 10 === 0) {
          console.log(`  📈 Allocated ${i + 1} chunks, Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
        }
      }
      return { chunksAllocated: chunks.length };
    });

    console.log(`✅ Demo 1 Result: ${result1.completed ? 'Success' : 'Failed'}`);
    console.log(`   Peak Memory: ${(result1.peakMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Duration: ${result1.duration}ms\n`);

    // Demo Scenario 2: Rapid Allocation
    console.log('📊 Demo 2: Rapid Memory Allocation');
    const scenario2: OOMScenario = {
      name: 'Demo Rapid Allocation',
      description: 'Quickly allocate large amounts of memory',
      memoryTarget: 30 * 1024 * 1024, // 30MB
      iterations: 10,
      iterationDelay: 10,
      timeoutMs: 15000,
    };

    const result2 = await testRunner.runScenario(scenario2, () => {
      const largeObjects: any[] = [];
      for (let i = 0; i < 10; i++) {
        // Create 3MB objects rapidly
        const obj = {
          id: i,
          data: new Array(750000).fill(`rapid-data-${i}`), // ~3MB
          timestamp: Date.now(),
        };
        largeObjects.push(obj);
        console.log(`  🚀 Created object ${i + 1}, Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
      }
      return { objectsCreated: largeObjects.length };
    });

    console.log(`✅ Demo 2 Result: ${result2.completed ? 'Success' : 'Failed'}`);
    console.log(`   Peak Memory: ${(result2.peakMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Duration: ${result2.duration}ms\n`);

    // Generate summary report
    const report = testRunner.generateMemoryReport([result1, result2]);
    console.log('📋 Generated Report:');
    console.log('===================');
    console.log(report);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await testRunner.cleanup();
    console.log('\n🧹 Demo cleanup completed');
  }
}

// Run demo if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };

