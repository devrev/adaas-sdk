import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

jest.setTimeout(10000);

describe('Dummy Connector - Data Extraction', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.StartExtractingData,
    });
  });

  it('should successfully emit data done event when all endpoints return 200', async () => {
    await run([event], __dirname + '/data-extraction');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.DataExtractionDone
    );
  });
});
