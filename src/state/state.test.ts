import { State, createAdapterState } from './state';
import { EventType } from '../types/extraction';
import { createEvent } from '../tests/test-helpers';
import {
  STATELESS_EVENT_TYPES,
  STATEFUL_EVENT_TYPES,
} from '../common/constants';
import { extractionSdkState } from './state.interfaces';

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
      (eventType) => eventType !== EventType.ExtractionDataStart
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

  it(EventType.ExtractionDataStart, async () => {
    // Arrange
    const initialState = {
      test: 'test',
    };
    const event = createEvent({
      eventType: EventType.ExtractionDataStart,
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
});
