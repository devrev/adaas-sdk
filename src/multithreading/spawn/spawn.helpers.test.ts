import { UNKNOWN_EVENT_TYPE } from '../../common/constants';
import { EventType, ExtractorEventType } from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';

import {
  getNoScriptEventType,
  getTimeoutErrorEventType,
} from './spawn.helpers';

describe(getTimeoutErrorEventType.name, () => {
  describe('metadata extraction', () => {
    it('should return MetadataExtractionError for StartExtractingMetadata', () => {
      // Arrange
      const eventType = EventType.StartExtractingMetadata;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(ExtractorEventType.MetadataExtractionError);
    });

    it('should return MetadataExtractionError for StartExtractingMetadata (renamed from ExtractionMetadataStart)', () => {
      // Arrange
      const eventType = EventType.StartExtractingMetadata;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(ExtractorEventType.MetadataExtractionError);
    });
  });

  describe('data extraction', () => {
    it('should return DataExtractionError for StartExtractingData', () => {
      // Arrange
      const eventType = EventType.StartExtractingData;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(ExtractorEventType.DataExtractionError);
    });

    it('should return DataExtractionError for ContinueExtractingData', () => {
      // Arrange
      const eventType = EventType.ContinueExtractingData;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(ExtractorEventType.DataExtractionError);
    });

    it('should return DataExtractionError for StartExtractingData (renamed from ExtractionDataStart)', () => {
      // Arrange
      const eventType = EventType.StartExtractingData;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(ExtractorEventType.DataExtractionError);
    });

    it('should return DataExtractionError for ContinueExtractingData (renamed from ExtractionDataContinue)', () => {
      // Arrange
      const eventType = EventType.ContinueExtractingData;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(ExtractorEventType.DataExtractionError);
    });
  });

  describe('extractor state deletion', () => {
    it('should return ExtractorStateDeletionError for StartDeletingExtractorState', () => {
      // Arrange
      const eventType = EventType.StartDeletingExtractorState;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExtractorStateDeletionError
      );
    });

    it('should return ExtractorStateDeletionError for StartDeletingExtractorState (renamed from ExtractionDataDelete)', () => {
      // Arrange
      const eventType = EventType.StartDeletingExtractorState;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExtractorStateDeletionError
      );
    });
  });

  describe('attachments extraction', () => {
    it('should return AttachmentExtractionError for StartExtractingAttachments', () => {
      // Arrange
      const eventType = EventType.StartExtractingAttachments;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.AttachmentExtractionError
      );
    });

    it('should return AttachmentExtractionError for ContinueExtractingAttachments', () => {
      // Arrange
      const eventType = EventType.ContinueExtractingAttachments;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.AttachmentExtractionError
      );
    });

    it('should return AttachmentExtractionError for StartExtractingAttachments (renamed from ExtractionAttachmentsStart)', () => {
      // Arrange
      const eventType = EventType.StartExtractingAttachments;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.AttachmentExtractionError
      );
    });

    it('should return AttachmentExtractionError for ContinueExtractingAttachments (renamed from ExtractionAttachmentsContinue)', () => {
      // Arrange
      const eventType = EventType.ContinueExtractingAttachments;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.AttachmentExtractionError
      );
    });
  });

  describe('extractor attachments state deletion', () => {
    it('should return ExtractorAttachmentsStateDeletionError for StartDeletingExtractorAttachmentsState', () => {
      // Arrange
      const eventType = EventType.StartDeletingExtractorAttachmentsState;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExtractorAttachmentsStateDeletionError
      );
    });

    it('should return ExtractorAttachmentsStateDeletionError for StartDeletingExtractorAttachmentsState (renamed from ExtractionAttachmentsDelete)', () => {
      // Arrange
      const eventType = EventType.StartDeletingExtractorAttachmentsState;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExtractorAttachmentsStateDeletionError
      );
    });
  });

  describe('external sync units extraction', () => {
    it('should return ExternalSyncUnitExtractionError for StartExtractingExternalSyncUnits', () => {
      // Arrange
      const eventType = EventType.StartExtractingExternalSyncUnits;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExternalSyncUnitExtractionError
      );
    });

    it('should return ExternalSyncUnitExtractionError for StartExtractingExternalSyncUnits (renamed from ExtractionExternalSyncUnitsStart)', () => {
      // Arrange
      const eventType = EventType.StartExtractingExternalSyncUnits;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExternalSyncUnitExtractionError
      );
    });
  });

  describe('data loading', () => {
    it('should return DataLoadingError for StartLoadingData', () => {
      // Arrange
      const eventType = EventType.StartLoadingData;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.DataLoadingError);
    });

    it('should return DataLoadingError for ContinueLoadingData', () => {
      // Arrange
      const eventType = EventType.ContinueLoadingData;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.DataLoadingError);
    });
  });

  describe('loader state deletion', () => {
    it('should return LoaderStateDeletionError for StartDeletingLoaderState', () => {
      // Arrange
      const eventType = EventType.StartDeletingLoaderState;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.LoaderStateDeletionError);
    });
  });

  describe('attachment loading', () => {
    it('should return AttachmentLoadingError for StartLoadingAttachments', () => {
      // Arrange
      const eventType = EventType.StartLoadingAttachments;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.AttachmentLoadingError);
    });

    it('should return AttachmentLoadingError for ContinueLoadingAttachments', () => {
      // Arrange
      const eventType = EventType.ContinueLoadingAttachments;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.AttachmentLoadingError);
    });
  });

  describe('loader attachment state deletion', () => {
    it('should return LoaderAttachmentStateDeletionError for StartDeletingLoaderAttachmentState', () => {
      // Arrange
      const eventType = EventType.StartDeletingLoaderAttachmentState;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        LoaderEventType.LoaderAttachmentStateDeletionError
      );
    });
  });

  describe('unknown event types', () => {
    it('[edge] should return UNKNOWN_EVENT_TYPE and log error for unrecognized event type', () => {
      // Arrange
      const eventType = 'TOTALLY_UNKNOWN' as EventType;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(UNKNOWN_EVENT_TYPE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Event type not recognized in getTimeoutErrorEventType function: ' +
          eventType
      );

      // Cleanup
      consoleErrorSpy.mockRestore();
    });
  });
});

describe(getNoScriptEventType.name, () => {
  describe('extractor state deletion', () => {
    it('should return ExtractorStateDeletionDone for StartDeletingExtractorState', () => {
      // Arrange
      const eventType = EventType.StartDeletingExtractorState;

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExtractorStateDeletionDone
      );
    });
  });

  describe('extractor attachments state deletion', () => {
    it('should return ExtractorAttachmentsStateDeletionDone for StartDeletingExtractorAttachmentsState', () => {
      // Arrange
      const eventType = EventType.StartDeletingExtractorAttachmentsState;

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.ExtractorAttachmentsStateDeletionDone
      );
    });
  });

  describe('loader state deletion', () => {
    it('should return LoaderStateDeletionDone for StartDeletingLoaderState', () => {
      // Arrange
      const eventType = EventType.StartDeletingLoaderState;

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.LoaderStateDeletionDone);
    });
  });

  describe('loader attachment state deletion', () => {
    it('should return LoaderAttachmentStateDeletionDone for StartDeletingLoaderAttachmentState', () => {
      // Arrange
      const eventType = EventType.StartDeletingLoaderAttachmentState;

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        LoaderEventType.LoaderAttachmentStateDeletionDone
      );
    });
  });

  describe('unknown event types', () => {
    it('[edge] should return UNKNOWN_EVENT_TYPE and log error for unrecognized event type', () => {
      // Arrange
      const eventType = EventType.StartExtractingData;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(UNKNOWN_EVENT_TYPE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Event type not recognized in getNoScriptEventType function: ' +
          eventType
      );

      // Cleanup
      consoleErrorSpy.mockRestore();
    });

    it('[edge] should return UNKNOWN_EVENT_TYPE for StartLoadingData', () => {
      // Arrange
      const eventType = EventType.StartLoadingData;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(UNKNOWN_EVENT_TYPE);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Cleanup
      consoleErrorSpy.mockRestore();
    });
  });
});
