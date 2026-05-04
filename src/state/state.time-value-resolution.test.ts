import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType, TimeValue, TimeValueType } from '../types/extraction';
import { State, createAdapterState } from './state';

describe(State.name, () => {
  let fetchStateSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    fetchStateSpy = jest.spyOn(State.prototype, 'fetchState');
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  describe('Enhanced Control Protocol - TimeValue resolution failures', () => {
    it('should exit the process if extraction_start_time resolution fails', async () => {
      // Arrange: WORKERS_NEWEST type but state has no workersNewest
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.WORKERS_NEWEST,
            },
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
        workers_oldest: '',
        workers_newest: '',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });

      // Act & Assert
      await expect(
        createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        })
      ).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit the process if extraction_end_time resolution fails', async () => {
      // Arrange: WORKERS_NEWEST type but state has no workersNewest
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.UNBOUNDED,
            },
            extraction_end_time: {
              type: TimeValueType.WORKERS_NEWEST,
            },
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
        workers_oldest: '',
        workers_newest: '',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });

      // Act & Assert
      await expect(
        createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        })
      ).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Backwards compatibility - missing TimeValue type', () => {
    it('should skip resolution when extraction_start_time has no type', async () => {
      // Arrange: platform sends extraction_start_time without a type field (old platform version)
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {} as unknown as TimeValue,
            extraction_end_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2025-06-01T00:00:00Z',
            },
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });

      // Act
      const state = await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: should not crash, extract_from is not set, extract_to is resolved
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(event.payload.event_context.extract_from).toBeUndefined();
      expect(event.payload.event_context.extract_to).toBe(
        '2025-06-01T00:00:00.000Z'
      );
      expect(state.state.pendingWorkersNewest).toBe('2025-06-01T00:00:00.000Z');
    });

    it('should skip resolution when extraction_end_time has no type', async () => {
      // Arrange: platform sends extraction_end_time without a type field
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-01-01T00:00:00Z',
            },
            extraction_end_time: {} as unknown as TimeValue,
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });

      // Act
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: should not crash, extract_to is not set, extract_from is resolved
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(event.payload.event_context.extract_from).toBe(
        '2024-01-01T00:00:00.000Z'
      );
      expect(event.payload.event_context.extract_to).toBeUndefined();
    });

    it('should skip resolution when both extraction times have no type', async () => {
      // Arrange: platform sends both time values without type fields
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              value: 'some-value',
            } as unknown as TimeValue,
            extraction_end_time: {
              value: 'some-value',
            } as unknown as TimeValue,
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });

      // Act
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: should not crash, neither extraction time is resolved
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(event.payload.event_context.extract_from).toBeUndefined();
      expect(event.payload.event_context.extract_to).toBeUndefined();
    });
  });
});
