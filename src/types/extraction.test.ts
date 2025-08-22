import { EventContext, EventType, InitialSyncScope } from './extraction';
import { createEvent } from '../tests/test-helpers';

describe('EventContext type tests', () => {
  const baseEvent = createEvent({ eventType: EventType.ExtractionDataStart });

  it('should handle context without optional fields', () => {
    const event = { ...baseEvent };
    // If this compiles, the test passes
    expect(event).toBeDefined();
  });

  it('should handle context with all optional fields', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      extract_from: '2024-01-01T00:00:00Z',
      initial_sync_scope: InitialSyncScope.TIME_SCOPED,
      reset_extract_from: true,
    } as EventContext;

    // Test with all optionals present
    expect(event).toBeDefined();
  });

  it('should handle partial optional fields', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      extract_from: '2024-01-01T00:00:00Z',
    } as EventContext;

    expect(event).toBeDefined();
  });
});
