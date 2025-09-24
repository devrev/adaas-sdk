import { MockServer } from '../mock-server-2';
import { createEvent } from '../test-helpers';
import { AirdropEvent, EventType } from '../../types';
import run from './extraction';

describe('Attachments streaming E2E', () => {
  let event: AirdropEvent;
  let mockServer: MockServer;

  afterEach(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it('should stream a single attachment with default state', async () => {
    mockServer = new MockServer();
    await mockServer.start();

    event = createEvent({
      eventType: EventType.ExtractionAttachmentsStart,
      eventContextOverrides: {
        callback_url: `${mockServer.baseUrl}/callback_url`,
        worker_data_url: `${mockServer.baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${mockServer.baseUrl}`,
      },
    });

    await run([event], __dirname + '/attachments-streaming');
  });

  it('should stream a single attachment with custom state', async () => {
    const customState = { custom_key: 'custom_value', another: 'field' };

    mockServer = new MockServer({
      overrides: [
        {
          path: '/worker_data_url.get',
          method: 'GET',
          response: {
            status: 200,
            body: {
              state: JSON.stringify(customState),
            },
          },
        },
      ],
    });
    await mockServer.start();

    event = createEvent({
      eventType: EventType.ExtractionAttachmentsStart,
      eventContextOverrides: {
        callback_url: `${mockServer.baseUrl}/callback_url`,
        worker_data_url: `${mockServer.baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${mockServer.baseUrl}`,
      },
    });

    await run([event], __dirname + '/attachments-streaming');
  });
});
