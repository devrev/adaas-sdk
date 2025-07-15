import { ErrorRecord } from '../types/common';
import {
  AirdropEvent,
  EventType,
  ExternalSyncUnit,
  EventContext,
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
