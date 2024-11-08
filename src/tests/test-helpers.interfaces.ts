import { ErrorRecord } from '../types/common';
import { AirdropEvent, EventType, ExternalSyncUnit } from '../types/extraction';

export interface CreateEventInterface {
  eventType: EventType;
  externalSyncUnits?: ExternalSyncUnit[];
  progress?: number;
  error?: ErrorRecord;
  delay?: number;
  contextOverrides?: Partial<AirdropEvent['context']>;
  payloadOverrides?: Partial<AirdropEvent['payload']>;
}
