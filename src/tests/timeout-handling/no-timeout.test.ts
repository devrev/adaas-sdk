import {
  AirSyncEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';

import { mockServer } from '../jest.setup';
import { createMockEvent } from '../../common/test-utils';

import run from './extraction';

describe('No timeout', () => {
  let event: AirSyncEvent;
  beforeEach(() => {
    event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingData },
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
