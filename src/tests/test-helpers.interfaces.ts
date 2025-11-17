import { ErrorRecord } from '../types/common';
import {
  AirdropEvent,
  EventContext,
  EventType,
  ExternalSyncUnit,
} from '../types/extraction';

export interface CreateEventInterface {
  eventType: EventType;
  externalSyncUnits?: ExternalSyncUnit[];
  progress?: number;
  error?: ErrorRecord;
  delay?: number;
  contextOverrides?: Partial<AirdropEvent['context']>;
  payloadOverrides?: Partial<AirdropEvent['payload']>;
  eventContextOverrides?: Partial<EventContext>;
  executionMetadataOverrides?: Partial<AirdropEvent['execution_metadata']>;
}
