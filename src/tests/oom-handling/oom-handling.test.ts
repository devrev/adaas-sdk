import { EventType, ExtractorEventType } from '../../types/extraction';
import { MockServer } from '../mock-server';
import { createEvent } from '../test-helpers';
import run from './extraction';

/**
 * OOM Handling Integration Tests
 *
 * These tests verify that the SDK correctly handles out-of-memory (OOM) conditions
 * in worker threads. They intentionally trigger OOM by allocating memory until
 * the worker thread's resource limits are exceeded.
 *
 * IMPORTANT: These tests are SKIPPED in CI environments because:
 * 1. CI containers (especially Docker-based runners like GitHub Actions or `act`)
 *    have strict memory limits that may kill the entire Jest process before
 *    V8's worker thread resource limits trigger an OOM error.
 * 2. V8's `resourceLimits.maxOldGenerationSizeMb` is a soft limit that doesn't
 *    immediately prevent memory allocation - it's enforced when GC runs.
 * 3. The OS OOM killer (or Docker's memory limits) may SIGKILL the process
 *    before the worker thread's OOM handling can be invoked.
 *
 * The OOM detection logic is tested in `worker-memory.test.ts` using unit tests
 * that don't require actual memory exhaustion.
 *
 * To run these tests locally:
 *   npm run test:oom
 *
 * These tests will be skipped when CI=true environment variable is set.
 */

// Detect if running in CI environment
const isCI = process.env.CI === 'true' || process.env.CI === '1';

// Use describe.skip in CI to avoid container memory issues
const describeOrSkip = isCI ? describe.skip : describe;

describeOrSkip('OOM handling', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    mockServer = new MockServer(3010);
    await mockServer.start();
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer.clearRequests();
  });

  describe('basic OOM detection', () => {
    it('should emit error event with OOM details when worker runs out of memory', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      // Run the OOM worker - this should trigger OOM and emit an error event
      await run([event], __dirname + '/oom-worker');

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      // Expect last request to be emission of error event
      expect(lastRequest.url).toContain('airdrop.external-extractor.message');
      expect(lastRequest.method).toBe('POST');

      // The event type should be an error event
      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.DataExtractionError
      );

      // The error should be defined
      expect(lastRequest.body.event_data).toBeDefined();
      expect(lastRequest.body.event_data.error).toBeDefined();
      expect(lastRequest.body.event_data.error.message).toBeDefined();
    }, 120000);

    it('should keep parent thread stable when worker dies from OOM', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      // Run the OOM worker
      await run([event], __dirname + '/oom-worker');

      // If we get here, the parent thread survived
      expect(true).toBe(true);

      // Verify we can still make requests (parent is functional)
      const requests = mockServer.getRequests();
      expect(requests.length).toBeGreaterThan(0);
    }, 120000);
  });

  describe('OOM with alreadyEmitted', () => {
    it('should handle OOM gracefully when worker has done some work before crashing', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      // Run the worker that attempts to emit before causing OOM
      // Use a larger memory limit (256MB) to give the worker time to initialize and emit
      await run([event], __dirname + '/oom-after-emit-worker', {
        testMemoryLimitMb: 256,
      });

      const requests = mockServer.getRequests();

      // Filter for callback requests (event emissions)
      const callbackRequests = requests.filter(
        (r) =>
          r.url.includes('airdrop.external-extractor.message') &&
          r.method === 'POST'
      );

      // Should have at least one event (either progress or error)
      // The key is that the system handles this gracefully without crashing
      expect(callbackRequests.length).toBeGreaterThanOrEqual(1);

      // Check if we got a progress event (worker emitted before OOM)
      const progressRequest = callbackRequests.find(
        (r) => r.body?.event_type === ExtractorEventType.DataExtractionProgress
      );

      // Check if we got an error event (OOM error)
      const errorRequest = callbackRequests.find(
        (r) => r.body?.event_type === ExtractorEventType.DataExtractionError
      );

      // At least one of these should be present
      expect(progressRequest || errorRequest).toBeTruthy();

      // If progress was emitted, verify it's valid
      if (progressRequest) {
        expect(progressRequest.body?.event_context).toBeDefined();
      }

      // If error was emitted, verify it contains error info
      if (errorRequest) {
        expect(errorRequest.body?.event_data?.error).toBeDefined();
      }
    }, 120000);
  });

  describe('gradual memory leak OOM', () => {
    it('should detect OOM from gradual memory consumption', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      await run([event], __dirname + '/oom-gradual-worker');

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      expect(lastRequest.url).toContain('airdrop.external-extractor.message');
      // Gradual OOM may emit progress before error, or error directly
      // Just verify we got some event emitted
      expect(lastRequest.body.event_type).toBeDefined();
    }, 120000);
  });

  describe('OOM with disabled memory limits', () => {
    it('should still function when memory limits are disabled', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      // Run with memory limits disabled - worker won't hit OOM limit
      // but will eventually run out of system memory or hit timeout
      // This test verifies the system doesn't crash when limits are disabled
      await run([event], __dirname + '/oom-worker', {
        enableMemoryLimits: false,
        testMemoryLimitMb: undefined,
      });

      // Parent should still be functional after worker exits
      const requests = mockServer.getRequests();
      expect(requests.length).toBeGreaterThan(0);
    }, 120000);
  });

  describe('OOM for different event types', () => {
    it('should handle OOM during metadata extraction', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingMetadata,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      await run([event], __dirname + '/oom-metadata-worker');

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.MetadataExtractionError
      );
      expect(lastRequest.body.event_data.error).toBeDefined();
      expect(lastRequest.body.event_data.error.message).toBeDefined();
    }, 120000);

    it('should handle OOM during attachments extraction', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingAttachments,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      await run([event], __dirname + '/oom-attachments-worker');

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.AttachmentExtractionError
      );
      expect(lastRequest.body.event_data.error).toBeDefined();
      expect(lastRequest.body.event_data.error.message).toBeDefined();
    }, 120000);

    it('should handle OOM during external sync units extraction', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingExternalSyncUnits,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      await run([event], __dirname + '/oom-external-sync-units-worker');

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.ExternalSyncUnitExtractionError
      );
      expect(lastRequest.body.event_data.error).toBeDefined();
      expect(lastRequest.body.event_data.error.message).toBeDefined();
    }, 120000);
  });

  describe('memory limit edge cases', () => {
    it('should handle very small memory limit (32MB)', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      // Use a very small memory limit
      await run([event], __dirname + '/oom-worker', {
        testMemoryLimitMb: 32,
      });

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.DataExtractionError
      );
      expect(lastRequest.body.event_data.error).toBeDefined();
      expect(lastRequest.body.event_data.error.message).toBeDefined();
    }, 120000);

    it('should handle moderate memory limit (128MB)', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      await run([event], __dirname + '/oom-worker', {
        testMemoryLimitMb: 128,
      });

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.DataExtractionError
      );
      expect(lastRequest.body.event_data.error).toBeDefined();
      expect(lastRequest.body.event_data.error.message).toBeDefined();
    }, 120000);
  });

  describe('memory monitoring during OOM', () => {
    it('should not cause issues when memory monitoring runs during OOM buildup', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      // Gradual worker gives time for memory monitoring to run
      await run([event], __dirname + '/oom-gradual-worker');

      // Parent thread should still be functional
      const requests = mockServer.getRequests();
      expect(requests.length).toBeGreaterThan(0);

      // Gradual OOM may emit progress or error, just verify some event was emitted
      const lastRequest = requests[requests.length - 1];
      expect(lastRequest.body.event_type).toBeDefined();
    }, 120000);

    it('should properly clean up after OOM and allow subsequent operations', async () => {
      const baseUrl = mockServer.getBaseUrl();

      // First OOM event
      const event1 = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      await run([event1], __dirname + '/oom-worker');

      const requestsAfterFirst = mockServer.getRequests().length;

      // Clear and run second OOM event
      mockServer.clearRequests();

      const event2 = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      await run([event2], __dirname + '/oom-worker');

      const requestsAfterSecond = mockServer.getRequests().length;

      // Both runs should have completed and made requests
      expect(requestsAfterFirst).toBeGreaterThan(0);
      expect(requestsAfterSecond).toBeGreaterThan(0);

      // Both should have emitted OOM errors
      const lastRequest =
        mockServer.getRequests()[mockServer.getRequests().length - 1];
      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.DataExtractionError
      );
    }, 240000); // 4 minute timeout for two OOM tests
  });

  describe('race condition handling', () => {
    it('should handle rapid OOM (error before any logging)', async () => {
      const baseUrl = mockServer.getBaseUrl();
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
          worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
        },
        executionMetadataOverrides: {
          devrev_endpoint: `${baseUrl}`,
        },
      });

      // Very small limit causes near-instant OOM
      await run([event], __dirname + '/oom-worker', {
        testMemoryLimitMb: 16,
      });

      const requests = mockServer.getRequests();
      const lastRequest = requests[requests.length - 1];

      // Should still properly detect and report OOM
      expect(lastRequest.body.event_type).toBe(
        ExtractorEventType.DataExtractionError
      );
      expect(lastRequest.body.event_data.error).toBeDefined();
    }, 120000);
  });
});
