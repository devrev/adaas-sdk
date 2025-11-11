import { EventType, EventTypeV2 } from '../types/extraction';
import { getLibraryVersion } from './helpers';

export const ALLOWED_EXTRACTION_EVENT_TYPES = [
  EventType.ExtractionExternalSyncUnitsStart,
  EventType.ExtractionMetadataStart,
  EventType.ExtractionDataStart,
  EventType.ExtractionDataContinue,
  EventType.ExtractionDataDelete,
  EventType.ExtractionAttachmentsStart,
  EventType.ExtractionAttachmentsContinue,
  EventType.ExtractionAttachmentsDelete,
];

export const ALLOWED_EXTRACTION_EVENT_TYPES_V2 = [
  EventTypeV2.ExtractionExternalSyncUnitsStart,
  EventTypeV2.ExtractionMetadataStart,
  EventTypeV2.ExtractionDataStart,
  EventTypeV2.ExtractionDataContinue,
  EventTypeV2.ExtractionDataDelete,
  EventTypeV2.ExtractionAttachmentsStart,
  EventTypeV2.ExtractionAttachmentsContinue,
  EventTypeV2.ExtractionAttachmentsDelete,
];

export const ALLOWED_LOADING_EVENT_TYPES = [
  EventType.StartLoadingData,
  EventType.ContinueLoadingData,
  EventType.StartDeletingLoaderState,
  EventType.StartDeletingLoaderAttachmentState,
];

export const ALLOWED_LOADING_EVENT_TYPES_V2 = [
  EventTypeV2.StartLoadingData,
  EventTypeV2.ContinueLoadingData,
  EventTypeV2.StartDeletingLoaderState,
  EventTypeV2.StartDeletingLoaderAttachmentState,
];

export const ALLOWED_EVENT_TYPES = [
  ...ALLOWED_EXTRACTION_EVENT_TYPES,
  ...ALLOWED_LOADING_EVENT_TYPES,
];

export const ALLOWED_EVENT_TYPES_V2 = [
  ...ALLOWED_EXTRACTION_EVENT_TYPES_V2,
  ...ALLOWED_LOADING_EVENT_TYPES_V2,
];

export const STATELESS_EXTRACTION_EVENT_TYPES = [
  EventType.ExtractionExternalSyncUnitsStart,
  EventType.ExtractionDataDelete,
  EventType.ExtractionAttachmentsDelete,
];

export const STATELESS_EXTRACTION_EVENT_TYPES_V2 = [
  EventTypeV2.ExtractionExternalSyncUnitsStart,
  EventTypeV2.ExtractionDataDelete,
  EventTypeV2.ExtractionAttachmentsDelete,
];

export const STATELESS_LOADING_EVENT_TYPES = [
  EventType.StartDeletingLoaderState,
  EventType.StartDeletingLoaderAttachmentState,
];

export const STATELESS_LOADING_EVENT_TYPES_V2 = [
  EventTypeV2.StartDeletingLoaderState,
  EventTypeV2.StartDeletingLoaderAttachmentState,
];

export const STATELESS_EVENT_TYPES = [
  ...STATELESS_EXTRACTION_EVENT_TYPES,
  ...STATELESS_LOADING_EVENT_TYPES,
];

export const STATELESS_EVENT_TYPES_V2 = [
  ...STATELESS_EXTRACTION_EVENT_TYPES_V2,
  ...STATELESS_LOADING_EVENT_TYPES_V2,
];

export const STATEFUL_EXTRACTION_EVENT_TYPES =
  ALLOWED_EXTRACTION_EVENT_TYPES.filter(
    (eventType) => !STATELESS_EXTRACTION_EVENT_TYPES.includes(eventType)
  );

export const STATEFUL_EXTRACTION_EVENT_TYPES_V2 =
  ALLOWED_EXTRACTION_EVENT_TYPES_V2.filter(
    (eventType) => !STATELESS_EXTRACTION_EVENT_TYPES_V2.includes(eventType)
  );

export const STATEFUL_LOADING_EVENT_TYPES = ALLOWED_LOADING_EVENT_TYPES.filter(
  (eventType) => !STATELESS_LOADING_EVENT_TYPES.includes(eventType)
);

export const STATEFUL_LOADING_EVENT_TYPES_V2 =
  ALLOWED_LOADING_EVENT_TYPES_V2.filter(
    (eventType) => !STATELESS_LOADING_EVENT_TYPES_V2.includes(eventType)
  );

export const STATEFUL_EVENT_TYPES = [
  ...STATEFUL_EXTRACTION_EVENT_TYPES,
  ...STATEFUL_LOADING_EVENT_TYPES,
];

export const STATEFUL_EVENT_TYPES_V2 = [
  ...STATEFUL_EXTRACTION_EVENT_TYPES_V2,
  ...STATEFUL_LOADING_EVENT_TYPES_V2,
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
