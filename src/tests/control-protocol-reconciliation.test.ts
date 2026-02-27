import { createEvent } from './test-helpers';
import {
  EventType,
  ExtractionTimeDirection,
  TimeValueType,
} from '../types/extraction';

describe('Enhanced Control Protocol', () => {
  describe('ExtractionTimeDirection enum values', () => {
    it('should have the correct string value for HISTORICAL', () => {
      expect(ExtractionTimeDirection.HISTORICAL).toBe('historical');
    });

    it('should have the correct string value for FORWARD', () => {
      expect(ExtractionTimeDirection.FORWARD).toBe('forward');
    });

    it('should have exactly two direction values', () => {
      const values = Object.values(ExtractionTimeDirection);
      expect(values).toHaveLength(2);
      expect(values).toContain('historical');
      expect(values).toContain('forward');
    });
  });

  describe('TimeValueType enum values', () => {
    it('should have all seven values', () => {
      const values = Object.values(TimeValueType);
      expect(values).toHaveLength(7);
      expect(values).toContain('workers_oldest');
      expect(values).toContain('workers_oldest_minus_window');
      expect(values).toContain('workers_newest');
      expect(values).toContain('workers_newest_plus_window');
      expect(values).toContain('now');
      expect(values).toContain('absolute');
      expect(values).toContain('unbounded');
    });
  });

  describe('Backward compatibility', () => {
    it('should work with events that do not use new extraction fields', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
      });

      expect(event.payload.event_context).toBeDefined();
      expect(
        event.payload.event_context.extraction_time_direction
      ).toBeUndefined();
      expect(event.payload.event_context.extraction_start_time).toBeUndefined();
      expect(event.payload.event_context.extraction_end_time).toBeUndefined();
      expect(event.payload.event_context.extraction_start).toBeUndefined();
      expect(event.payload.event_context.extraction_end).toBeUndefined();
    });

    it('should maintain existing deprecated extract_from and reset_extract_from fields', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extract_from: '2024-01-01T00:00:00Z',
          reset_extract_from: true,
        },
      });

      expect(event.payload.event_context.extract_from).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.reset_extract_from).toBe(true);
    });
  });

  describe('Enhanced protocol event context fields', () => {
    it('should support forward direction with absolute start and now end', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE,
            value: '2024-01-01T00:00:00Z',
          },
          extraction_end_time: {
            type: TimeValueType.NOW,
          },
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.FORWARD
      );
      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.ABSOLUTE
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.NOW
      );
    });

    it('should support historical direction with unbounded start', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.HISTORICAL,
          extraction_start_time: {
            type: TimeValueType.UNBOUNDED,
          },
          extraction_end_time: {
            type: TimeValueType.NOW,
          },
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.HISTORICAL
      );
      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.UNBOUNDED
      );
    });

    it('should support workers_newest for periodic forward sync', () => {
      const event = createEvent({
        eventType: EventType.ContinueExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
          extraction_start_time: {
            type: TimeValueType.WORKERS_NEWEST,
          },
          extraction_end_time: {
            type: TimeValueType.NOW,
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_NEWEST
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.NOW
      );
    });

    it('should support workers_oldest_minus_window for computer imports', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.HISTORICAL,
          extraction_start_time: {
            type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
            value: '7d',
          },
          extraction_end_time: {
            type: TimeValueType.WORKERS_OLDEST,
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_OLDEST_MINUS_WINDOW
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '7d'
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.WORKERS_OLDEST
      );
    });
  });

  describe('Real-world scenarios from Enhanced Control Protocol', () => {
    it('Scenario: Normal import - initial with unbounded start', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
          extraction_start_time: {
            type: TimeValueType.UNBOUNDED,
          },
          extraction_end_time: {
            type: TimeValueType.NOW,
          },
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.FORWARD
      );
      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.UNBOUNDED
      );
    });

    it('Scenario: Normal import - periodic sync from workers_newest to now', () => {
      const event = createEvent({
        eventType: EventType.ContinueExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
          extraction_start_time: {
            type: TimeValueType.WORKERS_NEWEST,
          },
          extraction_end_time: {
            type: TimeValueType.NOW,
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_NEWEST
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.NOW
      );
    });

    it('Scenario: POC import - from absolute date X to now', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE,
            value: '2024-06-01T00:00:00Z',
          },
          extraction_end_time: {
            type: TimeValueType.NOW,
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.ABSOLUTE
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '2024-06-01T00:00:00Z'
      );
    });

    it('Scenario: Reconciliation import - from Date X to Date Y', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE,
            value: '2024-01-01T00:00:00Z',
          },
          extraction_end_time: {
            type: TimeValueType.ABSOLUTE,
            value: '2024-03-31T23:59:59Z',
          },
        },
      });

      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.ABSOLUTE
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extraction_end_time?.type).toBe(
        TimeValueType.ABSOLUTE
      );
      expect(event.payload.event_context.extraction_end_time?.value).toBe(
        '2024-03-31T23:59:59Z'
      );
    });

    it('Scenario: Computer import - historical direction with window', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.HISTORICAL,
          extraction_start_time: {
            type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
            value: '2m',
          },
          extraction_end_time: {
            type: TimeValueType.WORKERS_OLDEST,
          },
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.HISTORICAL
      );
      expect(event.payload.event_context.extraction_start_time?.type).toBe(
        TimeValueType.WORKERS_OLDEST_MINUS_WINDOW
      );
      expect(event.payload.event_context.extraction_start_time?.value).toBe(
        '2m'
      );
    });
  });

  describe('Event context field placement', () => {
    it('extraction fields are nested under event_context, not at payload root', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE,
            value: '2024-02-01T00:00:00Z',
          },
          extraction_end_time: {
            type: TimeValueType.ABSOLUTE,
            value: '2024-02-29T23:59:59Z',
          },
        },
      });

      expect(event.payload.event_context).toHaveProperty(
        'extraction_start_time'
      );
      expect(event.payload.event_context).toHaveProperty('extraction_end_time');
      expect(event.payload.event_context).toHaveProperty(
        'extraction_time_direction'
      );

      const payloadKeys = Object.keys(event.payload);
      expect(payloadKeys).not.toContain('extraction_start_time');
      expect(payloadKeys).not.toContain('extraction_end_time');
      expect(payloadKeys).not.toContain('extraction_time_direction');
    });

    it('should work with all extraction event types', () => {
      const eventTypes = [
        EventType.StartExtractingData,
        EventType.ContinueExtractingData,
        EventType.StartExtractingMetadata,
        EventType.StartExtractingAttachments,
        EventType.ContinueExtractingAttachments,
      ];

      eventTypes.forEach((eventType) => {
        const event = createEvent({
          eventType,
          eventContextOverrides: {
            extraction_time_direction: ExtractionTimeDirection.FORWARD,
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE,
              value: '2024-01-01T00:00:00Z',
            },
            extraction_end_time: {
              type: TimeValueType.NOW,
            },
          },
        });

        expect(event.payload.event_context.extraction_time_direction).toBe(
          ExtractionTimeDirection.FORWARD
        );
      });
    });
  });
});
