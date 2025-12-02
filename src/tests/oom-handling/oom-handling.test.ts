import { EventType, ExtractorEventType } from '../../types/extraction';
import { MockServer } from '../mock-server';
import { createEvent } from '../test-helpers';
import run from './extraction';

describe('OOM handling', () => {
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

    // The error should contain OOM information
    expect(lastRequest.body.event_data).toBeDefined();
    expect(lastRequest.body.event_data.error).toBeDefined();
    expect(lastRequest.body.event_data.error.message).toContain('out of memory');

    // OOM error info should be present
    const oomErrorInfo = lastRequest.body.event_data.error.oom_error_info;
    expect(oomErrorInfo).toBeDefined();
    expect(oomErrorInfo.type).toBe('OOM_ERROR');
    expect(oomErrorInfo.memoryLimitMb).toBeGreaterThan(0);
    expect(oomErrorInfo.eventType).toBe(EventType.StartExtractingData);
  }, 120000); // 2 minute timeout for OOM test

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
  }, 120000); // 2 minute timeout for OOM test
});

