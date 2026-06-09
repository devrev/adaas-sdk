import { SyncMode } from '../types/common';

import { BaseState } from './base-state';
import { createExtractionState } from './extraction-state';
import { createLoadingState } from './loading-state';
import { StateInterface } from './state.interfaces';

export { BaseState } from './base-state';
export { ExtractionState, createExtractionState } from './extraction-state';
export { LoadingState, createLoadingState } from './loading-state';

/**
 * Creates and initializes the adapter state for the current worker, dispatching
 * to the extraction or loading state based on the event's sync mode.
 *
 * @param params The state factory parameters (event, initial state, options)
 * @returns The initialized mode-specific state
 */
export async function createAdapterState<ConnectorState>(
  params: StateInterface<ConnectorState>
): Promise<BaseState<ConnectorState>> {
  if (params.event.payload.event_context.mode === SyncMode.LOADING) {
    return createLoadingState<ConnectorState>(params);
  }
  return createExtractionState<ConnectorState>(params);
}
