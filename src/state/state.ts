import { SyncMode } from '../types/common';

import { BaseState } from './base-state';
import { createExtractionState } from './extraction-state';
import { createLoadingState } from './loading-state';
import { StateInterface } from './state.interfaces';

export { BaseState } from './base-state';
export { ExtractionState, createExtractionState } from './extraction-state';
export { LoadingState, createLoadingState } from './loading-state';

/**
 * Creates and initializes the adapter state for the current worker.
 *
 * Used as the single entry point that dispatches to either `createLoadingState`
 * or `createExtractionState` based on `event.payload.event_context.mode`.
 *
 * @param params - The state factory parameters of type StateInterface (event, initial state, optional domain mapping and worker options)
 * @returns Promise resolving to the initialized mode-specific state (LoadingState when mode is LOADING, otherwise ExtractionState)
 */
export async function createAdapterState<ConnectorState>(
  params: StateInterface<ConnectorState>
): Promise<BaseState<ConnectorState>> {
  if (params.event.payload.event_context.mode === SyncMode.LOADING) {
    return createLoadingState<ConnectorState>(params);
  }
  return createExtractionState<ConnectorState>(params);
}
