import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../test-utils/create-event';
import { EventType, TimeValueType } from '../types/extraction';

describe('Enhanced Control Protocol', () => {
  describe('TimeValueType enum values', () => {
    it('should have all seven values', () => {
      const values = Object.values(TimeValueType);
      expect(values).toHaveLength(7);
      expect(values).toContain('workers_oldest');
      expect(values).toContain('workers_oldest_minus_window');
      expect(values).toContain('workers_newest');
      expect(values).toContain('workers_newest_plus_window');
      expect(values).toContain('current_time');
      expect(values).toContain('absolute_time');
      expect(values).toContain('unbounded');
    });
  });

  describe('Backward compatibility', () => {
    it('should work with events that do not use new extraction fields', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
      });

      expect(event.payload.event_context).toBeDefined();
      expect(event.payload.event_context.extraction_start_time).toBeUndefined();
      expect(event.payload.event_context.extraction_end_time).toBeUndefined();
      expect(event.payload.event_context.extract_from).toBeUndefined();
      expect(event.payload.event_context.extract_to).toBeUndefined();
    });

    it('should support setting extract_from and extract_to directly on event context', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extract_from: '2024-01-01T00:00:00Z',
            extract_to: '2024-06-01T00:00:00Z',
            reset_extract_from: true,
          },
        },
      });

      expect(event.payload.event_context.extract_from).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extract_to).toBe(
        '2024-06-01T00:00:00Z'
      );
      expect(event.payload.event_context.reset_extract_from).toBe(true);
    });
  });

  describe('Enhanced protocol event context fields', () => {
    it('should support forward direction with absolute start and now end', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-01-01T00:00:00Z',
            },
            extraction_end_time: {
              type: TimeValueType.CURRENT_TIME,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.ABSOLUTE_TIME
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.CURRENT_TIME
      );
    });

    it('should support historical direction with unbounded start', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.UNBOUNDED,
            },
            extraction_end_time: {
              type: TimeValueType.CURRENT_TIME,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.UNBOUNDED
      );
    });

    it('should support workers_newest for periodic forward sync', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.ContinueExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.WORKERS_NEWEST,
            },
            extraction_end_time: {
              type: TimeValueType.CURRENT_TIME,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_NEWEST
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.CURRENT_TIME
      );
    });

    it('should support workers_oldest_minus_window for computer imports', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
              value: '168h',
            },
            extraction_end_time: {
              type: TimeValueType.WORKERS_OLDEST,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_OLDEST_MINUS_WINDOW
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '168h'
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.WORKERS_OLDEST
      );
    });
  });

  describe('Real-world scenarios from Enhanced Control Protocol', () => {
    it('Scenario: Normal import - initial with unbounded start', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.UNBOUNDED,
            },
            extraction_end_time: {
              type: TimeValueType.CURRENT_TIME,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.UNBOUNDED
      );
    });

    it('Scenario: Normal import - periodic sync from workers_newest to now', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.ContinueExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.WORKERS_NEWEST,
            },
            extraction_end_time: {
              type: TimeValueType.CURRENT_TIME,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_NEWEST
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.CURRENT_TIME
      );
    });

    it('Scenario: POC import - from absolute date X to now', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-06-01T00:00:00Z',
            },
            extraction_end_time: {
              type: TimeValueType.CURRENT_TIME,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.ABSOLUTE_TIME
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '2024-06-01T00:00:00Z'
      );
    });

    it('Scenario: Reconciliation import - from Date X to Date Y', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-01-01T00:00:00Z',
            },
            extraction_end_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-03-31T23:59:59Z',
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.ABSOLUTE_TIME
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.ABSOLUTE_TIME
      );
      expect(event.payload.event_context.extraction_end_time?.value).toBe(
        '2024-03-31T23:59:59Z'
      );
    });

    it('Scenario: Computer import - historical direction with window', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
              value: '120m',
            },
            extraction_end_time: {
              type: TimeValueType.WORKERS_OLDEST,
            },
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_OLDEST_MINUS_WINDOW
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '120m'
      );
    });
  });

  describe('Event context field placement', () => {
    it('extraction fields are nested under event_context, not at payload root', () => {
      const event = createMockEvent({
        mockServerBaseUrl: mockServer.baseUrl,
        eventType: EventType.StartExtractingData,
        fixture: {
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-02-01T00:00:00Z',
            },
            extraction_end_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-02-29T23:59:59Z',
            },
          },
        },
      });

      expect(event.payload.event_context).toHaveProperty(
        'extraction_start_time'
      );
      expect(event.payload.event_context).toHaveProperty('extraction_end_time');

      const payloadKeys = Object.keys(event.payload);
      expect(payloadKeys).not.toContain('extraction_start_time');
      expect(payloadKeys).not.toContain('extraction_end_time');
      expect(payloadKeys).not.toContain('extraction_time_direction');
    });
  });
});
