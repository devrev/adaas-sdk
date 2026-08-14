import { STATELESS_EVENT_TYPES } from '../common/constants';

import { BaseState } from './base-state';
import { loadingSdkState, StateInterface } from './state.interfaces';

/** State for loading workers: seeds loading SDK state; no extraction-window resolution. */
export class LoadingState<ConnectorState> extends BaseState<ConnectorState> {
  constructor(params: StateInterface<ConnectorState>) {
    super(params, loadingSdkState);
  }
}

export async function createLoadingState<ConnectorState>({
  event,
  initialState,
  initialDomainMapping,
  options,
}: StateInterface<ConnectorState>): Promise<LoadingState<ConnectorState>> {
  // Clone so the caller's initialState is never mutated.
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
