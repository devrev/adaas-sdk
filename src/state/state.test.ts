import MockAdapter from 'axios-mock-adapter';
import { State, createAdapterState } from './state';
import { axiosClient } from '../http/axios-client-internal';
import { EventType } from '../types/extraction';
import { createEvent } from '../tests/test-helpers';
import {
  STATELESS_EVENT_TYPES,
  STATELESS_EXTRACTION_EVENT_TYPES,
  STATELESS_LOADING_EVENT_TYPES,
  STATEFUL_EVENT_TYPES,
} from '../common/constants';
import { SyncMode } from '../types/common';

describe(createAdapterState.name, () => {
  let mockAdapter: MockAdapter;
  let fetchStateSpy: jest.SpyInstance;
  let postStateSpy: jest.SpyInstance;
  let installInitialDomainMappingSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    fetchStateSpy = jest.spyOn(State.prototype, 'fetchState');
    postStateSpy = jest.spyOn(State.prototype, 'postState');
    installInitialDomainMappingSpy = jest.spyOn(
      require('../common/install-initial-domain-mapping'),
      'installInitialDomainMapping'
    );

    mockAdapter = new MockAdapter(axiosClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockAdapter.restore();
  });

  it('should exit with code 1 when initialDomainMapping is not provided', async () => {
    // Arrange
    const event = createEvent({
      eventType: EventType.ExtractionDataStart,
    });

    // Mock process.exit to prevent actual exit and capture the call
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Act & Assert
    await expect(
      createAdapterState({
        event,
        initialState: {},
        initialDomainMapping: undefined,
      })
    ).rejects.toThrow('process.exit called');

    expect(mockExit).toHaveBeenCalledWith(1);

    // Clean up
    mockExit.mockRestore();
  });

  describe('Stateless event types', () => {
    it.each(STATELESS_EVENT_TYPES)(
      'should not make any state fetches for stateless event type %s',
      async (eventType) => {
        // Arrange
        const event = createEvent({
          eventType: eventType,
        });

        // Act
        const result = await createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(fetchStateSpy).not.toHaveBeenCalled();
        expect(postStateSpy).not.toHaveBeenCalled();
        expect(installInitialDomainMappingSpy).not.toHaveBeenCalled();
      }
    );

    it.each(STATELESS_EXTRACTION_EVENT_TYPES)(
      'should return state which wraps sdk state around initial state when event type is %s and sync direction is initial',
      async (eventType) => {
        // Arrange
        const event = createEvent({
          eventType: eventType,
          eventContextOverrides: {
            mode: SyncMode.INITIAL,
          },
        });

        // Act
        const result = await createAdapterState({
          event,
          initialState: {
            'test-field': 'test-value',
          },
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(result.state).toEqual({
          'test-field': 'test-value',
          snapInVersionId: '',
          toDevRev: {
            attachmentsMetadata: {
              artifactIds: [],
              lastProcessed: 0,
              lastProcessedAttachmentsIdsList: [],
            },
          },
          lastSyncStarted: '',
          lastSuccessfulSyncStarted: '',
        });
      }
    );
  });

  it.each(STATELESS_LOADING_EVENT_TYPES)(
    'should return state which wraps sdk state around initial state when event type is %s and sync direction is loading',
    async (eventType) => {
      // Arrange
      const event = createEvent({
        eventType: eventType,
        eventContextOverrides: {
          mode: SyncMode.LOADING,
        },
      });

      // Act
      const result = await createAdapterState({
        event,
        initialState: {
          'test-field': 'test-value',
        },
        initialDomainMapping: {},
      });

      expect(result).toBeInstanceOf(State);
      expect(result.state).toEqual({
        'test-field': 'test-value',
        snapInVersionId: '',
        fromDevRev: {
          filesToLoad: [],
        },
      });
    }
  );

  describe('Stateful event types', () => {
    it.each(STATEFUL_EVENT_TYPES)(
      'should make state fetch when event type is %s and sync direction is %s',
      async (eventType) => {
        // Arrange
        const event = createEvent({
          eventType: eventType,
        });
        fetchStateSpy.mockResolvedValue({
          data: {
            state: {},
          },
        });
        installInitialDomainMappingSpy.mockResolvedValue({
          success: true,
        });

        // Act
        const result = await createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(fetchStateSpy).toHaveBeenCalled();
      }
    );

    it.each(STATEFUL_EVENT_TYPES)(
      'should not install IDM when snap-in version matches for event type %s',
      async (eventType) => {
        // Arrange
        const event = createEvent({
          eventType: eventType,
          contextOverrides: {
            snap_in_version_id: '1.0.0',
          },
        });

        fetchStateSpy.mockImplementation(async function (
          this: State<any>,
          initialState: any
        ) {
          this.state = {
            ...initialState,
            snapInVersionId: '1.0.0',
          };
          return this.state;
        });

        // Act
        const result = await createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(fetchStateSpy).toHaveBeenCalled();
        expect(installInitialDomainMappingSpy).not.toHaveBeenCalled();
      }
    );

    it.each(STATEFUL_EVENT_TYPES)(
      'should install IDM when snap-in version differs for event type %s',
      async (eventType) => {
        // Arrange
        const event = createEvent({
          eventType: eventType,
          contextOverrides: {
            snap_in_version_id: '1.0.0',
          },
        });

        fetchStateSpy.mockImplementation(async function (
          this: State<any>,
          initialState: any
        ) {
          this.state = {
            ...initialState,
            snapInVersionId: '2.0.0',
          };
          return this.state;
        });

        installInitialDomainMappingSpy.mockResolvedValue({
          success: true,
        });

        // Act
        const result = await createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(fetchStateSpy).toHaveBeenCalled();
        expect(installInitialDomainMappingSpy).toHaveBeenCalled();
      }
    );
  });

  // TODO: Test createAdapterState with 404 state fetch (initial state creation)
  // TODO: Test createAdapterState with IDM installation when snap-in version differs
  // TODO: Test createAdapterState with IDM installation when snap-in version matches
  // TODO: Test createAdapterState with IDM installation error handling
  // TODO: Test createAdapterState setting lastSyncStarted for ExtractionDataStart events
  // TODO: Test createAdapterState with missing initial domain mapping
  // TODO: Test createAdapterState with different sync modes (LOADING vs others)
  // TODO: [edge] Test createAdapterState with null/undefined initialState
  // TODO: [edge] Test createAdapterState with malformed event structure
});

describe(State.name, () => {
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter = new MockAdapter(axiosClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockAdapter.restore();
  });

  it('should initialize State instance correctly', () => {
    // Arrange
    const event = createEvent({
      eventType: EventType.ExtractionDataStart,
    });
    const initialState = { customField: 'test-value' };

    // Act
    const state = new State({ event, initialState });

    // Assert
    expect(state).toBeInstanceOf(State);
    expect(state.state).toEqual(
      expect.objectContaining({
        customField: 'test-value',
        lastSyncStarted: '',
        lastSuccessfulSyncStarted: '',
        snapInVersionId: '',
      })
    );
  });

  // TODO: Test State constructor with LOADING sync mode
  // TODO: Test State constructor with non-LOADING sync mode
  // TODO: Test State getter returns correct state
  // TODO: Test State setter updates state correctly
  // TODO: Test postState with successful update
  // TODO: Test postState with custom state parameter
  // TODO: Test postState with axios error handling and process.exit
  // TODO: Test fetchState with successful response
  // TODO: Test fetchState with 404 response (creates initial state)
  // TODO: Test fetchState with other axios errors and process.exit
  // TODO: Test fetchState state parsing and logging
  // TODO: [edge] Test postState with null/undefined state
  // TODO: [edge] Test fetchState with malformed JSON response
  // TODO: [edge] Test State constructor with missing event properties
  // TODO: [edge] Test State methods with invalid worker URL or token
});
