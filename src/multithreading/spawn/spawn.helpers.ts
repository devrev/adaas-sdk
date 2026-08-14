import { UNKNOWN_EVENT_TYPE } from '../../common/constants';
import { EventType, ExtractorEventType } from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';
import { TaskStatus } from '../../types/workers';

/**
 * Resolves the outgoing event type to emit for an incoming event type and a
 * {@link TaskResult} status. Resumable phases honor every status
 * (success/progress/delay/error -> *_DONE/*_PROGRESS/*_DELAYED/*_ERROR);
 * non-resumable phases only have done/error, so `progress`/`delay` there is
 * illegal and maps to the phase's error event.
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

/** Per-phase outgoing event types, keyed by the incoming {@link EventType}. */
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
  [EventType.StartExtractingExternalSyncUnits]: {
    resumable: false,
    done: ExtractorEventType.ExternalSyncUnitExtractionDone,
    error: ExtractorEventType.ExternalSyncUnitExtractionError,
  },
  [EventType.StartExtractingMetadata]: {
    resumable: false,
    done: ExtractorEventType.MetadataExtractionDone,
    error: ExtractorEventType.MetadataExtractionError,
  },
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
  [EventType.StartDeletingExtractorState]: {
    resumable: false,
    done: ExtractorEventType.ExtractorStateDeletionDone,
    error: ExtractorEventType.ExtractorStateDeletionError,
  },
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
  [EventType.StartDeletingExtractorAttachmentsState]: {
    resumable: false,
    done: ExtractorEventType.ExtractorAttachmentsStateDeletionDone,
    error: ExtractorEventType.ExtractorAttachmentsStateDeletionError,
  },
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
  [EventType.StartDeletingLoaderState]: {
    resumable: false,
    done: LoaderEventType.LoaderStateDeletionDone,
    error: LoaderEventType.LoaderStateDeletionError,
  },
  [EventType.StartDeletingLoaderAttachmentState]: {
    resumable: false,
    done: LoaderEventType.LoaderAttachmentStateDeletionDone,
    error: LoaderEventType.LoaderAttachmentStateDeletionError,
  },
};

export function getTimeoutErrorEventType(eventType: EventType): {
  eventType: ExtractorEventType | LoaderEventType;
} {
  switch (eventType) {
    case EventType.StartExtractingMetadata:
      return {
        eventType: ExtractorEventType.MetadataExtractionError,
      };

    case EventType.StartExtractingData:
    case EventType.ContinueExtractingData:
      return {
        eventType: ExtractorEventType.DataExtractionError,
      };

    case EventType.StartDeletingExtractorState:
      return {
        eventType: ExtractorEventType.ExtractorStateDeletionError,
      };

    case EventType.StartExtractingAttachments:
    case EventType.ContinueExtractingAttachments:
      return {
        eventType: ExtractorEventType.AttachmentExtractionError,
      };

    case EventType.StartDeletingExtractorAttachmentsState:
      return {
        eventType: ExtractorEventType.ExtractorAttachmentsStateDeletionError,
      };

    case EventType.StartExtractingExternalSyncUnits:
      return {
        eventType: ExtractorEventType.ExternalSyncUnitExtractionError,
      };

    case EventType.StartLoadingData:
    case EventType.ContinueLoadingData:
      return {
        eventType: LoaderEventType.DataLoadingError,
      };

    case EventType.StartDeletingLoaderState:
      return {
        eventType: LoaderEventType.LoaderStateDeletionError,
      };

    case EventType.StartLoadingAttachments:
    case EventType.ContinueLoadingAttachments:
      return {
        eventType: LoaderEventType.AttachmentLoadingError,
      };

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

/** Event type to emit when no worker script exists for the incoming event. */
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
