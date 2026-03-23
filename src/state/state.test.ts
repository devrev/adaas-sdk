import {
  STATEFUL_EVENT_TYPES,
  STATELESS_EVENT_TYPES,
} from '../common/constants';
import { createEvent } from '../tests/test-helpers';
import { EventType, TimeValueType } from '../types/extraction';
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
      const event = createEvent({
        eventType: eventType,
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
      const event = createEvent({
        eventType: eventType,
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
      const event = createEvent({
        eventType: eventType,
      });
      fetchStateSpy.mockResolvedValue('invalid-json');
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
      const event = createEvent({
        eventType: eventType,
      });
      fetchStateSpy.mockResolvedValue(null);
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
      const event = createEvent({
        eventType: eventType,
        contextOverrides: {
          snap_in_version_id: '',
        },
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
    const event = createEvent({
      eventType: EventType.StartExtractingData,
      contextOverrides: {
        snap_in_version_id: '',
      },
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
      const event = createEvent({
        eventType: eventType,
      });

      fetchStateSpy.mockResolvedValue(
        JSON.stringify({
          test: 'test',
        })
      );
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
      const event = createEvent({
        eventType: eventType,
        contextOverrides: {
          snap_in_version_id: '1.0.0',
        },
      });

      const stringifiedState = JSON.stringify({
        test: 'test',
        snapInVersionId: '1.0.0',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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
      const event = createEvent({
        eventType: eventType,
        contextOverrides: {
          snap_in_version_id: '2.0.0',
        },
      });

      const stringifiedState = JSON.stringify({
        test: 'test',
        snapInVersionId: '1.0.0',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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
      // Arrange: WORKERS_OLDEST type but state has no workers_oldest
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_start_time: {
            type: TimeValueType.WORKERS_OLDEST,
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
        workers_oldest: '',
        workers_newest: '',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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
      // Arrange: WORKERS_NEWEST type but state has no workers_newest
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_start_time: {
            type: TimeValueType.UNBOUNDED,
          },
          extraction_end_time: {
            type: TimeValueType.WORKERS_NEWEST,
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
        workers_oldest: '',
        workers_newest: '',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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

  describe('Enhanced Control Protocol - extraction window validation', () => {
    it('should exit the process if extraction_start >= extraction_end', async () => {
      // Arrange: start is after end (inverted window)
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2025-06-01T00:00:00Z',
          },
          extraction_end_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2024-01-01T00:00:00Z',
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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

    it('should exit the process if extraction_start equals extraction_end', async () => {
      // Arrange: start equals end (zero-width window)
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2024-06-01T00:00:00Z',
          },
          extraction_end_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2024-06-01T00:00:00Z',
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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

    it('should not exit when extraction_start < extraction_end', async () => {
      // Arrange: valid window
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2024-01-01T00:00:00Z',
          },
          extraction_end_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2025-06-01T00:00:00Z',
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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

    it('should not validate when only extraction_start is set', async () => {
      // Arrange: only start, no end
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_start_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2024-01-01T00:00:00Z',
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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

    it('should not exit when extraction_start is UNBOUNDED and extraction_end is a real timestamp', async () => {
      // Arrange: UNBOUNDED start (epoch) with a real ABSOLUTE end timestamp
      const event = createEvent({
        eventType: EventType.StartExtractingData,
        eventContextOverrides: {
          extraction_start_time: {
            type: TimeValueType.UNBOUNDED,
          },
          extraction_end_time: {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2025-06-01T00:00:00Z',
          },
        },
      });

      const stringifiedState = JSON.stringify({
        snapInVersionId: 'test_snap_in_version_id',
      });
      fetchStateSpy.mockResolvedValue(stringifiedState);
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
});
