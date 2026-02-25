import {
  EventType,
  ExtractorEvent,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';
import run from './extraction-with-timeout';

// Increase timeout — the worker sleeps for 20s and spawn has a 15s soft timeout.
// The push of 3000 items can take 5-10s on CI, so total test time can be ~25s.
jest.setTimeout(60000);

describe('double-timeout: onTimeout guard prevents double execution', () => {
  it('should only emit one progress event when both size limit and real timeout trigger', async () => {
    const event = createEvent({
      eventType: EventType.StartExtractingData,
    });

    await run([event], __dirname + '/double-timeout');

    // Get all callback requests made to the mock server
    const callbackRequests = mockServer.getRequests('POST', '/callback_url');

    // There should be exactly 1 callback (the onTimeout progress emit)
    // Without the guard, there would be 2: one from the post-task size limit
    // check and one from the WorkerMessageExit handler
    expect(callbackRequests.length).toBe(1);

    const body = callbackRequests[0]?.body as ExtractorEvent;
    expect(body.event_type).toBe(ExtractorEventType.DataExtractionProgress);
  });

  it('should emit progress (not done) when size limit was triggered', async () => {
    const event = createEvent({
      eventType: EventType.StartExtractingData,
    });

    await run([event], __dirname + '/double-timeout');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');

    const body = lastRequest?.body as ExtractorEvent;

    // Should be progress, not done — the size limit should cause
    // onTimeout to emit progress instead of the task's emit(Done)
    expect(body.event_type).toBe(ExtractorEventType.DataExtractionProgress);

    // Verify artifacts are included
    expect(body.event_data?.artifacts).toBeDefined();
    expect(Array.isArray(body.event_data?.artifacts)).toBe(true);
  });
});
