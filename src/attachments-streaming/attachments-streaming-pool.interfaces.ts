import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
} from '../types';
import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';

export interface AttachmentsStreamingPoolParams<ConnectorState> {
  adapter: ExtractionAdapter<ConnectorState>;
  attachments: NormalizedAttachment[];
  batchSize?: number;
  stream: ExternalSystemAttachmentStreamingFunction;
}
