import { ErrorRecord } from '../types/common';
import {
  AirdropEvent,
  EventContext,
  EventType,
  ExternalSyncUnit,
} from '../types/extraction';

export interface CreateEventParams {
  /** Base URL of the mock server (used for callback_url, worker_data_url, devrev_endpoint). */
  mockServerBaseUrl: string;
  /** The event type to set on the payload. Defaults to `EventType.StartExtractingData`. */
  eventType?: EventType;
  /** External sync units to include in event_data. */
  externalSyncUnits?: ExternalSyncUnit[];
  /** Progress value to include in event_data. */
  progress?: number;
  /** Error record to include in event_data. */
  error?: ErrorRecord;
  /** Delay value to include in event_data. */
  delay?: number;
  /** Partial overrides for the top-level `context` object. */
  contextOverrides?: Partial<AirdropEvent['context']>;
  /** Partial overrides for the `payload` object. */
  payloadOverrides?: Partial<AirdropEvent['payload']>;
  /** Partial overrides for `payload.event_context`. Applied on top of defaults. */
  eventContextOverrides?: Partial<EventContext>;
  /** Partial overrides for `execution_metadata`. */
  executionMetadataOverrides?: Partial<AirdropEvent['execution_metadata']>;
}
