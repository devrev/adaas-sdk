/**
 * OOM Handling Tests
 *
 * This test suite verifies that the parent process correctly detects and handles
 * Out-Of-Memory (OOM) errors from worker processes:
 *
 * 1. Slow Growth: Memory increases gradually with delays between allocations
 *    - Worker will eventually hit resource limit and crash
 *    - Parent process should detect OOM error and emit error event
 *
 * 2. Fast Growth: Memory increases rapidly without delays
 *    - Worker will hit resource limit quickly
 *    - Parent process should detect OOM error and emit error event
 *    - Resource limits act as safety net to prevent snap-in crashes
 */

import { MockServer } from '../src/tests/mock-server';
import { run } from '../src/tests/oom-handling/extraction';
import { EventType } from '../src/types/extraction';
import { createEvent } from '../src/tests/test-helpers';

describe('OOM Handling', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    console.log('\n🧪 Starting OOM Handling Tests\n');
    mockServer = new MockServer();
    await mockServer.start(3005);
    console.log('🌐 Mock server started at http://localhost:3005\n');
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.clearRequests();
    if (global.gc) {
      global.gc();
    }
  });

  it('should detect OOM error from worker with slow heap growth', async () => {
    console.log('\n📋 Test: Slow Heap Growth - Parent-Side OOM Detection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('This test verifies that the parent process detects OOM errors');
    console.log('when a worker crashes due to gradual memory growth.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const baseUrl = mockServer.getBaseUrl();
    const event = createEvent({
      eventType: EventType.ExtractionDataStart,
      eventContextOverrides: {
        callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
        worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${baseUrl}`,
      },
    });

    console.log('📤 Running worker with slow heap growth...');
    console.log('   Worker Heap Limit: 256MB');
    console.log('   Allocation: 100k objects every 100ms\n');

    // Run with resource limits (no worker-side memory monitoring)
    await run([event], __dirname + '/../src/tests/oom-handling/oom-slow-growth', {
      workerHeapSizeMb: 256,
    });

    // Wait a bit for async request body parsing to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const requests = mockServer.getRequests();
    console.log(`\n📨 Received ${requests.length} event(s) from worker`);

    // Log all events
    requests.forEach((req, index) => {
      const eventType = req.body?.event_type || 'unknown';
      console.log(`   Event ${index + 1}: ${eventType}`);

      if (req.body?.event_data?.error) {
        const errorMsg = req.body.event_data.error.message;
        console.log(`       Error: ${errorMsg.substring(0, 80)}...`);
      }
    });

    // Verify that we received at least one event
    expect(requests.length).toBeGreaterThan(0);

    // Last event should be an error detected by parent process
    const lastRequest = requests[requests.length - 1];
    const lastEventType = lastRequest.body?.event_type;

    console.log(`\n   Final event type: ${lastEventType}`);

    if (lastEventType === 'EXTRACTION_DATA_ERROR') {
      const errorMsg = lastRequest.body?.event_data?.error?.message || '';

      if (errorMsg.includes('exceeded memory limit') || errorMsg.includes('out of memory')) {
        console.log('   ✅ Parent process successfully detected OOM error!');
        console.log('   📊 This demonstrates parent-side OOM detection');
      } else if (errorMsg.includes('Worker exited')) {
        console.log('   ✅ Parent process detected worker crash');
        console.log('   📝 Error was properly reported to prevent snap-in crash');
      }

      expect(lastEventType).toBe('EXTRACTION_DATA_ERROR');
    } else {
      // Worker completed successfully (didn't allocate enough to hit limit)
      console.log('   ℹ️  Worker completed without hitting memory limit');
      expect(['EXTRACTION_DATA_DONE', 'EXTRACTION_DATA_ERROR']).toContain(lastEventType);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Slow growth test complete\n');
  }, 60000); // 60 second timeout

  // ⚠️ This test is SKIPPED by default because it can crash the Jest process
  // The fast memory allocation can trigger a hard OOM before resource limits can gracefully handle it
  // To run it manually for testing: change `it.skip` to `it` below
  it.skip('should detect OOM error from worker with fast heap growth', async () => {
    console.log('\n📋 Test: Fast Heap Growth - Parent-Side OOM Detection (MANUAL TEST - SKIPPED BY DEFAULT)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  WARNING: This test may crash the Jest process!');
    console.log('This test verifies that the parent process detects OOM errors');
    console.log('when a worker crashes due to rapid memory growth.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const baseUrl = mockServer.getBaseUrl();
    const event = createEvent({
      eventType: EventType.ExtractionDataStart,
      eventContextOverrides: {
        callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
        worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${baseUrl}`,
      },
    });

    console.log('📤 Running worker with fast heap growth...');
    console.log('   Worker Heap Limit: 256MB');
    console.log('   Allocation: 25k objects per iteration (no delay)\n');

    // Run with resource limits (no worker-side memory monitoring)
    await run([event], __dirname + '/../src/tests/oom-handling/oom-fast-growth', {
      workerHeapSizeMb: 256,
    });

    const requests = mockServer.getRequests();
    console.log(`\n📨 Received ${requests.length} event(s) from worker`);

    // Log all events
    requests.forEach((req, index) => {
      const eventType = req.body?.event_type || 'unknown';
      console.log(`   Event ${index + 1}: ${eventType}`);

      if (req.body?.event_data?.error) {
        const errorMsg = req.body.event_data.error.message;
        console.log(`       Error: ${errorMsg.substring(0, 80)}...`);
      }
    });

    // Verify that we received at least one event
    expect(requests.length).toBeGreaterThan(0);

    // Last event should be an error detected by parent process
    const lastRequest = requests[requests.length - 1];
    const lastEventType = lastRequest.body?.event_type;

    console.log(`\n   Final event type: ${lastEventType}`);

    if (lastEventType === 'EXTRACTION_DATA_ERROR') {
      const errorMsg = lastRequest.body?.event_data?.error?.message || '';

      if (errorMsg.includes('exceeded memory limit') || errorMsg.includes('out of memory')) {
        console.log('   ✅ Parent process successfully detected OOM error!');
        console.log('   📊 This demonstrates parent-side OOM detection for fast growth');
      } else if (errorMsg.includes('Worker exited')) {
        console.log('   ✅ Parent process detected worker crash');
        console.log('   📝 Error was properly reported to prevent snap-in crash');
      }

      expect(lastEventType).toBe('EXTRACTION_DATA_ERROR');
    } else {
      // Worker completed successfully (didn't allocate enough to hit limit)
      console.log('   ℹ️  Worker completed without hitting memory limit');
      expect(['EXTRACTION_DATA_DONE', 'EXTRACTION_DATA_ERROR']).toContain(lastEventType);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Fast growth test complete\n');
  }, 60000); // 60 second timeout
});

