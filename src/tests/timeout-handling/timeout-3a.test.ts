import { EventType } from '../../types/extraction';
import { createEvent } from '../test-helpers';
import run from './extraction';
import { MockServer } from '../mock-server';

jest.setTimeout(15000);

describe('timeout-3a', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    mockServer = new MockServer(3001);
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

  it('should emit error event when hard timeout is reached', async () => {
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

    await run([event], __dirname + '/timeout-3a');

    const requests = mockServer.getRequests();
    const lastRequest = requests[requests.length - 1];

    // Expect last request to be emission of error event since we force-kill the worker
    expect(lastRequest.url).toContain('airdrop.external-extractor.message');
    expect(lastRequest.method).toBe('POST');
    expect(lastRequest.body.event_type).toBe('EXTRACTION_DATA_ERROR');
  });
});
