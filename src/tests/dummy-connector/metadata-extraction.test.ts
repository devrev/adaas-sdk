import { EventType } from '../../types/extraction';
import { createEvent } from '../test-helpers';
import run from './extraction';
import { MockServer } from '../mock-server-v2';

jest.setTimeout(15000);

describe('Dummy Connector - Metadata Extraction', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    mockServer = new MockServer(3001);
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('should emit metadata done event', async () => {
    const event = createEvent({
      eventType: EventType.ExtractionMetadataStart,
      eventContextOverrides: {
        callback_url: `${mockServer.baseUrl}/callback_url`,
        worker_data_url: `${mockServer.baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: mockServer.baseUrl,
      },
    });

    await run([event], __dirname + '/workers/metadata-extraction');
    expect(true).toBe(true);
  });
});
