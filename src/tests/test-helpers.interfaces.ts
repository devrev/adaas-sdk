import { CreateEventParams } from '../test-utils/create-event.interfaces';

/**
 * Internal variant of {@link CreateEventParams} where `mockServerBaseUrl` is
 * optional — the shared test wrapper injects it automatically.
 */
export interface CreateEventInterface
  extends Omit<CreateEventParams, 'mockServerBaseUrl'> {
  mockServerBaseUrl?: string;
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
