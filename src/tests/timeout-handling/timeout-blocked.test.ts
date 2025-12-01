import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

jest.setTimeout(10000);

describe('Timeout blocked', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.StartExtractingData,
    });
  });

  it('should emit error event when timeout is reached and event loop is blocked', async () => {
    await run([event], __dirname + '/timeout-blocked');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.DataExtractionError
    );
  });
});
