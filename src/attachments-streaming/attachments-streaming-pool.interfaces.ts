import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
} from '../types';
import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';

/**
 * Construction parameters used to create an AttachmentsStreamingPool.
 *
 * Used to supply the driving extraction adapter, the attachments to stream, the concurrency limit, and
 * the connector-provided streaming function.
 */
export interface AttachmentsStreamingPoolParams<ConnectorState> {
  /** The ExtractionAdapter that owns sync state, timeout detection, and the processAttachment call. */
  adapter: ExtractionAdapter<ConnectorState>;
  /** The normalized attachments to stream to DevRev. */
  attachments: NormalizedAttachment[];
  /** Optional maximum number of attachments to stream concurrently (defaults to 10 in the pool). */
  batchSize?: number;
  /** Connector-provided function that downloads a single attachment from the external system. */
  stream: ExternalSystemAttachmentStreamingFunction;
}
