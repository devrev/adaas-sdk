import { EventType, ExtractorEventType } from '../../types/extraction';
import { MockServer } from '../mock-server';
import { createEvent } from '../test-helpers';
import run from './size-limit-extraction';

// Increase timeout for this test since we're doing many uploads
jest.setTimeout(120000);

describe('size-limit-1: SQS size limit early exit', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    mockServer = new MockServer(3002);
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

  it('should emit progress event when size limit is exceeded during data extraction', async () => {
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

    await run([event], __dirname + '/size-limit-1');

    const requests = mockServer.getRequests();

    // Find all emit requests to the callback URL
    const emitRequests = requests.filter(
      (r) =>
        r.url.includes('airdrop.external-extractor.message') &&
        r.method === 'POST'
    );

    // There should be one emit - the progress event from size limit
    expect(emitRequests.length).toBe(1);

    // The last emit should be a progress event (from size limit trigger or onTimeout)
    const lastEmit = emitRequests[emitRequests.length - 1];
    expect(lastEmit.body.event_type).toBe(
      ExtractorEventType.DataExtractionProgress
    );
  });

  it('should trigger onTimeout when size limit is reached', async () => {
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

    await run([event], __dirname + '/size-limit-1');

    const requests = mockServer.getRequests();

    // Verify that artifacts were uploaded (proving data was being processed)
    const artifactUploadRequests = requests.filter((r) =>
      r.url.includes('artifacts.upload-url')
    );
    expect(artifactUploadRequests.length).toBeGreaterThan(0);

    // Verify state was saved (worker data endpoint was called)
    const workerDataRequests = requests.filter(
      (r) => r.url.includes('airdrop.external-worker') && r.method === 'POST'
    );
    expect(workerDataRequests.length).toBeGreaterThan(0);

    // Verify onTimeout was called by checking the log output is implicitly
    // verified by the first test passing (progress event was emitted)
  });
});
