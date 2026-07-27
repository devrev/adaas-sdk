import { parentPort } from 'node:worker_threads';

import { STATELESS_EVENT_TYPES } from '../common/constants';
import { serializeError } from '../logger/logger';
import { EventType } from '../types/extraction';
import { WorkerMessageSubject } from '../types/workers';

import { BaseState } from './base-state';
import { extractionSdkState, StateInterface } from './state.interfaces';
import { resolveTimeValue } from './time-value-resolver';

/** State for extraction workers: seeds extraction SDK state and adds extraction-window resolution. */
export class ExtractionState<ConnectorState> extends BaseState<ConnectorState> {
  constructor(params: StateInterface<ConnectorState>) {
    super(params, extractionSdkState);
  }

  /**
   * Resolves the extraction window onto the event context. StartExtractingMetadata
   * resolves fresh from the event's TimeValues and overwrites the pending boundaries;
   * all other events reuse those cached boundaries. Validates extract_from < extract_to.
   */
  resolveExtractionWindow(): void {
    const sdkState = this.sdkState;

    const eventContext = this.event.payload.event_context;

    if (this.event.payload.event_type === EventType.StartExtractingMetadata) {
      const timeFields = [
        {
          source: 'extraction_start_time',
          target: 'extract_from',
          pending: 'pendingWorkersOldest',
        },
        {
          source: 'extraction_end_time',
          target: 'extract_to',
          pending: 'pendingWorkersNewest',
        },
      ] as const;

      for (const { source, target, pending } of timeFields) {
        const timeValue = eventContext[source];
        if (timeValue && timeValue.type) {
          try {
            const resolved = resolveTimeValue(timeValue, sdkState);
            eventContext[target] = resolved;
            sdkState[pending] = resolved;
            console.log(
              `Resolved ${target} to ${resolved}. Stored in ${pending}.`
            );
          } catch (error) {
            const errorMessage = `Failed to resolve ${source}: ${serializeError(
              error
            )}`;
            console.error(errorMessage);
            parentPort?.postMessage({
              subject: WorkerMessageSubject.WorkerMessageFailed,
              payload: { message: errorMessage },
            });
            process.exit(1);
          }
        }
      }
    } else {
      if (sdkState.pendingWorkersOldest) {
        eventContext.extract_from = sdkState.pendingWorkersOldest;
        console.log(
          `Reusing pendingWorkersOldest as extract_from: ${sdkState.pendingWorkersOldest}.`
        );
      } else {
        console.log(
          'pendingWorkersOldest is not set in state. extract_from will not be populated for this invocation.'
        );
      }
      if (sdkState.pendingWorkersNewest) {
        eventContext.extract_to = sdkState.pendingWorkersNewest;
        console.log(
          `Reusing pendingWorkersNewest as extract_to: ${sdkState.pendingWorkersNewest}.`
        );
      } else {
        console.log(
          'pendingWorkersNewest is not set in state. extract_to will not be populated for this invocation.'
        );
      }
    }

    if (eventContext.extract_from && eventContext.extract_to) {
      if (eventContext.extract_from >= eventContext.extract_to) {
        const errorMessage = `Invalid extraction window: extract_from (${eventContext.extract_from}) must be older than extract_to (${eventContext.extract_to}). This indicates an error in the platform.`;
        console.error(errorMessage);
        parentPort?.postMessage({
          subject: WorkerMessageSubject.WorkerMessageFailed,
          payload: { message: errorMessage },
        });
        process.exit(1);
      }
    }
  }
}

export async function createExtractionState<ConnectorState>({
  event,
  initialState,
  initialDomainMapping,
  options,
}: StateInterface<ConnectorState>): Promise<ExtractionState<ConnectorState>> {
  // Clone so the caller's initialState is never mutated.
  const deepCloneInitialState: ConnectorState = structuredClone(initialState);

  const state = new ExtractionState<ConnectorState>({
    event,
    initialState: deepCloneInitialState,
    initialDomainMapping,
    options,
  });

  if (!STATELESS_EVENT_TYPES.includes(event.payload.event_type)) {
    await state.init(deepCloneInitialState);
    await state.installInitialDomainMappingIfNeeded(initialDomainMapping);
    state.resolveExtractionWindow();
  }

  return state;
}
