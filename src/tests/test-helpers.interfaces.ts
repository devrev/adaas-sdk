import { DeepPartial } from '../testing/mock-event';
import { AirSyncEvent } from '../types/extraction';

/** Overrides for createMockEvent; the shared test wrapper injects defaults. */
export type CreateMockEventOverrides = DeepPartial<AirSyncEvent>;

export interface CreateFileStreamOptions {
  content?: Buffer | string;
  /** Overrides the content-length header (defaults to actual content length) */
  contentLength?: number;
  /** Set to false to omit the content-length header entirely */
  includeContentLength?: boolean;
  filename?: string;
  mimeType?: string;
  destroyFn?: () => void;
}
