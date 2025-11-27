import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { createEvent } from '../test-helpers';
import { mockServer } from './jest.setup';

import run from './extraction';

describe('Timeout graceful', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.ExtractionDataStart,
    });
  });

  it('should emit progress event when timeout is reached but event loop is not blocked', async () => {
    await run([event], __dirname + '/timeout-graceful');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.ExtractionDataProgress
    );
  });
});
