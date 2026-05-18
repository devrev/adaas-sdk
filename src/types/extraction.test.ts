import { createMockEvent } from '../common/test-utils';
import { mockServer } from '../tests/jest.setup';
import { EventType, InitialSyncScope, TimeValueType } from './extraction';

describe('ExtractionTypes', () => {
  it('should create event context with all optional fields', () => {
    // Arrange & Act
    const event = createMockEvent(mockServer.baseUrl, {
      payload: {
        event_type: EventType.StartExtractingData,
        event_context: {
          extract_from: '2024-01-01T00:00:00Z',
          extract_to: '2024-06-01T00:00:00Z',
          initial_sync_scope: InitialSyncScope.TIME_SCOPED,
          reset_extract_from: true,
        },
      },
    });

    // Assert
    expect(event.payload.event_context.extract_from).toBe(
      '2024-01-01T00:00:00Z'
    );
    expect(event.payload.event_context.extract_to).toBe('2024-06-01T00:00:00Z');
    expect(event.payload.event_context.initial_sync_scope).toBe(
      InitialSyncScope.TIME_SCOPED
    );
    expect(event.payload.event_context.reset_extract_from).toBe(true);
  });

  it('should create event context with partial optional fields', () => {
    // Arrange & Act
    const event = createMockEvent(mockServer.baseUrl, {
      payload: {
        event_type: EventType.StartExtractingData,
        event_context: {
          extract_from: '2024-01-01T00:00:00Z',
        },
      },
    });

    // Assert
    expect(event.payload.event_context.extract_from).toBe(
      '2024-01-01T00:00:00Z'
    );
  });

  it('should handle different InitialSyncScope values', () => {
    // Arrange & Act
    const event = createMockEvent(mockServer.baseUrl, {
      payload: {
        event_type: EventType.StartExtractingData,
        event_context: {
          initial_sync_scope: InitialSyncScope.FULL_HISTORY,
        },
      },
    });

    // Assert
    expect(event.payload.event_context.initial_sync_scope).toBe(
      InitialSyncScope.FULL_HISTORY
    );
  });

  it('[edge] should handle null event context gracefully', () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingData },
    });

    // Act
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event.payload.event_context = null as any;

    // Assert
    expect(event.payload.event_context).toBeNull();
  });

  it('[edge] should handle undefined optional fields', () => {
    // Arrange & Act
    const event = createMockEvent(mockServer.baseUrl, {
      payload: {
        event_type: EventType.StartExtractingData,
        event_context: {
          extract_from: undefined,
          extract_to: undefined,
          initial_sync_scope: undefined,
          reset_extract_from: undefined,
        },
      },
    });

    // Assert
    expect(event.payload.event_context.extract_from).toBeUndefined();
    expect(event.payload.event_context.extract_to).toBeUndefined();
    expect(event.payload.event_context.initial_sync_scope).toBeUndefined();
    expect(event.payload.event_context.reset_extract_from).toBeUndefined();
  });

  it('[edge] should handle explicit boolean values for reset_extract_from', () => {
    // Arrange & Act
    const eventWithTrue = createMockEvent(mockServer.baseUrl, {
      payload: {
        event_type: EventType.StartExtractingData,
        event_context: {
          reset_extract_from: true,
        },
      },
    });
    const eventWithFalse = createMockEvent(mockServer.baseUrl, {
      payload: {
        event_type: EventType.StartExtractingData,
        event_context: {
          reset_extract_from: false,
        },
      },
    });

    // Assert
    expect(eventWithTrue.payload.event_context.reset_extract_from).toBe(true);
    expect(eventWithFalse.payload.event_context.reset_extract_from).toBe(false);
    expect(typeof eventWithTrue.payload.event_context.reset_extract_from).toBe(
      'boolean'
    );
    expect(typeof eventWithFalse.payload.event_context.reset_extract_from).toBe(
      'boolean'
    );
  });

  describe('TimeValueType enum', () => {
    it('should have all expected values', () => {
      // Assert
      expect(TimeValueType.WORKERS_OLDEST).toBe('workers_oldest');
      expect(TimeValueType.WORKERS_OLDEST_MINUS_WINDOW).toBe(
        'workers_oldest_minus_window'
      );
      expect(TimeValueType.WORKERS_NEWEST).toBe('workers_newest');
      expect(TimeValueType.WORKERS_NEWEST_PLUS_WINDOW).toBe(
        'workers_newest_plus_window'
      );
      expect(TimeValueType.CURRENT_TIME).toBe('current_time');
      expect(TimeValueType.ABSOLUTE_TIME).toBe('absolute_time');
      expect(TimeValueType.UNBOUNDED).toBe('unbounded');
    });

    it('should have exactly seven values', () => {
      // Act
      const values = Object.values(TimeValueType);

      // Assert
      expect(values.length).toBe(7);
    });
  });
});
