import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
} from '../types';
import { ExtractionAdapter } from '../multithreading/worker-adapter/extraction-adapter';
import { ToDevRev } from '../state/state.interfaces';

export interface AttachmentsStreamingPoolParams<ConnectorState> {
  adapter: ExtractionAdapter<ConnectorState>;
  attachments: NormalizedAttachment[];
  /**
   * SDK-owned attachments bookkeeping. Passed in directly so the pool does not
   * reach into the (now-encapsulated) adapter state.
   */
  attachmentsMetadata: ToDevRev['attachmentsMetadata'] | undefined;
  batchSize?: number;
  stream: ExternalSystemAttachmentStreamingFunction;
}
