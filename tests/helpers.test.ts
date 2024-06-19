import {
  createFormData,
  createArtifact,
  getTimeoutExtractorEventType,
} from '../src/adapter/helpers';

import { EventType, ExtractorEventType } from '../src/types';

describe('createFormData', () => {
  it('should create a FormData object', () => {
    const preparedArtifact = {
      form_data: [{ key: 'key', value: 'value' }],
    };
    const fetchedObjects = [{ key: 'value' }];

    const formData = createFormData(preparedArtifact, fetchedObjects);

    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('key')).toBe('value');
  });
});

describe('createArtifact', () => {
  it('should create an Artifact object', () => {
    const preparedArtifact = { id: 'id' };
    const fetchedObjects = [{ key: 'value' }];
    const entity = 'entity';

    const artifact = createArtifact(preparedArtifact, fetchedObjects, entity);

    expect(artifact).toEqual({
      item_count: 1,
      id: 'id',
      item_type: 'entity',
    });
  });
});

describe('getTimeoutExtractorEventType', () => {
  it('should return the correct ExtractorEventType', () => {
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionMetadataStart)
    ).toBe(ExtractorEventType.ExtractionMetadataError);
    expect(getTimeoutExtractorEventType(EventType.ExtractionDataStart)).toBe(
      ExtractorEventType.ExtractionDataProgress
    );
    expect(getTimeoutExtractorEventType(EventType.ExtractionDataContinue)).toBe(
      ExtractorEventType.ExtractionDataProgress
    );
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionAttachmentsStart)
    ).toBe(ExtractorEventType.ExtractionAttachmentsProgress);
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionAttachmentsContinue)
    ).toBe(ExtractorEventType.ExtractionAttachmentsProgress);
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionExternalSyncUnitsStart)
    ).toBe(ExtractorEventType.ExtractionExternalSyncUnitsError);
  });
});
