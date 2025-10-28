import { EventType, ExtractorEventType } from '../../types/extraction';
import { MockServer } from '../mock-server';
import { createEvent } from '../test-helpers';
import run from './extraction';

jest.setTimeout(15000);

describe('timeout-2 extraction', () => {
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

  it('should emit progress event when soft timeout is reached', async () => {
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

    await run([event], __dirname + '/timeout-2');

    const requests = mockServer.getRequests();
    const lastRequest = requests[requests.length - 1];

    // Expect last request to be emission of progress event
    expect(lastRequest.url).toContain('airdrop.external-extractor.message');
    expect(lastRequest.method).toBe('POST');
    expect(lastRequest.body.event_type).toBe(ExtractorEventType.ExtractionDataProgress);
  });
});
