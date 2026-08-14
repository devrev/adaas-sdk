import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { ExternalSystemAttachmentStreamingFunction } from '../types/extraction';

export interface AttachmentsStreamingPoolParams<ConnectorState> {
  adapter: ExtractionAdapter<ConnectorState>;
  attachments: NormalizedAttachment[];
  batchSize?: number;
  stream: ExternalSystemAttachmentStreamingFunction;
}
