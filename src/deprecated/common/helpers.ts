import { jsonl } from 'js-jsonl';

import { EventType, EventTypeV2, ExtractorEventType } from '../../types/extraction';

export function createFormData(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  preparedArtifact: any,
  fetchedObjects: object[] | object
): FormData {
  const formData = new FormData();
  for (const item of preparedArtifact.form_data) {
    formData.append(item.key, item.value);
  }

  const output = jsonl.stringify(fetchedObjects);
  formData.append('file', output);

  return formData;
}

export function getTimeoutExtractorEventType(eventType: EventType | EventTypeV2): {
  eventType: ExtractorEventType;
  isError: boolean;
} | null {
  // Convert to string to handle both EventType and EventTypeV2
  const eventTypeStr = eventType as string;

  switch (eventTypeStr) {
    case EventType.ExtractionMetadataStart:
    case EventTypeV2.ExtractionMetadataStart:
      return {
        eventType: ExtractorEventType.ExtractionMetadataError,
        isError: true,
      };
    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
    case EventTypeV2.ExtractionDataStart:
    case EventTypeV2.ExtractionDataContinue:
      return {
        eventType: ExtractorEventType.ExtractionDataProgress,
        isError: false,
      };
    case EventType.ExtractionAttachmentsStart:
    case EventType.ExtractionAttachmentsContinue:
    case EventTypeV2.ExtractionAttachmentsStart:
    case EventTypeV2.ExtractionAttachmentsContinue:
      return {
        eventType: ExtractorEventType.ExtractionAttachmentsProgress,
        isError: false,
      };
    case EventType.ExtractionExternalSyncUnitsStart:
    case EventTypeV2.ExtractionExternalSyncUnitsStart:
      return {
        eventType: ExtractorEventType.ExtractionExternalSyncUnitsError,
        isError: true,
      };
    default:
      console.log(
        'Event type not recognized in getTimeoutExtractorEventType function: ' +
          eventType
      );
      return null;
  }
}
