import { WorkerAdapter } from '../multithreading/worker-adapter/worker-adapter';
import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
} from '../types';

export interface AttachmentsStreamingPoolParams<ConnectorState> {
  adapter: WorkerAdapter<ConnectorState>;
  attachments: NormalizedAttachment[];
  batchSize?: number;
  stream: ExternalSystemAttachmentStreamingFunction;
}
