import { EventType } from '../types/extraction';
import { getLibraryVersion } from './helpers';

export const ALLOWED_EXTRACTION_EVENT_TYPES = [
  EventType.StartExtractingExternalSyncUnits,
  EventType.StartExtractingMetadata,
  EventType.StartExtractingData,
  EventType.ContinueExtractingData,
  EventType.StartDeletingExtractorState,
  EventType.StartExtractingAttachments,
  EventType.ContinueExtractingAttachments,
  EventType.StartDeletingExtractorAttachmentsState,
];

export const ALLOWED_LOADING_EVENT_TYPES = [
  EventType.StartLoadingData,
  EventType.ContinueLoadingData,
  EventType.StartDeletingLoaderState,
  EventType.StartDeletingLoaderAttachmentState,
];

export const ALLOWED_EVENT_TYPES = [
  ...ALLOWED_EXTRACTION_EVENT_TYPES,
  ...ALLOWED_LOADING_EVENT_TYPES,
];

export const STATELESS_EXTRACTION_EVENT_TYPES = [
  EventType.StartExtractingExternalSyncUnits,
  EventType.StartDeletingExtractorState,
  EventType.StartDeletingExtractorAttachmentsState,
];

export const STATELESS_LOADING_EVENT_TYPES = [
  EventType.StartDeletingLoaderState,
  EventType.StartDeletingLoaderAttachmentState,
];

export const STATELESS_EVENT_TYPES = [
  ...STATELESS_EXTRACTION_EVENT_TYPES,
  ...STATELESS_LOADING_EVENT_TYPES,
];

export const STATEFUL_EXTRACTION_EVENT_TYPES =
  ALLOWED_EXTRACTION_EVENT_TYPES.filter(
    (eventType) => !STATELESS_EXTRACTION_EVENT_TYPES.includes(eventType)
  );

export const STATEFUL_LOADING_EVENT_TYPES = ALLOWED_LOADING_EVENT_TYPES.filter(
  (eventType) => !STATELESS_LOADING_EVENT_TYPES.includes(eventType)
);

export const STATEFUL_EVENT_TYPES = [
  ...STATEFUL_EXTRACTION_EVENT_TYPES,
  ...STATEFUL_LOADING_EVENT_TYPES,
];

export const ARTIFACT_BATCH_SIZE = 2000;
export const MAX_DEVREV_ARTIFACT_SIZE = 262144000; // 250MB
export const MAX_DEVREV_FILENAME_LENGTH = 256;
export const MAX_DEVREV_FILENAME_EXTENSION_LENGTH = 20; // 20 characters for the file extension

export const AIRDROP_DEFAULT_ITEM_TYPES = {
  EXTERNAL_DOMAIN_METADATA: 'external_domain_metadata',
  ATTACHMENTS: 'attachments',
  SSOR_ATTACHMENT: 'ssor_attachment',
};

export const LIBRARY_VERSION = getLibraryVersion();

export const DEFAULT_LAMBDA_TIMEOUT = 10 * 60 * 1000; // 10 minutes
export const HARD_TIMEOUT_MULTIPLIER = 1.3;
export const MEMORY_LOG_INTERVAL = 30 * 1000; // 30 seconds

export const DEFAULT_SLEEP_DELAY_MS = 3 * 60 * 1000; // 3 minutes
