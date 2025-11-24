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
    [EventType.ExtractionExternalSyncUnitsStart]:
      EventType.StartExtractingExternalSyncUnits,
    [EventType.ExtractionMetadataStart]: EventType.StartExtractingMetadata,
    [EventType.ExtractionDataStart]: EventType.StartExtractingData,
    [EventType.ExtractionDataContinue]: EventType.ContinueExtractingData,
    [EventType.ExtractionDataDelete]: EventType.StartDeletingExtractorState,
    [EventType.ExtractionAttachmentsStart]:
      EventType.StartExtractingAttachments,
    [EventType.ExtractionAttachmentsContinue]:
      EventType.ContinueExtractingAttachments,
    [EventType.ExtractionAttachmentsDelete]:
      EventType.StartDeletingExtractorAttachmentsState,

    // New extraction event types (already correct, map to new enum members)
    [EventType.StartExtractingExternalSyncUnits]:
      EventType.StartExtractingExternalSyncUnits,
    [EventType.StartExtractingMetadata]: EventType.StartExtractingMetadata,
    [EventType.StartExtractingData]: EventType.StartExtractingData,
    [EventType.ContinueExtractingData]: EventType.ContinueExtractingData,
    [EventType.StartDeletingExtractorState]:
      EventType.StartDeletingExtractorState,
    [EventType.StartExtractingAttachments]:
      EventType.StartExtractingAttachments,
    [EventType.ContinueExtractingAttachments]:
      EventType.ContinueExtractingAttachments,
    [EventType.StartDeletingExtractorAttachmentsState]:
      EventType.StartDeletingExtractorAttachmentsState,

    // Loading events
    [EventType.StartLoadingData]: EventType.StartLoadingData,
    [EventType.ContinueLoadingData]: EventType.ContinueLoadingData,
    [EventType.StartLoadingAttachments]: EventType.StartLoadingAttachments,
    [EventType.ContinueLoadingAttachments]:
      EventType.ContinueLoadingAttachments,
    [EventType.StartDeletingLoaderState]: EventType.StartDeletingLoaderState,
    [EventType.StartDeletingLoaderAttachmentState]:
      EventType.StartDeletingLoaderAttachmentState,

    // Unknown
    [EventType.UnknownEventType]: EventType.UnknownEventType,
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
export function translateExtractorEventType(
  eventType: ExtractorEventType
): ExtractorEventType {
  // Map old enum members to new enum members
  const stringValue = eventType as string;

  const mapping: Record<string, ExtractorEventType> = {
    // Old string values -> New enum members
    [ExtractorEventType.ExtractionExternalSyncUnitsDone]:
      ExtractorEventType.ExternalSyncUnitExtractionDone,
    [ExtractorEventType.ExtractionExternalSyncUnitsError]:
      ExtractorEventType.ExternalSyncUnitExtractionError,
    [ExtractorEventType.ExtractionMetadataDone]:
      ExtractorEventType.MetadataExtractionDone,
    [ExtractorEventType.ExtractionMetadataError]:
      ExtractorEventType.MetadataExtractionError,
    [ExtractorEventType.ExtractionDataProgress]:
      ExtractorEventType.DataExtractionProgress,
    [ExtractorEventType.ExtractionDataDelay]:
      ExtractorEventType.DataExtractionDelayed,
    [ExtractorEventType.ExtractionDataDone]:
      ExtractorEventType.DataExtractionDone,
    [ExtractorEventType.ExtractionDataError]:
      ExtractorEventType.DataExtractionError,
    [ExtractorEventType.ExtractionDataDeleteDone]:
      ExtractorEventType.ExtractorStateDeletionDone,
    [ExtractorEventType.ExtractionDataDeleteError]:
      ExtractorEventType.ExtractorStateDeletionError,
    [ExtractorEventType.ExtractionAttachmentsProgress]:
      ExtractorEventType.AttachmentExtractionProgress,
    [ExtractorEventType.ExtractionAttachmentsDelay]:
      ExtractorEventType.AttachmentExtractionDelayed,
    [ExtractorEventType.ExtractionAttachmentsDone]:
      ExtractorEventType.AttachmentExtractionDone,
    [ExtractorEventType.ExtractionAttachmentsError]:
      ExtractorEventType.AttachmentExtractionError,
    [ExtractorEventType.ExtractionAttachmentsDeleteDone]:
      ExtractorEventType.ExtractorAttachmentsStateDeletionDone,
    [ExtractorEventType.ExtractionAttachmentsDeleteError]:
      ExtractorEventType.ExtractorAttachmentsStateDeletionError,
  };

  // If there's a mapping, use it; otherwise return original (already new)
  return mapping[stringValue] ?? eventType;
}

/**
 * Normalizes LoaderEventType enum values by converting old enum members to new ones.
 * Old enum members are deprecated and should be replaced with new ones.
 */
export function translateLoaderEventType(
  eventType: LoaderEventType
): LoaderEventType {
  // Map old enum members to new enum members
  const stringValue = eventType as string;

  const mapping: Record<string, LoaderEventType> = {
    // Old string values -> New enum members
    [LoaderEventType.DataLoadingDelay]: LoaderEventType.DataLoadingDelayed,
    [LoaderEventType.AttachmentLoadingProgress]:
      LoaderEventType.AttachmentsLoadingProgress,
    [LoaderEventType.AttachmentLoadingDelayed]:
      LoaderEventType.AttachmentsLoadingDelayed,
    [LoaderEventType.AttachmentLoadingDone]:
      LoaderEventType.AttachmentsLoadingDone,
    [LoaderEventType.AttachmentLoadingError]:
      LoaderEventType.AttachmentsLoadingError,
  };

  // If there's a mapping, use it; otherwise return original (already new)
  return mapping[stringValue] ?? eventType;
}

/**
 * Normalizes any outgoing event type (Extractor or Loader) to ensure new event types are used.
 */
export function translateOutgoingEventType(
  eventType: ExtractorEventType | LoaderEventType
): ExtractorEventType | LoaderEventType {
  // Check if it's an ExtractorEventType by checking if the value exists in ExtractorEventType
  if (
    Object.values(ExtractorEventType).includes(eventType as ExtractorEventType)
  ) {
    return translateExtractorEventType(eventType as ExtractorEventType);
  }
  // Otherwise treat as LoaderEventType
  if (Object.values(LoaderEventType).includes(eventType as LoaderEventType)) {
    return translateLoaderEventType(eventType as LoaderEventType);
  }
  // If neither, return as-is
  return eventType;
}
