import { createEvent } from './test-helpers';
import {
  EventType,
  ExtractionTimeDirection,
  InitialSyncScope,
} from '../types/extraction';

describe('Control Protocol - Reconciliation Mode', () => {
  describe('ExtractionTimeDirection enum values', () => {
    it('should have the correct string value for RECONCILIATION', () => {
      expect(ExtractionTimeDirection.RECONCILIATION).toBe('reconciliation');
    });

    it('should have the correct string value for BACKWARD', () => {
      expect(ExtractionTimeDirection.BACKWARD).toBe('backward');
    });

    it('should have the correct string value for FORWARD', () => {
      expect(ExtractionTimeDirection.FORWARD).toBe('forward');
    });

    it('should have exactly three direction values', () => {
      const values = Object.values(ExtractionTimeDirection);
      expect(values).toHaveLength(3);
      expect(values).toContain('reconciliation');
      expect(values).toContain('backward');
      expect(values).toContain('forward');
    });
  });

  describe('Backward compatibility', () => {
    it('should work with events that do not use reconciliation fields', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
      });

      expect(event.payload.event_context).toBeDefined();
      expect(
        event.payload.event_context.extraction_time_direction
      ).toBeUndefined();
      expect(
        event.payload.event_context.extraction_range_start
      ).toBeUndefined();
      expect(event.payload.event_context.extraction_range_end).toBeUndefined();
    });

    it('should maintain existing extract_from and reset_extract_from fields', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extract_from: '2024-01-01T00:00:00Z',
          reset_extract_from: true,
          initial_sync_scope: InitialSyncScope.TIME_SCOPED,
        },
      });

      expect(event.payload.event_context.extract_from).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.reset_extract_from).toBe(true);
      expect(event.payload.event_context.initial_sync_scope).toBe(
        InitialSyncScope.TIME_SCOPED
      );
    });
  });

  describe('Reconciliation mode scenarios', () => {
    it('should support reconciliation for specific month range', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.RECONCILIATION,
          extraction_range_start: '2024-01-01T00:00:00Z',
          extraction_range_end: '2024-01-31T23:59:59Z',
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.RECONCILIATION
      );
      expect(event.payload.event_context.extraction_range_start).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extraction_range_end).toBe(
        '2024-01-31T23:59:59Z'
      );
    });

    it('should support reconciliation for full historical range', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.RECONCILIATION,
          extraction_range_start: '2000-01-01T00:00:00Z',
          extraction_range_end: '2026-02-17T23:59:59Z',
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.RECONCILIATION
      );
      expect(event.payload.event_context.extraction_range_start).toBe(
        '2000-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extraction_range_end).toBe(
        '2026-02-17T23:59:59Z'
      );
    });

    it('should support forward direction for incremental extraction', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.FORWARD
      );
      expect(
        event.payload.event_context.extraction_range_start
      ).toBeUndefined();
      expect(event.payload.event_context.extraction_range_end).toBeUndefined();
    });

    it('should support backward direction for historical extraction', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.BACKWARD,
        },
      });

      expect(event.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.BACKWARD
      );
      expect(
        event.payload.event_context.extraction_range_start
      ).toBeUndefined();
      expect(event.payload.event_context.extraction_range_end).toBeUndefined();
    });
  });

  describe('Real-world scenarios from Control Protocol', () => {
    it('Scenario: POC with re-extraction after discovering data gap', () => {
      // Initial backward import
      const initialEvent = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.BACKWARD,
        },
      });

      expect(initialEvent.payload.event_context.extraction_time_direction).toBe(
        ExtractionTimeDirection.BACKWARD
      );

      // Later: Found data gap in Jan-Mar 2024, re-extract with reconciliation
      const reconciliationEvent = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.RECONCILIATION,
          extraction_range_start: '2024-01-01T00:00:00Z',
          extraction_range_end: '2024-03-31T23:59:59Z',
        },
      });

      expect(
        reconciliationEvent.payload.event_context.extraction_time_direction
      ).toBe(ExtractionTimeDirection.RECONCILIATION);
      expect(
        reconciliationEvent.payload.event_context.extraction_range_start
      ).toBe('2024-01-01T00:00:00Z');
      expect(
        reconciliationEvent.payload.event_context.extraction_range_end
      ).toBe('2024-03-31T23:59:59Z');
    });

    it('Scenario: Connector bug caused data loss, reconcile affected period', () => {
      const bugReconciliationEvent = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.RECONCILIATION,
          extraction_range_start: '2024-02-15T00:00:00Z',
          extraction_range_end: '2024-02-20T23:59:59Z',
        },
      });

      expect(
        bugReconciliationEvent.payload.event_context.extraction_time_direction
      ).toBe(ExtractionTimeDirection.RECONCILIATION);
      expect(
        bugReconciliationEvent.payload.event_context.extraction_range_start
      ).toBe('2024-02-15T00:00:00Z');
      expect(
        bugReconciliationEvent.payload.event_context.extraction_range_end
      ).toBe('2024-02-20T23:59:59Z');
    });

    it('Scenario: Regular periodic forward sync (incremental)', () => {
      const periodicEvent = createEvent({
        eventType: EventType.ContinueExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.FORWARD,
        },
      });

      expect(
        periodicEvent.payload.event_context.extraction_time_direction
      ).toBe(ExtractionTimeDirection.FORWARD);
      // Forward incremental syncs don't have range fields
      expect(
        periodicEvent.payload.event_context.extraction_range_start
      ).toBeUndefined();
      expect(
        periodicEvent.payload.event_context.extraction_range_end
      ).toBeUndefined();
    });
  });

  describe('Edge cases and validation scenarios', () => {
    it('[edge] should handle reconciliation without extraction_time_direction explicitly set', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_range_start: '2024-01-01T00:00:00Z',
          extraction_range_end: '2024-01-31T23:59:59Z',
        },
      });

      // Fields present even without explicit direction
      expect(event.payload.event_context.extraction_range_start).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(event.payload.event_context.extraction_range_end).toBe(
        '2024-01-31T23:59:59Z'
      );
    });

    it('[edge] should allow partial reconciliation fields', () => {
      const eventWithOnlyStart = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_range_start: '2024-01-01T00:00:00Z',
        },
      });

      expect(
        eventWithOnlyStart.payload.event_context.extraction_range_start
      ).toBe('2024-01-01T00:00:00Z');
      expect(
        eventWithOnlyStart.payload.event_context.extraction_range_end
      ).toBeUndefined();

      const eventWithOnlyEnd = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_range_end: '2024-01-31T23:59:59Z',
        },
      });

      expect(eventWithOnlyEnd.payload.event_context.extraction_range_end).toBe(
        '2024-01-31T23:59:59Z'
      );
      expect(
        eventWithOnlyEnd.payload.event_context.extraction_range_start
      ).toBeUndefined();
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
            extraction_time_direction: ExtractionTimeDirection.RECONCILIATION,
            extraction_range_start: '2024-01-01T00:00:00Z',
            extraction_range_end: '2024-01-31T23:59:59Z',
          },
        });

        expect(event.payload.event_context.extraction_time_direction).toBe(
          ExtractionTimeDirection.RECONCILIATION
        );
      });
    });

    it('range fields are nested under event_context, not at payload root', () => {
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_time_direction: ExtractionTimeDirection.RECONCILIATION,
          extraction_range_start: '2024-02-01T00:00:00Z',
          extraction_range_end: '2024-02-29T23:59:59Z',
        },
      });

      expect(event.payload.event_context).toHaveProperty(
        'extraction_range_start'
      );
      expect(event.payload.event_context).toHaveProperty(
        'extraction_range_end'
      );
      expect(event.payload.event_context).toHaveProperty(
        'extraction_time_direction'
      );

      const payloadKeys = Object.keys(event.payload);
      expect(payloadKeys).not.toContain('extraction_range_start');
      expect(payloadKeys).not.toContain('extraction_range_end');
      expect(payloadKeys).not.toContain('extraction_time_direction');
    });
  });
});
