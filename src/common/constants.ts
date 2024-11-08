import { EventType } from '../types/extraction';

export const STATELESS_EVENT_TYPES = [
  EventType.ExtractionExternalSyncUnitsStart,
  EventType.ExtractionMetadataStart,
  EventType.ExtractionDataDelete,
  EventType.ExtractionAttachmentsDelete,
];

export const ALLOWED_EVENT_TYPES = [
  EventType.ExtractionExternalSyncUnitsStart,
  EventType.ExtractionMetadataStart,
  EventType.ExtractionDataStart,
  EventType.ExtractionDataContinue,
  EventType.ExtractionDataDelete,
  EventType.ExtractionAttachmentsStart,
  EventType.ExtractionAttachmentsContinue,
  EventType.ExtractionAttachmentsDelete,
];

export const ARTIFACT_BATCH_SIZE = 2000;
export const MAX_DEVREV_ARTIFACT_SIZE = 536870912; // 512MB

export const AIRDROP_DEFAULT_ITEM_TYPES = {
  EXTERNAL_DOMAIN_METADATA: 'external_domain_metadata',
  ATTACHMENTS: 'attachments',
  SSOR_ATTACHMENT: 'ssor_attachment',
};
