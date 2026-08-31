import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType, TimeValue, TimeValueType } from '../types/extraction';
import { State, createAdapterState } from './state';

describe('State — TimeValue resolution', () => {
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
    it('should prefer lastSuccessfulSyncStarted over the platform extract_from when no CPv2 start time is provided', async () => {
      // Arrange: CPv1.1 sends a concrete extract_from instead of a TimeValue.
      const platformExtractFrom = '2025-04-01T00:00:00.000Z';
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extract_from: platformExtractFrom,
          },
        },
      });

      fetchStateSpy.mockResolvedValue({
        state: JSON.stringify({
          snapInVersionId: 'test_snap_in_version_id',
          lastSuccessfulSyncStarted: '2025-05-01T00:00:00.000Z',
        }),
      });

      // Act
      const state = await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: the successful sync boundary takes precedence and is retained
      // for later phases.
      expect(event.payload.event_context.extract_from).toBe(
        '2025-05-01T00:00:00.000Z'
      );
      expect(state.state.pendingWorkersOldest).toBe('2025-05-01T00:00:00.000Z');
    });

    it('should use the platform extract_from when lastSuccessfulSyncStarted is not set', async () => {
      // Arrange: CPv1.1 sends a concrete extract_from instead of a TimeValue.
      const platformExtractFrom = '2025-04-01T00:00:00.000Z';
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extract_from: platformExtractFrom,
          },
        },
      });

      fetchStateSpy.mockResolvedValue({
        state: JSON.stringify({
          snapInVersionId: 'test_snap_in_version_id',
        }),
      });

      // Act
      const state = await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: the platform value is used and retained for later phases.
      expect(event.payload.event_context.extract_from).toBe(
        platformExtractFrom
      );
      expect(state.state.pendingWorkersOldest).toBe(platformExtractFrom);
    });

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

    it('should use lastSuccessfulSyncStarted for extract_from when extraction_start_time has no type', async () => {
      // Arrange: platform sends an empty extraction_start_time on a subsequent sync
      const lastSuccessfulSyncStarted = '2025-05-01T00:00:00.000Z';
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {} as TimeValue,
          },
        },
      });

      fetchStateSpy.mockResolvedValue({
        state: JSON.stringify({
          snapInVersionId: 'test_snap_in_version_id',
          lastSuccessfulSyncStarted,
        }),
      });

      // Act
      const state = await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: the fallback is also stored for the following data phase
      expect(event.payload.event_context.extract_from).toBe(
        lastSuccessfulSyncStarted
      );
      expect(state.state.pendingWorkersOldest).toBe(lastSuccessfulSyncStarted);
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
