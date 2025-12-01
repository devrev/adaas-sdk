import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';

import { createEvent } from '../test-helpers';
import { mockServer } from './jest.setup';

import run from './extraction';

describe('No timeout', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.ExtractionDataStart,
    });
  });

  it('should emit done event when no timeout is reached', async () => {
    await run([event], __dirname + '/no-timeout');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.DataExtractionDone
    );
  });
});
