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

    it('should return MetadataExtractionError for deprecated ExtractionMetadataStart', () => {
      // Arrange
      const eventType = EventType.ExtractionMetadataStart;

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

    it('should return DataExtractionError for deprecated ExtractionDataStart', () => {
      // Arrange
      const eventType = EventType.ExtractionDataStart;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(ExtractorEventType.DataExtractionError);
    });

    it('should return DataExtractionError for deprecated ExtractionDataContinue', () => {
      // Arrange
      const eventType = EventType.ExtractionDataContinue;

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

    it('should return ExtractorStateDeletionError for deprecated ExtractionDataDelete', () => {
      // Arrange
      const eventType = EventType.ExtractionDataDelete;

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

    it('should return AttachmentExtractionError for deprecated ExtractionAttachmentsStart', () => {
      // Arrange
      const eventType = EventType.ExtractionAttachmentsStart;

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(
        ExtractorEventType.AttachmentExtractionError
      );
    });

    it('should return AttachmentExtractionError for deprecated ExtractionAttachmentsContinue', () => {
      // Arrange
      const eventType = EventType.ExtractionAttachmentsContinue;

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

    it('should return ExtractorAttachmentsStateDeletionError for deprecated ExtractionAttachmentsDelete', () => {
      // Arrange
      const eventType = EventType.ExtractionAttachmentsDelete;

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

    it('should return ExternalSyncUnitExtractionError for deprecated ExtractionExternalSyncUnitsStart', () => {
      // Arrange
      const eventType = EventType.ExtractionExternalSyncUnitsStart;

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
    it('[edge] should return UnknownEventType and log error for unrecognized event type', () => {
      // Arrange
      const eventType = EventType.UnknownEventType;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const result = getTimeoutErrorEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.UnknownEventType);
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
    it('[edge] should return UnknownEventType and log error for unrecognized event type', () => {
      // Arrange
      const eventType = EventType.StartExtractingData;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.UnknownEventType);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Event type not recognized in getNoScriptEventType function: ' +
          eventType
      );

      // Cleanup
      consoleErrorSpy.mockRestore();
    });

    it('[edge] should return UnknownEventType for StartLoadingData', () => {
      // Arrange
      const eventType = EventType.StartLoadingData;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const result = getNoScriptEventType(eventType);

      // Assert
      expect(result.eventType).toBe(LoaderEventType.UnknownEventType);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Cleanup
      consoleErrorSpy.mockRestore();
    });
  });
});
