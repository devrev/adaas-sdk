import { MockServer } from './mock-server';
import { createEvent } from '../test-helpers';
import { EventType } from '../../types';

import run from './extraction';

describe('Attachments streaming e2e', () => {
  const mockServer = new MockServer();
  const baseURL = mockServer.baseUrl;

  beforeAll(async () => {
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('should emit done event since there is no timeout', async () => {
    const baseUrl = mockServer.baseUrl;
    const event = createEvent({
      eventType: EventType.ExtractionAttachmentsStart,
      eventContextOverrides: {
        callback_url: `${baseUrl}/callback_url`,
        worker_data_url: `${baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${baseUrl}`,
      },
    });

    await run([event], __dirname + '/test1');
  });
});
