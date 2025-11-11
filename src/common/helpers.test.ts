import { EventTypeV2 } from '../types/extraction';
import { ItemTypeToLoad, StatsFileObject } from '../types/loading';
import { getEventType, getFilesToLoad } from './helpers';

describe(getFilesToLoad.name, () => {
  let statsFile: StatsFileObject[];

  beforeEach(() => {
    statsFile = [
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/2',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'issues',
        count: '79',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/5',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'comments',
        count: '1079',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/9',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'issues',
        count: '1921',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/14',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'comments',
        count: '921',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'attachments',
        count: '50',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'unknown',
        count: '50',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'issues',
        count: '32',
      },
    ];
  });

  it('should filter files by supported item types and order them correctly', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'attachments', create: jest.fn(), update: jest.fn() },
      { itemType: 'issues', create: jest.fn(), update: jest.fn() },
    ];
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });
    expect(result).toEqual([
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        itemType: 'attachments',
        count: 50,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/2',
        itemType: 'issues',
        count: 79,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/9',
        itemType: 'issues',
        count: 1921,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        itemType: 'issues',
        count: 32,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
    ]);
  });

  it('should ignore files with unrecognized item types in statsFile', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'issues', create: jest.fn(), update: jest.fn() },
    ];
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });

    expect(result).toEqual([
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/2',
        itemType: 'issues',
        count: 79,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/9',
        itemType: 'issues',
        count: 1921,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        itemType: 'issues',
        count: 32,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
    ]);
  });

  it('[edge] should return an empty array when statsFile is empty', () => {
    statsFile = [];
    const itemTypesToLoad: ItemTypeToLoad[] = [];
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });
    expect(result).toEqual([]);
  });

  it('[edge] should return an empty array when itemTypesToLoad is empty', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [];
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });
    expect(result).toEqual([]);
  });

  it('[edge] should return an empty array when statsFile has no matching items', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'users', create: jest.fn(), update: jest.fn() },
    ];
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });
    expect(result).toEqual([]);
  });
});

describe(getEventType.name, () => {
  it('should translate old EventType (V1) values to EventTypeV2', () => {
    // Old EventType values should be translated to EventTypeV2
    expect(getEventType('EXTRACTION_EXTERNAL_SYNC_UNITS_START')).toBe(
      EventTypeV2.ExtractionExternalSyncUnitsStart
    );
    expect(getEventType('EXTRACTION_METADATA_START')).toBe(
      EventTypeV2.ExtractionMetadataStart
    );
    expect(getEventType('EXTRACTION_DATA_START')).toBe(
      EventTypeV2.ExtractionDataStart
    );
    expect(getEventType('EXTRACTION_DATA_CONTINUE')).toBe(
      EventTypeV2.ExtractionDataContinue
    );
    expect(getEventType('EXTRACTION_DATA_DELETE')).toBe(
      EventTypeV2.ExtractionDataDelete
    );
    expect(getEventType('EXTRACTION_ATTACHMENTS_START')).toBe(
      EventTypeV2.ExtractionAttachmentsStart
    );
    expect(getEventType('EXTRACTION_ATTACHMENTS_CONTINUE')).toBe(
      EventTypeV2.ExtractionAttachmentsContinue
    );
    expect(getEventType('EXTRACTION_ATTACHMENTS_DELETE')).toBe(
      EventTypeV2.ExtractionAttachmentsDelete
    );
  });

  it('should return EventTypeV2 values as-is', () => {
    // EventTypeV2 values should be returned as-is
    expect(getEventType('START_EXTRACTING_EXTERNAL_SYNC_UNITS')).toBe(
      EventTypeV2.ExtractionExternalSyncUnitsStart
    );
    expect(getEventType('START_EXTRACTING_METADATA')).toBe(
      EventTypeV2.ExtractionMetadataStart
    );
    expect(getEventType('START_EXTRACTING_DATA')).toBe(
      EventTypeV2.ExtractionDataStart
    );
    expect(getEventType('CONTINUE_EXTRACTING_DATA')).toBe(
      EventTypeV2.ExtractionDataContinue
    );
    expect(getEventType('START_DELETING_EXTRACTOR_STATE')).toBe(
      EventTypeV2.ExtractionDataDelete
    );
    expect(getEventType('START_EXTRACTING_ATTACHMENTS')).toBe(
      EventTypeV2.ExtractionAttachmentsStart
    );
    expect(getEventType('CONTINUE_EXTRACTING_ATTACHMENTS')).toBe(
      EventTypeV2.ExtractionAttachmentsContinue
    );
    expect(getEventType('START_DELETING_EXTRACTOR_ATTACHMENTS_STATE')).toBe(
      EventTypeV2.ExtractionAttachmentsDelete
    );
  });

  it('should handle loading event types', () => {
    expect(getEventType('START_LOADING_DATA')).toBe(
      EventTypeV2.StartLoadingData
    );
    expect(getEventType('CONTINUE_LOADING_DATA')).toBe(
      EventTypeV2.ContinueLoadingData
    );
    expect(getEventType('START_LOADING_ATTACHMENTS')).toBe(
      EventTypeV2.StartLoadingAttachments
    );
    expect(getEventType('CONTINUE_LOADING_ATTACHMENTS')).toBe(
      EventTypeV2.ContinueLoadingAttachments
    );
    expect(getEventType('START_DELETING_LOADER_STATE')).toBe(
      EventTypeV2.StartDeletingLoaderState
    );
    expect(getEventType('START_DELETING_LOADER_ATTACHMENT_STATE')).toBe(
      EventTypeV2.StartDeletingLoaderAttachmentState
    );
  });

  it('should return UnknownEventType for unknown values', () => {
    expect(getEventType('UNKNOWN_VALUE')).toBe(EventTypeV2.UnknownEventType);
    expect(getEventType('INVALID_EVENT_TYPE')).toBe(
      EventTypeV2.UnknownEventType
    );
  });
});
