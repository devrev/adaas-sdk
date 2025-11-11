import { ErrorRecord } from '../types/common';
import {
  AirdropEvent,
  EventContext,
  EventTypeV2,
  ExternalSyncUnit,
} from '../types/extraction';

export interface CreateEventInterface {
  eventType: EventTypeV2;
  externalSyncUnits?: ExternalSyncUnit[];
  progress?: number;
  error?: ErrorRecord;
  delay?: number;
  contextOverrides?: Partial<AirdropEvent['context']>;
  payloadOverrides?: Partial<AirdropEvent['payload']>;
  eventContextOverrides?: Partial<EventContext>;
  executionMetadataOverrides?: Partial<AirdropEvent['execution_metadata']>;
}
