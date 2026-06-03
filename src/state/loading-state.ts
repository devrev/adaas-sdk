import { STATELESS_EVENT_TYPES } from '../common/constants';

import { BaseState } from './base-state';
import {
  initialLoadingSdkState,
  LoadingSdkState,
  StateInterface,
} from './state.interfaces';

/**
 * LoadingState is the per-mode state for loading workers. It narrows `sdkState`
 * to `LoadingSdkState` (files-to-load bookkeeping) on top of the shared
 * lifecycle provided by `BaseState`.
 */
export class LoadingState<ConnectorState> extends BaseState<
  ConnectorState,
  LoadingSdkState
> {
  constructor(params: StateInterface<ConnectorState>) {
    super(params, initialLoadingSdkState);
  }
}

/**
 * Creates and initializes a `LoadingState` for a loading worker.
 *
 * For non-stateless events this fetches/migrates persisted state and installs
 * the initial domain mapping if the snap-in version changed. Loading has no
 * extraction-window resolution, so the factory is otherwise minimal.
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
