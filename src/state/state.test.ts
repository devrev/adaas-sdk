import {
  STATEFUL_EVENT_TYPES,
  STATELESS_EVENT_TYPES,
} from '../common/constants';
import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType } from '../types/extraction';
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

  it('should warn but continue when objects field contains invalid JSON', async () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      context: { snap_in_version_id: '1.0.0' },
      payload: { event_type: EventType.StartExtractingData },
    });
    fetchStateSpy.mockResolvedValue({
      state: JSON.stringify({ snapInVersionId: '1.0.0' }),
      objects: 'NOT_VALID_JSON',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const result = await createAdapterState({
      event,
      initialState: {},
      initialDomainMapping: {},
    });

    // Assert: should not crash, extractionScope is empty (default)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse extractionScope')
    );
    expect(result.extractionScope).toEqual({});
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
