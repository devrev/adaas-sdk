import { jsonl } from 'js-jsonl';

import { Artifact, EventType, ExtractorEventType } from '../types';

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

export function createArtifact(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  preparedArtifact: any,
  fetchedObjects: object[] | object,
  entity: string
): Artifact {
  const itemCount = Array.isArray(fetchedObjects) ? fetchedObjects.length : 1;

  return {
    item_count: itemCount,
    id: preparedArtifact.id,
    item_type: entity,
  } as Artifact;
}

export function getTimeoutExtractorEventType(
  eventType: EventType
): ExtractorEventType | null {
  switch (eventType) {
    case EventType.ExtractionMetadataStart:
      return ExtractorEventType.ExtractionMetadataError;
    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
      return ExtractorEventType.ExtractionDataProgress;
    case EventType.ExtractionAttachmentsStart:
    case EventType.ExtractionAttachmentsContinue:
      return ExtractorEventType.ExtractionAttachmentsProgress;
    case EventType.ExtractionExternalSyncUnitsStart:
      return ExtractorEventType.ExtractionExternalSyncUnitsError;
    default:
      console.log(
        'Event type not recognized in getTimeoutExtractorEventType function: ' +
          eventType
      );
      return null;
  }
}
