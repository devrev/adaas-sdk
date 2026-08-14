import { DeepPartial } from '../testing/mock-event';
import { AirdropEvent } from '../types/extraction';

/**
 * Internal variant of the createMockEvent overrides — a deep partial of
 * {@link AirdropEvent}. The shared test wrapper injects defaults automatically.
 */
export type CreateMockEventOverrides = DeepPartial<AirdropEvent>;

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
