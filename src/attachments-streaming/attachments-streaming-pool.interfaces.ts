import { ExternalSystemAttachmentStreamingFunction } from '../types/extraction';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';

export interface AttachmentsStreamingPoolParams<ConnectorState> {
  adapter: ExtractionAdapter<ConnectorState>;
  attachments: NormalizedAttachment[];
  batchSize?: number;
  stream: ExternalSystemAttachmentStreamingFunction;
}
