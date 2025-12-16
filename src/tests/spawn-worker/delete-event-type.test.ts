import { EventType, ExtractorEventType } from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

describe('Delete event type', () => {
  it('should successfully emit delete done event when the incoming event is start delete and there is no script passed', async () => {
    const event = createEvent({
      eventType: EventType.StartDeletingExtractorState,
    });

    await run([event]);

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.ExtractorStateDeletionDone
    );
  });

  it('should successfully emit delete done event when the incoming event is start delete and there is a script passed', async () => {
    const event = createEvent({
      eventType: EventType.StartDeletingExtractorState,
    });

    await run([event], __dirname + '/some-cleanup-worker');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.ExtractorStateDeletionDone
    );
  });
});
