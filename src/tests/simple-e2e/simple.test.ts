import { MockServer } from '../mock-server-2';
import { createEvent } from '../test-helpers';
import { EventType } from '../../types';

import run from './extraction';

describe('Simple E2E test', () => {
  const mockServer = new MockServer();

  beforeAll(async () => {
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('should emit done event since there is no timeout', async () => {
    const baseUrl = mockServer.baseUrl;
    const event = createEvent({
      eventType: EventType.ExtractionDataStart,
      eventContextOverrides: {
        callback_url: `${baseUrl}/callback_url`,
        worker_data_url: `${baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${baseUrl}`,
      },
    });

    await run([event], __dirname + '/simple');
  });
});
