import { ErrorRecord } from '../types/common';
import {
  AirdropEvent,
  EventContext,
  EventType,
  ExternalSyncUnit,
} from '../types/extraction';

export interface CreateEventInterface {
  eventType?: EventType;
  externalSyncUnits?: ExternalSyncUnit[];
  progress?: number;
  error?: ErrorRecord;
  delay?: number;
  contextOverrides?: Partial<AirdropEvent['context']>;
  payloadOverrides?: Partial<AirdropEvent['payload']>;
  eventContextOverrides?: Partial<EventContext>;
  executionMetadataOverrides?: Partial<AirdropEvent['execution_metadata']>;
}

/**
 * Options for creating a file stream response.
 */
export interface CreateFileStreamOptions {
  /** File content as Buffer or string (default: 'test file content') */
  content?: Buffer | string;
  /** Override content-length header (auto-calculated from content if not provided) */
  contentLength?: number;
  /** Set to false to omit content-length header (for testing missing header scenarios) */
  includeContentLength?: boolean;
  /** Optional filename for metadata */
  filename?: string;
  /** Optional MIME type (default: 'application/octet-stream') */
  mimeType?: string;
  /** Optional custom destroy function for testing stream cleanup */
  destroyFn?: () => void;
}
