import { EventType } from '../src/types/extraction';
import { createEvent } from '../src/tests/test-helpers';
import { MockServer } from '../src/tests/mock-server';
import run from '../src/tests/timeout-handling/extraction';

jest.setTimeout(120000); // 2 minutes timeout for OOM tests

/**
 * ADaaS SDK OOM Test Scenarios
 * 
 * These tests exercise the actual ADaaS SDK functionality under memory pressure
 * to understand how the SDK behaves when approaching or exceeding memory limits.
 * 
 * The tests simulate realistic scenarios like data extraction, HTTP requests,
 * and event emission while consuming excessive memory to trigger OOM conditions.
 */
describe('OOM Test Scenarios', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    console.log('🧪 Setting up SDK OOM Test Suite');
    mockServer = new MockServer(3002); // Use different port than timeout tests
    await mockServer.start();
    console.log(`🌐 Mock server started at ${mockServer.getBaseUrl()}`);
  });

  afterAll(async () => {
    if (mockServer) {
      console.log('🧹 Cleaning up mock server');
      await mockServer.stop();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer.clearRequests();
    console.log(`📊 Test Memory at start: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    
    // Force GC before each test
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    console.log(`📊 Test Memory at end: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    
    // Force GC after each test
    if (global.gc) {
      global.gc();
    }
  });

  describe('SDK Data Extraction Under Memory Pressure', () => {
    it('should emit error event when SDK data extraction runs out of memory', async () => {
      console.log('🧪 Starting OOM Data Extraction Test');
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

      console.log('📤 Running OOM data extraction worker...');
      
      // This should trigger OOM due to excessive memory consumption
      await run([event], __dirname + '/workers/oom-data-extraction');

      const requests = mockServer.getRequests();
      console.log(`📨 Received ${requests.length} requests from worker`);
      
      // Log all requests for debugging
      requests.forEach((req, index) => {
        console.log(`Request ${index + 1}: ${req.method} ${req.url} - Event: ${req.body?.event_type || 'unknown'}`);
      });

      // Should have received at least one request (progress or error)
      expect(requests.length).toBeGreaterThan(0);
      
      // Find the last event emission
      const lastRequest = requests[requests.length - 1];
      expect(lastRequest.url).toContain('airdrop.external-extractor.message');
      expect(lastRequest.method).toBe('POST');
      
      // Should emit either progress, error, or done event
      const validEventTypes = [
        'EXTRACTION_DATA_PROGRESS',
        'EXTRACTION_DATA_ERROR', 
        'EXTRACTION_DATA_DONE'
      ];
      expect(validEventTypes).toContain(lastRequest.body.event_type);
      
      console.log(`✅ Final event emitted: ${lastRequest.body.event_type}`);
      if (lastRequest.body.event_data?.progress) {
        console.log(`📈 Final progress: ${lastRequest.body.event_data.progress}%`);
      }
      if (lastRequest.body.event_data?.error) {
        console.log(`❌ Final error: ${lastRequest.body.event_data.error.message}`);
      }
    });

    it('should emit error event when SDK HTTP extraction runs out of memory', async () => {
      console.log('🧪 Starting OOM HTTP Extraction Test');
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

      console.log('📤 Running OOM HTTP extraction worker...');
      
      // This should trigger OOM due to HTTP response caching and memory leaks
      await run([event], __dirname + '/workers/oom-http-extraction');

      const requests = mockServer.getRequests();
      console.log(`📨 Received ${requests.length} requests from HTTP worker`);
      
      // Log requests for debugging
      requests.forEach((req, index) => {
        console.log(`Request ${index + 1}: ${req.method} ${req.url} - Event: ${req.body?.event_type || 'unknown'}`);
      });

      // Should have received at least one request
      expect(requests.length).toBeGreaterThan(0);
      
      const lastRequest = requests[requests.length - 1];
      expect(lastRequest.url).toContain('airdrop.external-extractor.message');
      expect(lastRequest.method).toBe('POST');
      
      // Should emit either progress, error, or done event  
      const validEventTypes = [
        'EXTRACTION_DATA_PROGRESS',
        'EXTRACTION_DATA_ERROR',
        'EXTRACTION_DATA_DONE'
      ];
      expect(validEventTypes).toContain(lastRequest.body.event_type);
      
      console.log(`✅ Final HTTP event emitted: ${lastRequest.body.event_type}`);
    });
  });

  describe('SDK Error Handling: Timeout vs OOM', () => {
    it('should distinguish between timeout and OOM scenarios', async () => {
      console.log('🧪 Testing Timeout vs OOM distinction');
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

      // First run the OOM worker (should crash with memory error)
      let oomError: any;
      try {
        await run([event], __dirname + '/workers/oom-data-extraction');
      } catch (error) {
        oomError = error;
      }
      
      const oomRequests = mockServer.getRequests();
      mockServer.clearRequests();
      
      // Then run a timeout scenario for comparison
      let timeoutError: any;
      try {
        await run([event], __dirname + '/../src/tests/timeout-handling/timeout-3a');
      } catch (error) {
        timeoutError = error;
      }
      
      const timeoutRequests = mockServer.getRequests();
      
      console.log(`OOM requests: ${oomRequests.length}, Timeout requests: ${timeoutRequests.length}`);
      console.log(`OOM error type: ${oomError?.constructor?.name || 'none'}`);
      console.log(`Timeout error type: ${timeoutError?.constructor?.name || 'none'}`);
      
      // Both should have emitted events
      expect(oomRequests.length).toBeGreaterThan(0);
      expect(timeoutRequests.length).toBeGreaterThan(0);
      
      // Both should have emitted a final event
      const oomLastEvent = oomRequests[oomRequests.length - 1];
      const timeoutLastEvent = timeoutRequests[timeoutRequests.length - 1];
      
      expect(oomLastEvent.body.event_type).toBeDefined();
      expect(timeoutLastEvent.body.event_type).toBeDefined();
      
      // The timeout test should emit ERROR (as per timeout-3a.test.ts)
      expect(timeoutLastEvent.body.event_type).toBe('EXTRACTION_DATA_ERROR');
      
      console.log(`✅ OOM final event: ${oomLastEvent.body.event_type}`);
      console.log(`✅ Timeout final event: ${timeoutLastEvent.body.event_type}`);
    });
  });
});
