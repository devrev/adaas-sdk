import {
  STATEFUL_EVENT_TYPES,
  STATELESS_EVENT_TYPES,
} from '../common/constants';
import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType, TimeValue, TimeValueType } from '../types/extraction';
import { State, createAdapterState } from './state';
import { extractionSdkState } from './state.interfaces';

/* eslint-disable @typescript-eslint/no-require-imports */

describe(State.name, () => {
  let initSpy: jest.SpyInstance;
  let postStateSpy: jest.SpyInstance;
  let fetchStateSpy: jest.SpyInstance;
  let installInitialDomainMappingSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    initSpy = jest.spyOn(State.prototype, 'init');
    postStateSpy = jest.spyOn(State.prototype, 'postState');
    fetchStateSpy = jest.spyOn(State.prototype, 'fetchState');
    installInitialDomainMappingSpy = jest.spyOn(
      require('../common/install-initial-domain-mapping'),
      'installInitialDomainMapping'
    );
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  it.each(STATELESS_EVENT_TYPES)(
    'should not init, fetch, post or install IDM for stateless event type %s',
    async (eventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: eventType },
      });

      // Act
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert
      expect(initSpy).not.toHaveBeenCalled();
      expect(fetchStateSpy).not.toHaveBeenCalled();
      expect(postStateSpy).not.toHaveBeenCalled();
      expect(installInitialDomainMappingSpy).not.toHaveBeenCalled();
    }
  );

  it.each(STATEFUL_EVENT_TYPES)(
    'should exit the process if fetching the state fails',
    async (eventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: eventType },
      });
      fetchStateSpy.mockRejectedValue({
        isAxiosError: true,
        response: { status: 500 },
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(
        createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        })
      ).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    }
  );

  it.each(STATEFUL_EVENT_TYPES)(
    'should exit the process if parsing the state fails',
    async (eventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: eventType },
      });
      fetchStateSpy.mockResolvedValue({ state: 'invalid-json' });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(
        createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        })
      ).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    }
  );

  it.each(STATEFUL_EVENT_TYPES)(
    'should exit the process if fetching is successful but there is no state in the response',
    async (eventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: eventType },
      });
      fetchStateSpy.mockResolvedValue({ state: null });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(
        createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        })
      ).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    }
  );

  it.each(
    STATEFUL_EVENT_TYPES.filter(
      (eventType) => eventType !== EventType.StartExtractingData
    )
  )(
    'should call post state with full adapter state if fetching returns 404 for event type %s',
    async (eventType) => {
      // Arrange
      const initialState = {
        test: 'test',
      };
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: '',
        },
        payload: { event_type: eventType },
      });
      fetchStateSpy.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404 },
      });
      installInitialDomainMappingSpy.mockResolvedValue({
        success: true,
      });
      postStateSpy.mockResolvedValue({
        success: true,
      });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await createAdapterState({
        event,
        initialState,
        initialDomainMapping: {},
      });

      const expectedState = {
        ...initialState,
        ...extractionSdkState,
      };
      expect(postStateSpy).toHaveBeenCalledWith(expectedState);
    }
  );

  it(EventType.StartExtractingData, async () => {
    // Arrange
    const initialState = {
      test: 'test',
    };
    const event = createMockEvent(mockServer.baseUrl, {
      context: {
        snap_in_version_id: '',
      },
      payload: { event_type: EventType.StartExtractingData },
    });
    fetchStateSpy.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    installInitialDomainMappingSpy.mockResolvedValue({
      success: true,
    });
    postStateSpy.mockResolvedValue({
      success: true,
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await createAdapterState({
      event,
      initialState,
      initialDomainMapping: {},
    });

    // Assert
    // Verify that post state is called with object that contains
    // lastSyncStarted which is not empty string
    expect(postStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSyncStarted: expect.not.stringMatching(/^$/),
      })
    );
  });

  it.each(STATEFUL_EVENT_TYPES)(
    'should exit the process if initialDomainMapping is not provided for event type %s',
    async (eventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: eventType },
      });

      fetchStateSpy.mockResolvedValue({
        state: JSON.stringify({
          test: 'test',
        }),
      });
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(
        createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: undefined,
        })
      ).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    }
  );

  it.each(STATEFUL_EVENT_TYPES)(
    'should not install IDM if version matches for event type %s',
    async (eventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: '1.0.0',
        },
        payload: { event_type: eventType },
      });

      const stringifiedState = JSON.stringify({
        test: 'test',
        snapInVersionId: '1.0.0',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act & Assert
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert
      expect(installInitialDomainMappingSpy).not.toHaveBeenCalled();
    }
  );

  it.each(STATEFUL_EVENT_TYPES)(
    'should install IDM if version does not match for event type %s',
    async (eventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: '2.0.0',
        },
        payload: { event_type: eventType },
      });

      const stringifiedState = JSON.stringify({
        test: 'test',
        snapInVersionId: '1.0.0',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });
      installInitialDomainMappingSpy.mockResolvedValue({
        success: true,
      });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert
      expect(installInitialDomainMappingSpy).toHaveBeenCalled();
    }
  );

  describe('Enhanced Control Protocol - TimeValue resolution failures', () => {
    it('should exit the process if extraction_start_time resolution fails', async () => {
      // Arrange: WORKERS_NEWEST type but state has no workersNewest
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});

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

  describe('Enhanced Control Protocol - extraction window validation', () => {
    it('should exit the process if extract_from >= extract_to', async () => {
      // Arrange: start is after end (inverted window)
      const event = createMockEvent(mockServer.baseUrl, {
        payload: {
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});

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
          event_type: EventType.StartExtractingData,
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
      jest.spyOn(console, 'log').mockImplementation(() => {});

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

  describe('Pending extraction boundaries (pendingWorkersOldest/pendingWorkersNewest)', () => {
    const FIXED_NOW = '2026-03-26T10:00:00.000Z';

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(FIXED_NOW));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should store resolved values in pendingWorkersOldest/pendingWorkersNewest on StartExtractingData', async () => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: '',
        },
        payload: {
          event_type: EventType.StartExtractingData,
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

      fetchStateSpy.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404 },
      });
      installInitialDomainMappingSpy.mockResolvedValue({ success: true });
      postStateSpy.mockResolvedValue({ success: true });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      const state = await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert
      expect(state.state.pendingWorkersOldest).toBe('1970-01-01T00:00:00.000Z');
      expect(state.state.pendingWorkersNewest).toBe(FIXED_NOW);
      expect(event.payload.event_context.extract_from).toBe(
        '1970-01-01T00:00:00.000Z'
      );
      expect(event.payload.event_context.extract_to).toBe(FIXED_NOW);
    });

    it('should overwrite pending values on a retry (new StartExtractingData after failure)', async () => {
      // Arrange: state has stale pending values from a previous failed attempt
      const staleOldest = '2026-03-25T08:00:00.000Z';
      const staleNewest = '2026-03-25T09:00:00.000Z';

      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.StartExtractingData,
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

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
        pendingWorkersOldest: staleOldest,
        pendingWorkersNewest: staleNewest,
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      const state = await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: pending values are overwritten with fresh resolution, not stale values
      expect(state.state.pendingWorkersOldest).toBe('1970-01-01T00:00:00.000Z');
      expect(state.state.pendingWorkersNewest).toBe(FIXED_NOW);
      expect(state.state.pendingWorkersNewest).not.toBe(staleNewest);
    });

    it('should reuse pending values from state on ContinueExtractingData instead of re-resolving', async () => {
      // Arrange: state has pending values from a prior StartExtractingData phase
      const pendingOldest = '1970-01-01T00:00:00.000Z';
      const pendingNewest = '2026-03-26T08:00:00.000Z'; // Earlier than FIXED_NOW

      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: {
          event_type: EventType.ContinueExtractingData,
          event_context: {
            // Platform still sends TimeValue objects, but they should be ignored
            extraction_start_time: {
              type: TimeValueType.CURRENT_TIME,
            },
            extraction_end_time: {
              type: TimeValueType.CURRENT_TIME,
            },
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
        pendingWorkersOldest: pendingOldest,
        pendingWorkersNewest: pendingNewest,
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      const state = await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: uses cached pending values, NOT new Date() resolution
      expect(event.payload.event_context.extract_from).toBe(pendingOldest);
      expect(event.payload.event_context.extract_to).toBe(pendingNewest);
      // Pending values in state remain unchanged
      expect(state.state.pendingWorkersOldest).toBe(pendingOldest);
      expect(state.state.pendingWorkersNewest).toBe(pendingNewest);
    });

    it('should not set extract_from/extract_to on ContinueExtractingData if no pending values exist', async () => {
      // Arrange: state has no pending values (e.g. old state from before this feature)
      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: { event_type: EventType.ContinueExtractingData },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: no extraction timestamps are set
      expect(event.payload.event_context.extract_from).toBeUndefined();
      expect(event.payload.event_context.extract_to).toBeUndefined();
    });

    it('should reuse pending values on StartExtractingAttachments', async () => {
      // Arrange: state has pending values from the StartExtractingData phase
      const pendingOldest = '1970-01-01T00:00:00.000Z';
      const pendingNewest = '2026-03-26T08:00:00.000Z';

      const event = createMockEvent(mockServer.baseUrl, {
        context: {
          snap_in_version_id: 'test_snap_in_version_id',
        },
        payload: { event_type: EventType.StartExtractingAttachments },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
        pendingWorkersOldest: pendingOldest,
        pendingWorkersNewest: pendingNewest,
      });
      fetchStateSpy.mockResolvedValue({ state: stringifiedState });
      jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: {},
      });

      // Assert: pending values are reused
      expect(event.payload.event_context.extract_from).toBe(pendingOldest);
      expect(event.payload.event_context.extract_to).toBe(pendingNewest);
    });
  });

  it('should populate extractionScope from API response', async () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      context: {
        snap_in_version_id: '1.0.0',
      },
      payload: { event_type: EventType.StartExtractingData },
    });
    fetchStateSpy.mockResolvedValue({
      state: JSON.stringify({ snapInVersionId: '1.0.0' }),
      objects: JSON.stringify({
        tasks: { extract: true },
        users: { extract: true },
      }),
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const result = await createAdapterState({
      event,
      initialState: {},
      initialDomainMapping: {},
    });

    // Assert
    expect(result.extractionScope).toEqual({
      tasks: { extract: true },
      users: { extract: true },
    });
  });

  it('should have empty extractionScope on 404', async () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      context: {
        snap_in_version_id: '',
      },
      payload: { event_type: EventType.StartExtractingMetadata },
    });
    fetchStateSpy.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    installInitialDomainMappingSpy.mockResolvedValue({ success: true });
    postStateSpy.mockResolvedValue({ success: true });
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const result = await createAdapterState({
      event,
      initialState: {},
      initialDomainMapping: {},
    });

    // Assert
    expect(result.extractionScope).toEqual({});
  });

  it('should have empty extractionScope for stateless events', async () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingExternalSyncUnits },
    });

    // Act
    const result = await createAdapterState({
      event,
      initialState: {},
      initialDomainMapping: {},
    });

    // Assert
    expect(result.extractionScope).toEqual({});
  });
});
