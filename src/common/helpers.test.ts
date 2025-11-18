import { EventType, ExtractorEventType } from '../types/extraction';
import { ItemTypeToLoad, LoaderEventType, StatsFileObject } from '../types/loading';
import { getFilesToLoad, getTimeoutErrorEventType } from './helpers';

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

describe(getTimeoutErrorEventType.name, () => {
  const cases: Array<{ input: EventType; expected: ExtractorEventType | LoaderEventType }> = [
    { input: EventType.ExtractionMetadataStart, expected: ExtractorEventType.ExtractionMetadataError },
    { input: EventType.ExtractionDataStart, expected: ExtractorEventType.ExtractionDataError },
    { input: EventType.ExtractionDataContinue, expected: ExtractorEventType.ExtractionDataError },
    { input: EventType.ExtractionDataDelete, expected: ExtractorEventType.ExtractionDataDeleteError },
    { input: EventType.ExtractionAttachmentsStart, expected: ExtractorEventType.ExtractionAttachmentsError },
    { input: EventType.ExtractionAttachmentsContinue, expected: ExtractorEventType.ExtractionAttachmentsError },
    { input: EventType.ExtractionAttachmentsDelete, expected: ExtractorEventType.ExtractionAttachmentsDeleteError },
    { input: EventType.ExtractionExternalSyncUnitsStart, expected: ExtractorEventType.ExtractionExternalSyncUnitsError },
    { input: EventType.StartLoadingData, expected: LoaderEventType.DataLoadingError },
    { input: EventType.ContinueLoadingData, expected: LoaderEventType.DataLoadingError },
    { input: EventType.StartDeletingLoaderState, expected: LoaderEventType.LoaderStateDeletionError },
    { input: EventType.StartLoadingAttachments, expected: LoaderEventType.AttachmentLoadingError },
    { input: EventType.ContinueLoadingAttachments, expected: LoaderEventType.AttachmentLoadingError },
    {
      input: EventType.StartDeletingLoaderAttachmentState,
      expected: LoaderEventType.LoaderAttachmentStateDeletionError,
    },
  ];

  it.each(cases)('maps %s to %s', ({ input, expected }) => {
    expect(getTimeoutErrorEventType(input).eventType).toBe(expected);
  });

  it('falls back to unknown event type for unmapped events', () => {
    expect(getTimeoutErrorEventType('UNMAPPED_EVENT' as EventType).eventType).toBe(
      LoaderEventType.UnknownEventType
    );
  });
});
