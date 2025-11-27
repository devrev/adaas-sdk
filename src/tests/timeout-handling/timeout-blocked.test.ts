import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { createEvent } from '../test-helpers';
import { mockServer } from './jest.setup';

import run from './extraction';

describe('Timeout blocked', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.ExtractionDataStart,
    });
  });

  it('should emit error event when timeout is reached and event loop is blocked', async () => {
    await run([event], __dirname + '/timeout-blocked');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.ExtractionDataError
    );
  });
});
