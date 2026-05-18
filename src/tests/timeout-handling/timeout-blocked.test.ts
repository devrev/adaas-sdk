import {
  AirSyncEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createMockEvent } from '../../common/test-utils';

import run from './extraction';

jest.setTimeout(10000);

describe('Timeout blocked', () => {
  let event: AirSyncEvent;
  beforeEach(() => {
    event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingData },
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
