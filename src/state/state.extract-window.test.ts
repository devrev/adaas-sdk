import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType, TimeValueType } from '../types/extraction';
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

  describe('Enhanced Control Protocol - extraction window validation', () => {
    it('should exit the process if extract_from >= extract_to', async () => {
      // Arrange: start is after end (inverted window)
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2025-06-01T00:00:00Z',
            },
            extraction_end_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-01-01T00:00:00Z',
            },
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
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

    it('should exit the process if extract_from equals extract_to', async () => {
      // Arrange: start equals end (zero-width window)
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-06-01T00:00:00Z',
            },
            extraction_end_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-06-01T00:00:00Z',
            },
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
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

    it('should not exit when extract_from < extract_to', async () => {
      // Arrange: valid window
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-01-01T00:00:00Z',
            },
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
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: process.exit should NOT have been called
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should not validate when only extract_from is set', async () => {
      // Arrange: only start, no end
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.ABSOLUTE_TIME,
              value: '2024-01-01T00:00:00Z',
            },
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

      // Assert: process.exit should NOT have been called
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should not exit when extract_from is UNBOUNDED and extract_to is a real timestamp', async () => {
      // Arrange: UNBOUNDED start (epoch) with a real ABSOLUTE end timestamp
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingMetadata,
          event_context: {
            extraction_start_time: {
              type: TimeValueType.UNBOUNDED,
            },
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
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: process.exit should NOT have been called
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });
});
