import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

jest.setTimeout(10000); // 10 seconds

describe('Timeout unblocked', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.StartExtractingData,
    });
  });

  it('should emit progress event when timeout is reached and event loop can process messages', async () => {
    await run([event], __dirname + '/timeout-unblocked');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.DataExtractionProgress
    );
  });
});
