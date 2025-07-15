import { EventType } from '../types/extraction';
import { getLibraryVersion } from './helpers';

export const STATELESS_EVENT_TYPES = [
  EventType.ExtractionExternalSyncUnitsStart,
  EventType.ExtractionMetadataStart,
  EventType.ExtractionDataDelete,
  EventType.ExtractionAttachmentsDelete,
  EventType.StartDeletingLoaderState,
  EventType.StartDeletingLoaderAttachmentState,
];

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

export const DEFAULT_SLEEP_DELAY_MS = 3 * 60 * 1000; // 3 minutes
