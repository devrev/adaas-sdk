import { parentPort } from 'node:worker_threads';

import { STATELESS_EVENT_TYPES } from '../common/constants';
import { resolveTimeValue } from './time-value-resolver';
import { serializeError } from '../logger/logger';
import { EventType } from '../types/extraction';
import { WorkerMessageSubject } from '../types/workers';

import { BaseState } from './base-state';
import { extractionSdkState, StateInterface } from './state.interfaces';

/**
 * ExtractionState is the per-mode state for extraction workers. It seeds the
 * extraction SDK state (extraction boundaries + attachments bookkeeping) on top
 * of the shared lifecycle provided by `BaseState` and adds extraction-window
 * resolution.
 */
export class ExtractionState<ConnectorState> extends BaseState<ConnectorState> {
  constructor(params: StateInterface<ConnectorState>) {
    super(params, extractionSdkState);
  }

  /**
   * Resolves the extraction window onto the event context.
   *
   * On StartExtractingData: stamp `lastSyncStarted` if not already set.
   * On StartExtractingMetadata: resolve fresh from the TimeValue objects in the
   * event context and cache them as pending boundaries (always overwrite).
   * On all other events: reuse the pending boundaries cached during
   * StartExtractingMetadata. Finally, validate that extract_from < extract_to.
   */
  resolveExtractionWindow(): void {
    const sdkState = this.sdkState;

    // Set lastSyncStarted if the event type is StartExtractingData
    if (
      this.event.payload.event_type === EventType.StartExtractingData &&
      !sdkState.lastSyncStarted
    ) {
      sdkState.lastSyncStarted = new Date().toISOString();
      console.log(`Setting lastSyncStarted to ${sdkState.lastSyncStarted}.`);
    }

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
      // Non-StartExtractingMetadata events: reuse pending values from state
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

    // Validate that extract_from is before extract_to
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

/**
 * Creates and initializes an `ExtractionState` for an extraction worker.
 *
 * For non-stateless events this fetches persisted state, installs the initial
 * domain mapping if the snap-in version changed, then resolves the extraction
 * window (time-value resolution + pending boundary reuse) and validates it.
 */
export async function createExtractionState<ConnectorState>({
  event,
  initialState,
  initialDomainMapping,
  options,
}: StateInterface<ConnectorState>): Promise<ExtractionState<ConnectorState>> {
  // Deep clone the initial state to avoid mutating the original state
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
