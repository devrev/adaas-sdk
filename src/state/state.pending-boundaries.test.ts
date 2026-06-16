import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../testing/mock-event';
import { EventType, TimeValueType } from '../types/extraction';
import { State, createAdapterState } from './state';

/* eslint-disable @typescript-eslint/no-require-imports */

const FIXED_NOW = '2026-03-26T10:00:00.000Z';

describe('State — pending extraction boundaries', () => {
  let postStateSpy: jest.SpyInstance;
  let fetchStateSpy: jest.SpyInstance;
  let installInitialDomainMappingSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    postStateSpy = jest.spyOn(State.prototype, 'postState');
    fetchStateSpy = jest.spyOn(State.prototype, 'fetchState');
    installInitialDomainMappingSpy = jest.spyOn(
      require('./install-initial-domain-mapping'),
      'installInitialDomainMapping'
    );
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    jest.useFakeTimers();
    jest.setSystemTime(new Date(FIXED_NOW));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should store resolved values in pendingWorkersOldest/pendingWorkersNewest on StartExtractingMetadata', async () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      context: {
        snap_in_version_id: '',
      },
      payload: {
        event_type: EventType.StartExtractingMetadata,
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

  it('should overwrite pending values on a retry (new StartExtractingMetadata after failure)', async () => {
    // Arrange: state has stale pending values from a previous failed attempt
    const staleOldest = '2026-03-25T08:00:00.000Z';
    const staleNewest = '2026-03-25T09:00:00.000Z';

    const event = createMockEvent(mockServer.baseUrl, {
      context: {
        snap_in_version_id: 'test_snap_in_version_id',
      },
      payload: {
        event_type: EventType.StartExtractingMetadata,
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
    // Arrange: state has pending values from a prior StartExtractingMetadata phase
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
    // Arrange: state has pending values from the StartExtractingMetadata phase
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
