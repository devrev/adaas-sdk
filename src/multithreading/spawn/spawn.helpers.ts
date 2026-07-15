import { UNKNOWN_EVENT_TYPE } from '../../common/constants';
import { EventType, ExtractorEventType } from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';
import { TaskStatus } from '../../types/workers';

/**
 * Resolves the outgoing event type the SDK should emit for a given incoming
 * event type and the {@link TaskResult} status a worker returned.
 *
 * The mapping follows the per-phase contract documented on `TaskResult`:
 * resumable phases (data/attachment extraction, data/attachment loading) honor
 * every status (success -> *_DONE, progress -> *_PROGRESS, delay -> *_DELAYED,
 * error -> *_ERROR); non-resumable phases (external sync units, metadata, state
 * deletion) only have a done and an error event, so a `progress`/`delay` status
 * there is illegal and is mapped to the phase's error event.
 *
 * @param eventType - The incoming event type that started this worker.
 * @param status - The status the worker's task/onTimeout returned.
 * @returns The outgoing extractor/loader event type to emit, plus whether the
 * status was illegal for the phase (so the caller can attach a descriptive
 * error message).
 */
export function getEventTypeForResult(
  eventType: EventType,
  status: TaskStatus
): {
  eventType: ExtractorEventType | LoaderEventType;
  illegal: boolean;
} {
  const phase = EVENT_PHASE_MAP[eventType];

  if (!phase) {
    console.error(
      'Event type not recognized in getEventTypeForResult function: ' +
        eventType
    );
    return {
      eventType: UNKNOWN_EVENT_TYPE as ExtractorEventType | LoaderEventType,
      illegal: true,
    };
  }

  // Non-resumable phases only define done/error events.
  if (!phase.resumable) {
    if (status === 'success') {
      return { eventType: phase.done, illegal: false };
    }
    // progress/delay are illegal here; collapse them (and error) to the error event.
    return { eventType: phase.error, illegal: status !== 'error' };
  }

  switch (status) {
    case 'success':
      return { eventType: phase.done, illegal: false };
    case 'progress':
      return { eventType: phase.progress!, illegal: false };
    case 'delay':
      return { eventType: phase.delayed!, illegal: false };
    case 'error':
      return { eventType: phase.error, illegal: false };
  }
}

/**
 * Per-phase outgoing event types, keyed by the incoming {@link EventType}.
 * `resumable` phases define progress/delayed events; non-resumable ones do not.
 */
const EVENT_PHASE_MAP: Partial<
  Record<
    EventType,
    {
      resumable: boolean;
      done: ExtractorEventType | LoaderEventType;
      error: ExtractorEventType | LoaderEventType;
      progress?: ExtractorEventType | LoaderEventType;
      delayed?: ExtractorEventType | LoaderEventType;
    }
  >
> = {
  // External sync units (non-resumable)
  [EventType.StartExtractingExternalSyncUnits]: {
    resumable: false,
    done: ExtractorEventType.ExternalSyncUnitExtractionDone,
    error: ExtractorEventType.ExternalSyncUnitExtractionError,
  },
  // Metadata (non-resumable)
  [EventType.StartExtractingMetadata]: {
    resumable: false,
    done: ExtractorEventType.MetadataExtractionDone,
    error: ExtractorEventType.MetadataExtractionError,
  },
  // Data extraction (resumable)
  [EventType.StartExtractingData]: {
    resumable: true,
    done: ExtractorEventType.DataExtractionDone,
    error: ExtractorEventType.DataExtractionError,
    progress: ExtractorEventType.DataExtractionProgress,
    delayed: ExtractorEventType.DataExtractionDelayed,
  },
  [EventType.ContinueExtractingData]: {
    resumable: true,
    done: ExtractorEventType.DataExtractionDone,
    error: ExtractorEventType.DataExtractionError,
    progress: ExtractorEventType.DataExtractionProgress,
    delayed: ExtractorEventType.DataExtractionDelayed,
  },
  // Extractor state deletion (non-resumable)
  [EventType.StartDeletingExtractorState]: {
    resumable: false,
    done: ExtractorEventType.ExtractorStateDeletionDone,
    error: ExtractorEventType.ExtractorStateDeletionError,
  },
  // Attachment extraction (resumable)
  [EventType.StartExtractingAttachments]: {
    resumable: true,
    done: ExtractorEventType.AttachmentExtractionDone,
    error: ExtractorEventType.AttachmentExtractionError,
    progress: ExtractorEventType.AttachmentExtractionProgress,
    delayed: ExtractorEventType.AttachmentExtractionDelayed,
  },
  [EventType.ContinueExtractingAttachments]: {
    resumable: true,
    done: ExtractorEventType.AttachmentExtractionDone,
    error: ExtractorEventType.AttachmentExtractionError,
    progress: ExtractorEventType.AttachmentExtractionProgress,
    delayed: ExtractorEventType.AttachmentExtractionDelayed,
  },
  // Extractor attachments state deletion (non-resumable)
  [EventType.StartDeletingExtractorAttachmentsState]: {
    resumable: false,
    done: ExtractorEventType.ExtractorAttachmentsStateDeletionDone,
    error: ExtractorEventType.ExtractorAttachmentsStateDeletionError,
  },
  // Data loading (resumable)
  [EventType.StartLoadingData]: {
    resumable: true,
    done: LoaderEventType.DataLoadingDone,
    error: LoaderEventType.DataLoadingError,
    progress: LoaderEventType.DataLoadingProgress,
    delayed: LoaderEventType.DataLoadingDelayed,
  },
  [EventType.ContinueLoadingData]: {
    resumable: true,
    done: LoaderEventType.DataLoadingDone,
    error: LoaderEventType.DataLoadingError,
    progress: LoaderEventType.DataLoadingProgress,
    delayed: LoaderEventType.DataLoadingDelayed,
  },
  // Attachment loading (resumable)
  [EventType.StartLoadingAttachments]: {
    resumable: true,
    done: LoaderEventType.AttachmentLoadingDone,
    error: LoaderEventType.AttachmentLoadingError,
    progress: LoaderEventType.AttachmentLoadingProgress,
    delayed: LoaderEventType.AttachmentLoadingDelayed,
  },
  [EventType.ContinueLoadingAttachments]: {
    resumable: true,
    done: LoaderEventType.AttachmentLoadingDone,
    error: LoaderEventType.AttachmentLoadingError,
    progress: LoaderEventType.AttachmentLoadingProgress,
    delayed: LoaderEventType.AttachmentLoadingDelayed,
  },
  // Loader state deletion (non-resumable)
  [EventType.StartDeletingLoaderState]: {
    resumable: false,
    done: LoaderEventType.LoaderStateDeletionDone,
    error: LoaderEventType.LoaderStateDeletionError,
  },
  // Loader attachment state deletion (non-resumable)
  [EventType.StartDeletingLoaderAttachmentState]: {
    resumable: false,
    done: LoaderEventType.LoaderAttachmentStateDeletionDone,
    error: LoaderEventType.LoaderAttachmentStateDeletionError,
  },
};

/**
 * Gets the event type for the timeout error.
 * @param {EventType} eventType - The event type to get the timeout error event type for
 * @returns {ExtractorEventType | LoaderEventType} The event type for the timeout error
 */
export function getTimeoutErrorEventType(eventType: EventType): {
  eventType: ExtractorEventType | LoaderEventType;
} {
  switch (eventType) {
    // Metadata extraction
    case EventType.StartExtractingMetadata:
      return {
        eventType: ExtractorEventType.MetadataExtractionError,
      };

    // Data extraction
    case EventType.StartExtractingData:
    case EventType.ContinueExtractingData:
      return {
        eventType: ExtractorEventType.DataExtractionError,
      };

    // Data deletion
    case EventType.StartDeletingExtractorState:
      return {
        eventType: ExtractorEventType.ExtractorStateDeletionError,
      };

    // Attachments extraction
    case EventType.StartExtractingAttachments:
    case EventType.ContinueExtractingAttachments:
      return {
        eventType: ExtractorEventType.AttachmentExtractionError,
      };

    // Attachments deletion
    case EventType.StartDeletingExtractorAttachmentsState:
      return {
        eventType: ExtractorEventType.ExtractorAttachmentsStateDeletionError,
      };

    // External sync units
    case EventType.StartExtractingExternalSyncUnits:
      return {
        eventType: ExtractorEventType.ExternalSyncUnitExtractionError,
      };

    // Loading data
    case EventType.StartLoadingData:
    case EventType.ContinueLoadingData:
      return {
        eventType: LoaderEventType.DataLoadingError,
      };

    // Deleting loader state
    case EventType.StartDeletingLoaderState:
      return {
        eventType: LoaderEventType.LoaderStateDeletionError,
      };

    // Loading attachments
    case EventType.StartLoadingAttachments:
    case EventType.ContinueLoadingAttachments:
      return {
        eventType: LoaderEventType.AttachmentLoadingError,
      };

    // Deleting loader attachment state
    case EventType.StartDeletingLoaderAttachmentState:
      return {
        eventType: LoaderEventType.LoaderAttachmentStateDeletionError,
      };

    default:
      console.error(
        'Event type not recognized in getTimeoutErrorEventType function: ' +
          eventType
      );
      return {
        eventType: UNKNOWN_EVENT_TYPE as ExtractorEventType | LoaderEventType,
      };
  }
}

/**
 * Gets the event type for the no script error.
 * @param {EventType} eventType - The event type to get the no script error event type for
 * @returns {ExtractorEventType | LoaderEventType} The event type for the no script error
 */
export function getNoScriptEventType(eventType: EventType) {
  switch (eventType) {
    case EventType.StartDeletingExtractorState:
      return {
        eventType: ExtractorEventType.ExtractorStateDeletionDone,
      };
    case EventType.StartDeletingExtractorAttachmentsState:
      return {
        eventType: ExtractorEventType.ExtractorAttachmentsStateDeletionDone,
      };
    case EventType.StartDeletingLoaderState:
      return {
        eventType: LoaderEventType.LoaderStateDeletionDone,
      };
    case EventType.StartDeletingLoaderAttachmentState:
      return {
        eventType: LoaderEventType.LoaderAttachmentStateDeletionDone,
      };
    default:
      console.error(
        'Event type not recognized in getNoScriptEventType function: ' +
          eventType
      );
      return {
        eventType: UNKNOWN_EVENT_TYPE as ExtractorEventType | LoaderEventType,
      };
  }
}
