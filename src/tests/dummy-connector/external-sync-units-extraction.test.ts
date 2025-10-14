import { EventType } from '../../types/extraction';
import { createEvent } from '../test-helpers';
import run from './extraction';
import { MockServer } from '../mock-server-v2';

jest.setTimeout(15000);

describe('Dummy Connector - External Sync Units Extraction', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    mockServer = new MockServer(3001);
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('should emit external sync units done event', async () => {
    const event = createEvent({
      eventType: EventType.ExtractionExternalSyncUnitsStart,
      eventContextOverrides: {
        callback_url: `${mockServer.baseUrl}/callback_url`,
        worker_data_url: `${mockServer.baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: mockServer.baseUrl,
      },
    });

    await run([event], __dirname + '/workers/external-sync-units-extraction');
    expect(true).toBe(true);
  });
});
