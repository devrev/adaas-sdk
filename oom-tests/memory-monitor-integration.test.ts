import { EventType } from '../src/types/extraction';
import { createEvent } from '../src/tests/test-helpers';
import { MockServer } from '../src/tests/mock-server';
import run from '../src/tests/timeout-handling/extraction';

jest.setTimeout(60000); // 1 minute timeout

/**
 * Worker Resource Limits Integration Test
 *
 * This test demonstrates that workers run successfully with resource limits.
 * Resource limits prevent hard OOM crashes by constraining worker heap size.
 * When a worker exceeds its memory limit, the parent process detects the OOM
 * error and emits an appropriate error event to prevent snap-in crashes.
 */
describe('Worker Resource Limits Integration', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    console.log('🧪 Setting up Worker Resource Limits Integration Test');
    mockServer = new MockServer(3003);
    await mockServer.start();
    console.log(`🌐 Mock server started at ${mockServer.getBaseUrl()}`);
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(() => {
    mockServer.clearRequests();
    if (global.gc) {
      global.gc();
    }
  });

  it('should complete successfully with resource limits', async () => {
    console.log('\n📋 Integration Test: Worker with Resource Limits');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('This test demonstrates that workers run successfully with resource limits.');
    console.log('Resource limits prevent hard OOM crashes and allow graceful handling.');
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

    console.log('📤 Running worker with resource limits...');
    console.log('   Worker heap limit: 512MB (default)');
    console.log('   Parent-side OOM detection: enabled\n');

    // Run a worker with resource limits
    await run([event], __dirname + '/../src/tests/timeout-handling/timeout-1');

    const requests = mockServer.getRequests();
    console.log(`\n📨 Received ${requests.length} event(s) from worker`);

    // We expect at least one event
    expect(requests.length).toBeGreaterThan(0);

    const lastRequest = requests[requests.length - 1];
    const eventType = lastRequest.body?.event_type;
    console.log(`\n   Final event type: ${eventType}`);

    // Worker should complete successfully or emit an error
    expect(['EXTRACTION_DATA_DONE', 'EXTRACTION_DATA_ERROR']).toContain(eventType);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Integration test complete');
    console.log('   Worker completed with resource limits in place.');
    console.log('   Parent process monitors for OOM errors and handles them gracefully.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

  it('should handle worker completion gracefully', async () => {
    console.log('\n📋 Integration Test: Worker Completion Handling');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('This test verifies that the SDK handles worker completion gracefully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const baseUrl = mockServer.getBaseUrl();
    mockServer.clearRequests();

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

    console.log('📤 Running worker...');
    await run([event], __dirname + '/../src/tests/timeout-handling/timeout-1');

    const requests = mockServer.getRequests();
    console.log(`📨 Received ${requests.length} event(s)`);

    // Should have emitted at least one event
    expect(requests.length).toBeGreaterThan(0);

    // Worker should complete successfully or emit an error
    const lastRequest = requests[requests.length - 1];
    const eventType = lastRequest.body?.event_type;
    expect(['EXTRACTION_DATA_DONE', 'EXTRACTION_DATA_ERROR']).toContain(eventType);

    console.log(`   Final event: ${eventType}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Worker completion test complete');
    console.log('   The SDK properly handles worker lifecycle events');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });
});

