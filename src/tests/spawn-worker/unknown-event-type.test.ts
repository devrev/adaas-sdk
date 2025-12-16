import { EventType, ExtractorEventType } from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

describe('Unknown event type', () => {
  it('should successfully emit unknown event type when the event type is not found', async () => {
    const event = createEvent({
      eventType: 'INVALID_EVENT_TYPE' as EventType,
    });

    await run([event], __dirname + '/unknown-event-type');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.UnknownEventType
    );
  });
});
