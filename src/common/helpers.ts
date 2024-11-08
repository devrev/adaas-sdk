import { EventType, ExtractorEventType } from '../types/extraction';

export function getErrorExtractorEventType(eventType: EventType): {
  eventType: ExtractorEventType;
} | null {
  switch (eventType) {
    case EventType.ExtractionMetadataStart:
      return {
        eventType: ExtractorEventType.ExtractionMetadataError,
      };
    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
      return {
        eventType: ExtractorEventType.ExtractionDataError,
      };
    case EventType.ExtractionDataDelete:
      return {
        eventType: ExtractorEventType.ExtractionDataDeleteError,
      };
    case EventType.ExtractionAttachmentsStart:
    case EventType.ExtractionAttachmentsContinue:
      return {
        eventType: ExtractorEventType.ExtractionAttachmentsError,
      };
    case EventType.ExtractionAttachmentsDelete:
      return {
        eventType: ExtractorEventType.ExtractionAttachmentsDeleteError,
      };
    case EventType.ExtractionExternalSyncUnitsStart:
      return {
        eventType: ExtractorEventType.ExtractionExternalSyncUnitsError,
      };
    default:
      console.error(
        'Event type not recognized in getTimeoutExtractorEventType function: ' +
          eventType
      );
      return null;
  }
}
