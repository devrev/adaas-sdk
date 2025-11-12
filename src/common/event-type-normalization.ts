import { EventType, ExtractorEventType } from '../types/extraction';
import { LoaderEventType } from '../types/loading';

/**
 * Maps old incoming event type strings to new EventType enum values.
 * This ensures backwards compatibility when the platform sends old event types.
 * @param eventTypeString The raw event type string from the platform
 * @returns The normalized EventType enum value
 */
export function normalizeIncomingEventType(eventTypeString: string): EventType {
  // Create a reverse mapping from OLD string values to NEW enum member names
  const eventTypeMap: Record<string, EventType> = {
    // Old extraction event types from platform -> New enum members
    EXTRACTION_EXTERNAL_SYNC_UNITS_START:
      EventType.StartExtractingExternalSyncUnits,
    EXTRACTION_METADATA_START: EventType.StartExtractingMetadata,
    EXTRACTION_DATA_START: EventType.StartExtractingData,
    EXTRACTION_DATA_CONTINUE: EventType.ContinueExtractingData,
    EXTRACTION_DATA_DELETE: EventType.StartDeletingExtractorState,
    EXTRACTION_ATTACHMENTS_START: EventType.StartExtractingAttachments,
    EXTRACTION_ATTACHMENTS_CONTINUE: EventType.ContinueExtractingAttachments,
    EXTRACTION_ATTACHMENTS_DELETE:
      EventType.StartDeletingExtractorAttachmentsState,

    // New extraction event types (already correct, map to new enum members)
    START_EXTRACTING_EXTERNAL_SYNC_UNITS:
      EventType.StartExtractingExternalSyncUnits,
    START_EXTRACTING_METADATA: EventType.StartExtractingMetadata,
    START_EXTRACTING_DATA: EventType.StartExtractingData,
    CONTINUE_EXTRACTING_DATA: EventType.ContinueExtractingData,
    START_DELETING_EXTRACTOR_STATE: EventType.StartDeletingExtractorState,
    START_EXTRACTING_ATTACHMENTS: EventType.StartExtractingAttachments,
    CONTINUE_EXTRACTING_ATTACHMENTS: EventType.ContinueExtractingAttachments,
    START_DELETING_EXTRACTOR_ATTACHMENTS_STATE:
      EventType.StartDeletingExtractorAttachmentsState,

    // Loading events
    START_LOADING_DATA: EventType.StartLoadingData,
    CONTINUE_LOADING_DATA: EventType.ContinueLoadingData,
    START_LOADING_ATTACHMENTS: EventType.StartLoadingAttachments,
    CONTINUE_LOADING_ATTACHMENTS: EventType.ContinueLoadingAttachments,
    START_DELETING_LOADER_STATE: EventType.StartDeletingLoaderState,
    START_DELETING_LOADER_ATTACHMENT_STATE:
      EventType.StartDeletingLoaderAttachmentState,

    // Unknown
    UNKNOWN_EVENT_TYPE: EventType.UnknownEventType,
  };

  const normalized = eventTypeMap[eventTypeString];
  if (!normalized) {
    console.warn(
      `Unknown event type received: ${eventTypeString}. This may indicate a new event type or a typo.`
    );
    // Return the original string cast as EventType as a fallback
    return eventTypeString as EventType;
  }

  return normalized;
}

/**
 * Normalizes ExtractorEventType enum values by converting old enum members to new ones.
 * Old enum members are deprecated and should be replaced with new ones.
 */
export function normalizeExtractorEventType(
  eventType: ExtractorEventType
): ExtractorEventType {
  // Map old enum members to new enum members
  const stringValue = eventType as string;

  const mapping: Record<string, ExtractorEventType> = {
    // Old string values -> New enum members
    EXTRACTION_EXTERNAL_SYNC_UNITS_DONE:
      ExtractorEventType.ExternalSyncUnitExtractionDone,
    EXTRACTION_EXTERNAL_SYNC_UNITS_ERROR:
      ExtractorEventType.ExternalSyncUnitExtractionError,
    EXTRACTION_METADATA_DONE: ExtractorEventType.MetadataExtractionDone,
    EXTRACTION_METADATA_ERROR: ExtractorEventType.MetadataExtractionError,
    EXTRACTION_DATA_PROGRESS: ExtractorEventType.DataExtractionProgress,
    EXTRACTION_DATA_DELAY: ExtractorEventType.DataExtractionDelayed,
    EXTRACTION_DATA_DONE: ExtractorEventType.DataExtractionDone,
    EXTRACTION_DATA_ERROR: ExtractorEventType.DataExtractionError,
    EXTRACTION_DATA_DELETE_DONE: ExtractorEventType.ExtractorStateDeletionDone,
    EXTRACTION_DATA_DELETE_ERROR:
      ExtractorEventType.ExtractorStateDeletionError,
    EXTRACTION_ATTACHMENTS_PROGRESS:
      ExtractorEventType.AttachmentExtractionProgress,
    EXTRACTION_ATTACHMENTS_DELAY:
      ExtractorEventType.AttachmentExtractionDelayed,
    EXTRACTION_ATTACHMENTS_DONE: ExtractorEventType.AttachmentExtractionDone,
    EXTRACTION_ATTACHMENTS_ERROR: ExtractorEventType.AttachmentExtractionError,
    EXTRACTION_ATTACHMENTS_DELETE_DONE:
      ExtractorEventType.ExtractorAttachmentsStateDeletionDone,
    EXTRACTION_ATTACHMENTS_DELETE_ERROR:
      ExtractorEventType.ExtractorAttachmentsStateDeletionError,
  };

  // If there's a mapping, use it; otherwise return original (already new)
  return mapping[stringValue] ?? eventType;
}

/**
 * Normalizes LoaderEventType enum values by converting old enum members to new ones.
 * Old enum members are deprecated and should be replaced with new ones.
 */
export function normalizeLoaderEventType(
  eventType: LoaderEventType
): LoaderEventType {
  // Map old enum members to new enum members
  const stringValue = eventType as string;

  const mapping: Record<string, LoaderEventType> = {
    // Old string values -> New enum members
    DATA_LOADING_DELAYED: LoaderEventType.DataLoadingDelayed,
    ATTACHMENT_LOADING_PROGRESS: LoaderEventType.AttachmentsLoadingProgress,
    ATTACHMENT_LOADING_DELAYED: LoaderEventType.AttachmentsLoadingDelayed,
    ATTACHMENT_LOADING_DONE: LoaderEventType.AttachmentsLoadingDone,
    ATTACHMENT_LOADING_ERROR: LoaderEventType.AttachmentsLoadingError,
  };

  // If there's a mapping, use it; otherwise return original (already new)
  return mapping[stringValue] ?? eventType;
}

/**
 * Normalizes any outgoing event type (Extractor or Loader) to ensure new event types are used.
 */
export function normalizeOutgoingEventType(
  eventType: ExtractorEventType | LoaderEventType
): ExtractorEventType | LoaderEventType {
  // Check if it's an ExtractorEventType by checking if the value exists in ExtractorEventType
  if (
    Object.values(ExtractorEventType).includes(eventType as ExtractorEventType)
  ) {
    return normalizeExtractorEventType(eventType as ExtractorEventType);
  }
  // Otherwise treat as LoaderEventType
  if (Object.values(LoaderEventType).includes(eventType as LoaderEventType)) {
    return normalizeLoaderEventType(eventType as LoaderEventType);
  }
  // If neither, return as-is
  return eventType;
}
