import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { createEvent } from '../test-helpers';
import run from '../timeout-handling/extraction';
import { mockServer } from '../timeout-handling/jest.setup';

describe('Dummy Connector - Metadata Extraction', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.ExtractionMetadataStart,
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

  it('should emit metadata error event when it fails to initialize state', async () => {
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
});
