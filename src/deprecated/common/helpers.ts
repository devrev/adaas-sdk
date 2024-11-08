import { jsonl } from 'js-jsonl';

import { EventType, ExtractorEventType } from '../../types/extraction';

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

export function getTimeoutExtractorEventType(eventType: EventType): {
  eventType: ExtractorEventType;
  isError: boolean;
} | null {
  switch (eventType) {
    case EventType.ExtractionMetadataStart:
      return {
        eventType: ExtractorEventType.ExtractionMetadataError,
        isError: true,
      };
    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
      return {
        eventType: ExtractorEventType.ExtractionDataProgress,
        isError: false,
      };
    case EventType.ExtractionAttachmentsStart:
    case EventType.ExtractionAttachmentsContinue:
      return {
        eventType: ExtractorEventType.ExtractionAttachmentsProgress,
        isError: false,
      };
    case EventType.ExtractionExternalSyncUnitsStart:
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
