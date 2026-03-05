import { createEvent } from '../tests/test-helpers';
import {
  EventContext,
  EventType,
  InitialSyncScope,
  ExtractionTimeDirection,
  TimeValueType,
} from './extraction';

// Test the EventContext interface and related extraction types
describe('ExtractionTypes', () => {
  const baseEvent = createEvent({ eventType: EventType.StartExtractingData });

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
    expect(event.payload.event_context.extract_from).toBe(
      '2024-01-01T00:00:00Z'
    );
    expect(event.payload.event_context.initial_sync_scope).toBe(
      InitialSyncScope.TIME_SCOPED
    );
    expect(event.payload.event_context.reset_extract_from).toBe(true);
  });

  it('should create event context with partial optional fields', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      extract_from: '2024-01-01T00:00:00Z',
    } as EventContext;

    expect(event).toBeDefined();
    expect(event.payload.event_context.extract_from).toBe(
      '2024-01-01T00:00:00Z'
    );
  });

  it('should handle different InitialSyncScope values', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      initial_sync_scope: InitialSyncScope.FULL_HISTORY,
    } as EventContext;

    expect(event.payload.event_context.initial_sync_scope).toBe(
      InitialSyncScope.FULL_HISTORY
    );
  });

  it('[edge] should handle null event context gracefully', () => {
    const event = { ...baseEvent };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event.payload.event_context = null as any;

    expect(event.payload.event_context).toBeNull();
  });

  it('[edge] should handle undefined optional fields', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      extract_from: undefined,
      initial_sync_scope: undefined,
      reset_extract_from: undefined,
    } as EventContext;

    expect(event.payload.event_context.extract_from).toBeUndefined();
    expect(event.payload.event_context.initial_sync_scope).toBeUndefined();
    expect(event.payload.event_context.reset_extract_from).toBeUndefined();
  });

  it('[edge] should handle invalid date format in extract_from', () => {
    const event = { ...baseEvent };

    event.payload.event_context = {
      ...baseEvent.payload.event_context,
      extract_from: 'invalid-date-format',
    } as EventContext;

    expect(event.payload.event_context.extract_from).toBe(
      'invalid-date-format'
    );
    // Note: Type validation would typically happen at runtime, not compile time
  });

  it('[edge] should handle explicit boolean values for reset_extract_from', () => {
    const eventWithTrue = createEvent({
      eventType: EventType.StartExtractingData,
      eventContextOverrides: {
        reset_extract_from: true,
      },
    });

    const eventWithFalse = createEvent({
      eventType: EventType.StartExtractingData,
      eventContextOverrides: {
        reset_extract_from: false,
      },
    });

    expect(eventWithTrue.payload.event_context.reset_extract_from).toBe(true);
    expect(eventWithFalse.payload.event_context.reset_extract_from).toBe(false);
    expect(typeof eventWithTrue.payload.event_context.reset_extract_from).toBe(
      'boolean'
    );
    expect(typeof eventWithFalse.payload.event_context.reset_extract_from).toBe(
      'boolean'
    );
  });

  describe('ExtractionTimeDirection enum', () => {
    it('should have historical value', () => {
      expect(ExtractionTimeDirection.HISTORICAL).toBeDefined();
      expect(ExtractionTimeDirection.HISTORICAL).toBe('historical');
    });

    it('should have forward value', () => {
      expect(ExtractionTimeDirection.FORWARD).toBeDefined();
      expect(ExtractionTimeDirection.FORWARD).toBe('forward');
    });

    it('should have exactly two values', () => {
      const values = Object.values(ExtractionTimeDirection);
      expect(values.length).toBe(2);
      expect(values).toContain('historical');
      expect(values).toContain('forward');
    });
  });

  describe('TimeValueType enum', () => {
    it('should have all expected values', () => {
      expect(TimeValueType.WORKERS_OLDEST).toBe('workers_oldest');
      expect(TimeValueType.WORKERS_OLDEST_MINUS_WINDOW).toBe(
        'workers_oldest_minus_window'
      );
      expect(TimeValueType.WORKERS_NEWEST).toBe('workers_newest');
      expect(TimeValueType.WORKERS_NEWEST_PLUS_WINDOW).toBe(
        'workers_newest_plus_window'
      );
      expect(TimeValueType.NOW).toBe('now');
      expect(TimeValueType.ABSOLUTE).toBe('absolute');
      expect(TimeValueType.UNBOUNDED).toBe('unbounded');
    });

    it('should have exactly seven values', () => {
      const values = Object.values(TimeValueType);
      expect(values.length).toBe(7);
    });
  });
});
