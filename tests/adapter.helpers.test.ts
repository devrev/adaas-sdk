import {
  createFormData,
  createArtifact,
  getTimeoutExtractorEventType,
} from '../src/common/helpers';

import { EventType, ExtractorEventType } from '../src/types';

describe('adapter.helpers.ts', () => {
  it("should create a FormData object with the correct 'key' and 'value'", () => {
    const preparedArtifact = {
      form_data: [{ key: 'key', value: 'value' }],
    };
    const fetchedObjects = [{ key: 'value' }];

    const formData = createFormData(preparedArtifact, fetchedObjects);

    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('key')).toBe('value');
  });

  it("should create a FormData object with the correct 'file' key", () => {
    const preparedArtifact = {
      form_data: [{ key: 'key', value: 'value' }],
    };
    const fetchedObjects = [{ key: 'value' }];

    const formData = createFormData(preparedArtifact, fetchedObjects);

    expect(formData.get('file')).toBeDefined();
  });

  it("should create an Artifact object with the correct 'item_count', 'id', and 'item_type'", () => {
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

  it('should return the correct ExtractorEventType', () => {
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionMetadataStart)
    ).toStrictEqual({
      eventType: ExtractorEventType.ExtractionMetadataError,
      isError: true,
    });
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionDataStart)
    ).toStrictEqual({
      eventType: ExtractorEventType.ExtractionDataProgress,
      isError: false,
    });
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionDataContinue)
    ).toStrictEqual({
      eventType: ExtractorEventType.ExtractionDataProgress,
      isError: false,
    });
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionAttachmentsStart)
    ).toStrictEqual({
      eventType: ExtractorEventType.ExtractionAttachmentsProgress,
      isError: false,
    });
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionAttachmentsContinue)
    ).toStrictEqual({
      eventType: ExtractorEventType.ExtractionAttachmentsProgress,
      isError: false,
    });
    expect(
      getTimeoutExtractorEventType(EventType.ExtractionExternalSyncUnitsStart)
    ).toStrictEqual({
      eventType: ExtractorEventType.ExtractionExternalSyncUnitsError,
      isError: true,
    });
  });
});
