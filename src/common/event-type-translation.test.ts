import { EventType, ExtractorEventType } from '../types/extraction';
import { LoaderEventType } from '../types/loading';
import {
  translateExtractorEventType,
  translateIncomingEventType,
  translateLoaderEventType,
  translateOutgoingEventType,
} from './event-type-translation';

// These are pure unit tests for the translation module. The integration
// end-to-end behaviour is already exercised via src/tests/backwards-compatibility/.
// These tests exist to lock in the per-case mappings so a typo in the dictionary
// is caught before shipping.

describe('translateIncomingEventType', () => {
  it.each([
    [
      EventType.ExtractionExternalSyncUnitsStart,
      EventType.StartExtractingExternalSyncUnits,
    ],
    [EventType.ExtractionMetadataStart, EventType.StartExtractingMetadata],
    [EventType.ExtractionDataStart, EventType.StartExtractingData],
    [EventType.ExtractionDataContinue, EventType.ContinueExtractingData],
    [EventType.ExtractionDataDelete, EventType.StartDeletingExtractorState],
    [
      EventType.ExtractionAttachmentsStart,
      EventType.StartExtractingAttachments,
    ],
    [
      EventType.ExtractionAttachmentsContinue,
      EventType.ContinueExtractingAttachments,
    ],
    [
      EventType.ExtractionAttachmentsDelete,
      EventType.StartDeletingExtractorAttachmentsState,
    ],
  ])('maps legacy extraction event %s to %s', (legacy, modern) => {
    expect(translateIncomingEventType(legacy)).toBe(modern);
  });

  it.each([
    [EventType.StartExtractingExternalSyncUnits],
    [EventType.StartExtractingMetadata],
    [EventType.StartExtractingData],
    [EventType.ContinueExtractingData],
    [EventType.StartDeletingExtractorState],
    [EventType.StartExtractingAttachments],
    [EventType.ContinueExtractingAttachments],
    [EventType.StartDeletingExtractorAttachmentsState],
    [EventType.StartLoadingData],
    [EventType.ContinueLoadingData],
    [EventType.StartLoadingAttachments],
    [EventType.ContinueLoadingAttachments],
    [EventType.StartDeletingLoaderState],
    [EventType.StartDeletingLoaderAttachmentState],
    [EventType.UnknownEventType],
  ])('is a no-op for already-modern event type %s', (eventType) => {
    expect(translateIncomingEventType(eventType)).toBe(eventType);
  });

  it('warns and returns the input verbatim for an unrecognised event type', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = translateIncomingEventType('NONSENSE_EVENT' as EventType);

    expect(result).toBe('NONSENSE_EVENT');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('NONSENSE_EVENT')
    );

    warnSpy.mockRestore();
  });
});

describe('translateExtractorEventType', () => {
  it.each([
    [
      ExtractorEventType.ExtractionExternalSyncUnitsDone,
      ExtractorEventType.ExternalSyncUnitExtractionDone,
    ],
    [
      ExtractorEventType.ExtractionExternalSyncUnitsError,
      ExtractorEventType.ExternalSyncUnitExtractionError,
    ],
    [
      ExtractorEventType.ExtractionMetadataDone,
      ExtractorEventType.MetadataExtractionDone,
    ],
    [
      ExtractorEventType.ExtractionMetadataError,
      ExtractorEventType.MetadataExtractionError,
    ],
    [
      ExtractorEventType.ExtractionDataProgress,
      ExtractorEventType.DataExtractionProgress,
    ],
    [
      ExtractorEventType.ExtractionDataDelay,
      ExtractorEventType.DataExtractionDelayed,
    ],
    [
      ExtractorEventType.ExtractionDataDone,
      ExtractorEventType.DataExtractionDone,
    ],
    [
      ExtractorEventType.ExtractionDataError,
      ExtractorEventType.DataExtractionError,
    ],
    [
      ExtractorEventType.ExtractionDataDeleteDone,
      ExtractorEventType.ExtractorStateDeletionDone,
    ],
    [
      ExtractorEventType.ExtractionDataDeleteError,
      ExtractorEventType.ExtractorStateDeletionError,
    ],
    [
      ExtractorEventType.ExtractionAttachmentsProgress,
      ExtractorEventType.AttachmentExtractionProgress,
    ],
    [
      ExtractorEventType.ExtractionAttachmentsDelay,
      ExtractorEventType.AttachmentExtractionDelayed,
    ],
    [
      ExtractorEventType.ExtractionAttachmentsDone,
      ExtractorEventType.AttachmentExtractionDone,
    ],
    [
      ExtractorEventType.ExtractionAttachmentsError,
      ExtractorEventType.AttachmentExtractionError,
    ],
    [
      ExtractorEventType.ExtractionAttachmentsDeleteDone,
      ExtractorEventType.ExtractorAttachmentsStateDeletionDone,
    ],
    [
      ExtractorEventType.ExtractionAttachmentsDeleteError,
      ExtractorEventType.ExtractorAttachmentsStateDeletionError,
    ],
  ])('maps legacy extractor event %s to %s', (legacy, modern) => {
    expect(translateExtractorEventType(legacy)).toBe(modern);
  });

  it.each([
    [ExtractorEventType.DataExtractionDone],
    [ExtractorEventType.DataExtractionProgress],
    [ExtractorEventType.AttachmentExtractionDone],
    [ExtractorEventType.MetadataExtractionDone],
    [ExtractorEventType.UnknownEventType],
  ])('is a no-op for already-modern extractor event %s', (eventType) => {
    expect(translateExtractorEventType(eventType)).toBe(eventType);
  });
});

describe('translateLoaderEventType', () => {
  it.each([
    [LoaderEventType.DataLoadingDelay, LoaderEventType.DataLoadingDelayed],
    [
      LoaderEventType.AttachmentsLoadingProgress,
      LoaderEventType.AttachmentLoadingProgress,
    ],
    [
      LoaderEventType.AttachmentsLoadingDelayed,
      LoaderEventType.AttachmentLoadingDelayed,
    ],
    [
      LoaderEventType.AttachmentsLoadingDone,
      LoaderEventType.AttachmentLoadingDone,
    ],
    [
      LoaderEventType.AttachmentsLoadingError,
      LoaderEventType.AttachmentLoadingError,
    ],
  ])('maps legacy loader event %s to %s', (legacy, modern) => {
    expect(translateLoaderEventType(legacy)).toBe(modern);
  });

  it.each([
    [LoaderEventType.DataLoadingDone],
    [LoaderEventType.DataLoadingProgress],
    [LoaderEventType.AttachmentLoadingDone],
  ])('is a no-op for already-modern loader event %s', (eventType) => {
    expect(translateLoaderEventType(eventType)).toBe(eventType);
  });
});

describe('translateOutgoingEventType', () => {
  it('routes extractor events through translateExtractorEventType', () => {
    expect(
      translateOutgoingEventType(ExtractorEventType.ExtractionDataDone)
    ).toBe(ExtractorEventType.DataExtractionDone);
  });

  it('routes loader events through translateLoaderEventType', () => {
    expect(
      translateOutgoingEventType(LoaderEventType.AttachmentsLoadingDone)
    ).toBe(LoaderEventType.AttachmentLoadingDone);
  });

  it('passes through unknown event types unchanged', () => {
    const unknown = 'SOME_UNKNOWN_EVENT' as ExtractorEventType;
    expect(translateOutgoingEventType(unknown)).toBe(unknown);
  });
});
