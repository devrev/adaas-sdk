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
  STATEFUL_EXTRACTION_EVENT_TYPES,
} from '../common/constants';
import { SyncMode } from '../types/common';

describe(State.name, () => {
  let mockAdapter: MockAdapter;
  let fetchStateSpy: jest.SpyInstance;
  let postStateSpy: jest.SpyInstance;
  let initSpy: jest.SpyInstance;
  let installInitialDomainMappingSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    initSpy = jest.spyOn(State.prototype, 'init');
    fetchStateSpy = jest.spyOn(State.prototype, 'fetchState');
    postStateSpy = jest.spyOn(State.prototype, 'postState');
    installInitialDomainMappingSpy = jest.spyOn(
      require('../common/install-initial-domain-mapping'),
      'installInitialDomainMapping'
    );

    // Mock process.exit to prevent the test from actually exiting
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    mockAdapter = new MockAdapter(axiosClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockAdapter.restore();
  });

  describe('Stateless event types', () => {
    it.each(STATELESS_EVENT_TYPES)(
      'should not call init when event type is %s',
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
        expect(initSpy).not.toHaveBeenCalled();
      }
    );

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
      }
    );

    it.each(STATELESS_EVENT_TYPES)(
      'should not install IDM for stateless event type %s',
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
        expect(installInitialDomainMappingSpy).not.toHaveBeenCalled();
      }
    );
  });

  describe('Stateful event types', () => {
    it.each(STATEFUL_EVENT_TYPES)(
      'should call init when event type is %s',
      async (eventType) => {
        // Arrange
        const event = createEvent({
          eventType: eventType,
        });

        fetchStateSpy.mockResolvedValue('{}');

        // Act
        const result = await createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(initSpy).toHaveBeenCalled();
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

        fetchStateSpy.mockResolvedValue('{data: {state: null}}');

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
      'should create new state and post it if fetching the state returns 404',
      async (eventType) => {
        // Arrange
        const event = createEvent({
          eventType: eventType,
        });

        fetchStateSpy.mockRejectedValue({
          isAxiosError: true,
          response: { status: 404 },
        });

        postStateSpy.mockResolvedValue({
          success: true,
        });

        // Act & Assert
        const result = await createAdapterState({
          event,
          initialState: {
            test: 'test',
          },
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(fetchStateSpy).toHaveBeenCalled();
        expect(postStateSpy).toHaveBeenCalled();
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

        initSpy.mockImplementation(async function (
          this: State<any>,
          initialState: any
        ) {
          this.state = {
            ...initialState,
            snapInVersionId: '1.0.0',
          };
        });

        // Act
        const result = await createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
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
            snap_in_version_id: '2.0.0',
          },
        });

        initSpy.mockImplementation(async function (
          this: State<any>,
          initialState: any
        ) {
          this.state = {
            ...initialState,
            snapInVersionId: '1.0.0',
          };
        });

        // Act
        const result = await createAdapterState({
          event,
          initialState: {},
          initialDomainMapping: {},
        });

        // Assert
        expect(result).toBeInstanceOf(State);
        expect(installInitialDomainMappingSpy).toHaveBeenCalled();
      }
    );
  });
});
