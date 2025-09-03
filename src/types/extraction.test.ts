import { EventContext, EventType, InitialSyncScope } from './extraction';
import { createEvent } from '../tests/test-helpers';

// Test the EventContext interface and related extraction types
describe('ExtractionTypes', () => {
  const baseEvent = createEvent({ eventType: EventType.ExtractionDataStart });

  it('should create event context without optional fields', () => {
    const event = { ...baseEvent };
    
    // If this compiles, the test passes
    expect(event).toBeDefined();
    expect(event.payload.event_context).toBeDefined();
  });

  it('should create event context with all optional fields', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      extract_from: '2024-01-01T00:00:00Z',
      initial_sync_scope: InitialSyncScope.TIME_SCOPED,
      reset_extract_from: true,
    } as EventContext;

    expect(event).toBeDefined();
    expect(event.payload.event_context.extract_from).toBe('2024-01-01T00:00:00Z');
    expect(event.payload.event_context.initial_sync_scope).toBe(InitialSyncScope.TIME_SCOPED);
    expect(event.payload.event_context.reset_extract_from).toBe(true);
  });

  it('should create event context with partial optional fields', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      extract_from: '2024-01-01T00:00:00Z',
    } as EventContext;

    expect(event).toBeDefined();
    expect(event.payload.event_context.extract_from).toBe('2024-01-01T00:00:00Z');
  });

  it('should handle different InitialSyncScope values', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
        ...baseEvent.payload.event_context,
        initial_sync_scope: InitialSyncScope.FULL_HISTORY
    } as EventContext;

    expect(event.payload.event_context.initial_sync_scope).toBe(InitialSyncScope.FULL_HISTORY);
  });

  it('[edge] should handle null event context gracefully', () => {
      const event = { ...baseEvent };

      event.payload.event_context = null as any;

      expect(event.payload.event_context).toBeNull();
    });

  it('[edge] should handle undefined optional fields', () => {
      const event = { ...baseEvent };

      event.payload.event_context = {
        ...baseEvent.payload.event_context,
        extract_from: undefined,
        initial_sync_scope: undefined,
        reset_extract_from: undefined
      } as EventContext;

      expect(event.payload.event_context.extract_from).toBeUndefined();
      expect(event.payload.event_context.initial_sync_scope).toBeUndefined();
      expect(event.payload.event_context.reset_extract_from).toBeUndefined();
    });

  it('[edge] should handle invalid date format in extract_from', () => {
      const event = { ...baseEvent };

      event.payload.event_context = {
        ...baseEvent.payload.event_context,
        extract_from: 'invalid-date-format'
      } as EventContext;

      expect(event.payload.event_context.extract_from).toBe('invalid-date-format');
      // Note: Type validation would typically happen at runtime, not compile time
    });

  it('[edge] should handle explicit boolean values for reset_extract_from', () => {
      const eventWithTrue = createEvent({
        eventType: EventType.ExtractionDataStart,
        eventContextOverrides: {
          reset_extract_from: true
        }
      });

      const eventWithFalse = createEvent({
        eventType: EventType.ExtractionDataStart,
        eventContextOverrides: {
          reset_extract_from: false
        }
      });

      expect(eventWithTrue.payload.event_context.reset_extract_from).toBe(true);
      expect(eventWithFalse.payload.event_context.reset_extract_from).toBe(false);
      expect(typeof eventWithTrue.payload.event_context.reset_extract_from).toBe('boolean');
      expect(typeof eventWithFalse.payload.event_context.reset_extract_from).toBe('boolean');
    });
});