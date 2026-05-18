import { EventType, ExtractorEventType } from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';

/**
 * Gets the event type for the timeout error.
 * @param {EventType} eventType - The event type to get the timeout error event type for
 * @returns {ExtractorEventType | LoaderEventType} The event type for the timeout error
 */
export function getTimeoutErrorEventType(eventType: EventType): {
  eventType: ExtractorEventType | LoaderEventType;
} {
  switch (eventType) {
    // Metadata extraction
    case EventType.StartExtractingMetadata:
      return {
        eventType: ExtractorEventType.MetadataExtractionError,
      };

    // Data extraction
    case EventType.StartExtractingData:
    case EventType.ContinueExtractingData:
      return {
        eventType: ExtractorEventType.DataExtractionError,
      };

    // Data deletion
    case EventType.StartDeletingExtractorState:
      return {
        eventType: ExtractorEventType.ExtractorStateDeletionError,
      };

    // Attachments extraction
    case EventType.StartExtractingAttachments:
    case EventType.ContinueExtractingAttachments:
      return {
        eventType: ExtractorEventType.AttachmentExtractionError,
      };

    // Attachments deletion
    case EventType.StartDeletingExtractorAttachmentsState:
      return {
        eventType: ExtractorEventType.ExtractorAttachmentsStateDeletionError,
      };

    // External sync units
    case EventType.StartExtractingExternalSyncUnits:
      return {
        eventType: ExtractorEventType.ExternalSyncUnitExtractionError,
      };

    // Loading data
    case EventType.StartLoadingData:
    case EventType.ContinueLoadingData:
      return {
        eventType: LoaderEventType.DataLoadingError,
      };

    // Deleting loader state
    case EventType.StartDeletingLoaderState:
      return {
        eventType: LoaderEventType.LoaderStateDeletionError,
      };

    // Loading attachments
    case EventType.StartLoadingAttachments:
    case EventType.ContinueLoadingAttachments:
      return {
        eventType: LoaderEventType.AttachmentLoadingError,
      };

    // Deleting loader attachment state
    case EventType.StartDeletingLoaderAttachmentState:
      return {
        eventType: LoaderEventType.LoaderAttachmentStateDeletionError,
      };

    default:
      console.error(
        'Event type not recognized in getTimeoutErrorEventType function: ' +
          eventType
      );
      return {
        eventType: LoaderEventType.UnknownEventType,
      };
  }
}

/**
 * Gets the event type for the no script error.
 * @param {EventType} eventType - The event type to get the no script error event type for
 * @returns {ExtractorEventType | LoaderEventType} The event type for the no script error
 */
export function getNoScriptEventType(eventType: EventType) {
  switch (eventType) {
    case EventType.StartDeletingExtractorState:
      return {
        eventType: ExtractorEventType.ExtractorStateDeletionDone,
      };
    case EventType.StartDeletingExtractorAttachmentsState:
      return {
        eventType: ExtractorEventType.ExtractorAttachmentsStateDeletionDone,
      };
    case EventType.StartDeletingLoaderState:
      return {
        eventType: LoaderEventType.LoaderStateDeletionDone,
      };
    case EventType.StartDeletingLoaderAttachmentState:
      return {
        eventType: LoaderEventType.LoaderAttachmentStateDeletionDone,
      };
    default:
      console.error(
        'Event type not recognized in getNoScriptEventType function: ' +
          eventType
      );
      return {
        eventType: LoaderEventType.UnknownEventType,
      };
  }
}
