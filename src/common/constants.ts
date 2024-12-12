import { EventType } from '../types/extraction';

export const STATELESS_EVENT_TYPES = [
  EventType.ExtractionExternalSyncUnitsStart,
  EventType.ExtractionMetadataStart,
  EventType.ExtractionDataDelete,
  EventType.ExtractionAttachmentsDelete,
  EventType.StartDeletingLoaderState,
  EventType.StartDeletingLoaderAttachmentsState,
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
  EventType.StartDeletingLoaderAttachmentsState,
];

export const ALLOWED_EVENT_TYPES = [
  ...ALLOWED_EXTRACTION_EVENT_TYPES,
  ...ALLOWED_LOADING_EVENT_TYPES,
];

export const ARTIFACT_BATCH_SIZE = 2000;
export const MAX_DEVREV_ARTIFACT_SIZE = 536870912; // 512MB

export const AIRDROP_DEFAULT_ITEM_TYPES = {
  EXTERNAL_DOMAIN_METADATA: 'external_domain_metadata',
  ATTACHMENTS: 'attachments',
  SSOR_ATTACHMENT: 'ssor_attachment',
};
