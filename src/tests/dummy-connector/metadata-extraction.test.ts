import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

jest.setTimeout(10000);

describe('Dummy Connector - Metadata Extraction', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.StartExtractingMetadata,
    });
  });

  it('should successfully emit metadata done event when all endpoints return 200', async () => {
    await run([event], __dirname + '/metadata-extraction');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.MetadataExtractionDone
    );
  });

  it('should emit metadata error event when it fails to initialize state due to 400 response', async () => {
    mockServer.setRoute({
      path: '/worker_data_url.get',
      method: 'GET',
      status: 400,
    });

    await run([event], __dirname + '/metadata-extraction');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.MetadataExtractionError
    );
  });

  it('should retry 2 times when response is 500 and then succeed third time when response is 200', async () => {
    mockServer.setRoute({
      path: '/worker_data_url.get',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 2,
        errorStatus: 500,
        errorBody: { error: 'Internal Server Error' },
      },
    });

    await run([event], __dirname + '/metadata-extraction');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.MetadataExtractionDone
    );
  });
});
