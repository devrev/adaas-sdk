import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
} from '../types';
import { WorkerAdapter } from '../multithreading/worker-adapter/worker-adapter';

export interface AttachmentsStreamingPoolParams<ConnectorState> {
  adapter: WorkerAdapter<ConnectorState>;
  attachments: NormalizedAttachment[];
  batchSize?: number;
  stream: ExternalSystemAttachmentStreamingFunction;
}
