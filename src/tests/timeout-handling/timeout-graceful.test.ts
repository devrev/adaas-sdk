import {
  AirSyncEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createMockEvent } from '../../common/test-utils';

import run from './extraction';

jest.setTimeout(10000);

describe('Timeout graceful', () => {
  let event: AirSyncEvent;
  beforeEach(() => {
    event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingData },
    });
  });

  it('should emit progress event when timeout is reached but event loop is not blocked', async () => {
    await run([event], __dirname + '/timeout-graceful');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.DataExtractionProgress
    );
  });
});
