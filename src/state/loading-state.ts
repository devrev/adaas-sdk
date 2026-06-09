import { STATELESS_EVENT_TYPES } from '../common/constants';

import { BaseState } from './base-state';
import { loadingSdkState, StateInterface } from './state.interfaces';

/**
 * Per-mode adapter state for loading workers.
 *
 * Used to seed the loading SDK state (files-to-load bookkeeping) on top of the
 * shared lifecycle provided by `BaseState`. Loading has no extraction-window
 * resolution.
 *
 * @typeParam ConnectorState - the connector-owned state shape
 */
export class LoadingState<ConnectorState> extends BaseState<ConnectorState> {
  constructor(params: StateInterface<ConnectorState>) {
    super(params, loadingSdkState);
  }
}

/**
 * Creates and initializes a `LoadingState` for a loading worker.
 *
 * Used by the state dispatcher to build loading-mode state. The initial state is
 * deep-cloned to avoid mutating the caller's object; for non-stateless events
 * this fetches persisted state and installs the initial domain mapping if the
 * snap-in version changed.
 *
 * @param params - The state factory parameters of type StateInterface (event, initial connector state, optional domain mapping and worker options)
 * @returns Promise resolving to the initialized LoadingState
 */
export async function createLoadingState<ConnectorState>({
  event,
  initialState,
  initialDomainMapping,
  options,
}: StateInterface<ConnectorState>): Promise<LoadingState<ConnectorState>> {
  // Deep clone the initial state to avoid mutating the original state
  const deepCloneInitialState: ConnectorState = structuredClone(initialState);

  const state = new LoadingState<ConnectorState>({
    event,
    initialState: deepCloneInitialState,
    initialDomainMapping,
    options,
  });

  if (!STATELESS_EVENT_TYPES.includes(event.payload.event_type)) {
    await state.init(deepCloneInitialState);
    await state.installInitialDomainMappingIfNeeded(initialDomainMapping);
  }

  return state;
}
