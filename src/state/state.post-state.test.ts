import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType } from '../types/extraction';
import { State, createAdapterState } from './state';

/* eslint-disable @typescript-eslint/no-require-imports */

describe('State.postState', () => {
  let postStateSpy: jest.SpyInstance;
  let fetchStateSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    postStateSpy = jest.spyOn(State.prototype, 'postState');
    fetchStateSpy = jest.spyOn(State.prototype, 'fetchState');
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  it('should POST the stringified state to the update endpoint', async () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      context: {
        snap_in_version_id: '1.0.0',
        secrets: { service_account_token: 'test_token' },
      },
      payload: { event_type: EventType.StartExtractingData },
    });
    const stateToPost = { snapInVersionId: '1.0.0', foo: 'bar' };
    fetchStateSpy.mockResolvedValue({
      state: JSON.stringify({ snapInVersionId: '1.0.0' }),
    });

    postStateSpy.mockRestore();

    const adapterState = await createAdapterState({
      event,
      initialState: {},
      initialDomainMapping: {},
    });

    // Act
    await adapterState.postState(stateToPost as never);

    // Assert: the mock server records all incoming requests — inspect what was sent
    const requests = mockServer.getRequests('POST', '/worker_data_url.update');
    expect(requests).toHaveLength(1);

    const body = requests[0].body as { state: string };
    // Body must contain the stringified state, preserving the original fields
    expect(typeof body.state).toBe('string');
    const parsed = JSON.parse(body.state) as Record<string, unknown>;
    expect(parsed.foo).toBe('bar');
    expect(parsed.snapInVersionId).toBe('1.0.0');
  });

  it('should exit(1) when postState HTTP request fails', async () => {
    // Arrange
    const event = createMockEvent(mockServer.baseUrl, {
      context: { snap_in_version_id: '1.0.0' },
      payload: { event_type: EventType.StartExtractingData },
    });
    fetchStateSpy.mockResolvedValue({
      state: JSON.stringify({ snapInVersionId: '1.0.0' }),
    });

    postStateSpy.mockRestore();

    const adapterState = await createAdapterState({
      event,
      initialState: {},
      initialDomainMapping: {},
    });

    // Mock axiosClient.post directly to bypass the retry backoff
    const axiosClientModule = require('../http/axios-client-internal');
    const axiosPostSpy = jest
      .spyOn(axiosClientModule.axiosClient, 'post')
      .mockRejectedValue(new Error('network error'));

    // Act & Assert
    await expect(adapterState.postState()).rejects.toThrow(
      'process.exit called'
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    axiosPostSpy.mockRestore();
  });
});
