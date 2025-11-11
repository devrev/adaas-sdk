import { readFileSync } from 'fs';
import * as path from 'path';
import * as v8 from 'v8';

import {
  AirdropEvent,
  EventType,
  EventTypeV2,
  ExtractorEventTypeV2,
} from '../types/extraction';
import {
  ActionType,
  FileToLoad,
  LoaderEventType,
  LoaderReport,
  StatsFileObject,
} from '../types/loading';
import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from './constants';

/**
 * Translation table from old EventType (V1) string values to new EventTypeV2 values.
 * This is exported so users can use it to translate event types when using the SDK.
 * The keys are the old EventType enum values, and the values are the new EventTypeV2 enum values.
 */
export const EVENT_TYPE_V1_TO_V2_TRANSLATION_TABLE: Record<
  string,
  EventTypeV2
> = {
  // Old EventType values (V1) to new EventTypeV2 values
  [EventType.ExtractionExternalSyncUnitsStart]:
    EventTypeV2.ExtractionExternalSyncUnitsStart,
  [EventType.ExtractionMetadataStart]: EventTypeV2.ExtractionMetadataStart,
  [EventType.ExtractionDataStart]: EventTypeV2.ExtractionDataStart,
  [EventType.ExtractionDataContinue]: EventTypeV2.ExtractionDataContinue,
  [EventType.ExtractionDataDelete]: EventTypeV2.ExtractionDataDelete,
  [EventType.ExtractionAttachmentsStart]:
    EventTypeV2.ExtractionAttachmentsStart,
  [EventType.ExtractionAttachmentsContinue]:
    EventTypeV2.ExtractionAttachmentsContinue,
  [EventType.ExtractionAttachmentsDelete]:
    EventTypeV2.ExtractionAttachmentsDelete,

  // Loading events (same in both versions)
  [EventType.StartLoadingData]: EventTypeV2.StartLoadingData,
  [EventType.ContinueLoadingData]: EventTypeV2.ContinueLoadingData,
  [EventType.StartLoadingAttachments]: EventTypeV2.StartLoadingAttachments,
  [EventType.ContinueLoadingAttachments]:
    EventTypeV2.ContinueLoadingAttachments,
  [EventType.StartDeletingLoaderState]: EventTypeV2.StartDeletingLoaderState,
  [EventType.StartDeletingLoaderAttachmentState]:
    EventTypeV2.StartDeletingLoaderAttachmentState,
};

/**
 * Translates Event type from old enum values to new EventTypeV2 values
 *
 * @param eventType - The event type string to translate
 * @returns EventTypeV2 - The translated event type with the following behavior:
 *   1) Old EventType (V1) values are translated to new EventTypeV2 format
 *   2) EventTypeV2 values are returned as-is
 *   3) Unknown values return `UnknownEventType`
 */
export function getEventType(eventType: string): EventTypeV2 {
  // If we have a translation for this event type, use it
  if (eventType in EVENT_TYPE_V1_TO_V2_TRANSLATION_TABLE) {
    return EVENT_TYPE_V1_TO_V2_TRANSLATION_TABLE[eventType];
  }

  // Check if it's already a valid EventTypeV2 value
  if (Object.values(EventTypeV2).includes(eventType as EventTypeV2)) {
    return eventType as EventTypeV2;
  }

  // Unknown event type
  return EventTypeV2.UnknownEventType;
}

export function getTimeoutErrorEventType(eventType: EventTypeV2): {
  eventType: ExtractorEventTypeV2 | LoaderEventType;
} {
  switch (eventType) {
    // Extraction metadata
    case EventTypeV2.ExtractionMetadataStart:
      return {
        eventType: ExtractorEventTypeV2.ExtractionMetadataError,
      };

    // Extraction data
    case EventTypeV2.ExtractionDataStart:
    case EventTypeV2.ExtractionDataContinue:
      return {
        eventType: ExtractorEventTypeV2.ExtractionDataError,
      };

    // Extraction data delete
    case EventTypeV2.ExtractionDataDelete:
      return {
        eventType: ExtractorEventTypeV2.ExtractionDataDeleteError,
      };

    // Extraction attachments
    case EventTypeV2.ExtractionAttachmentsStart:
    case EventTypeV2.ExtractionAttachmentsContinue:
      return {
        eventType: ExtractorEventTypeV2.ExtractionAttachmentsError,
      };

    // Extraction attachments delete
    case EventTypeV2.ExtractionAttachmentsDelete:
      return {
        eventType: ExtractorEventTypeV2.ExtractionAttachmentsDeleteError,
      };

    // Extraction external sync units
    case EventTypeV2.ExtractionExternalSyncUnitsStart:
      return {
        eventType: ExtractorEventTypeV2.ExtractionExternalSyncUnitsError,
      };

    // Loading data
    case EventTypeV2.StartLoadingData:
    case EventTypeV2.ContinueLoadingData:
      return {
        eventType: LoaderEventType.DataLoadingError,
      };

    // Loading state deletion
    case EventTypeV2.StartDeletingLoaderState:
      return {
        eventType: LoaderEventType.LoaderStateDeletionError,
      };

    // Loading attachments
    case EventTypeV2.StartLoadingAttachments:
    case EventTypeV2.ContinueLoadingAttachments:
      return {
        eventType: LoaderEventType.AttachmentLoadingError,
      };

    // Loading attachment state deletion
    case EventTypeV2.StartDeletingLoaderAttachmentState:
      return {
        eventType: LoaderEventType.LoaderAttachmentStateDeletionError,
      };

    default:
      console.error(
        'Event type not recognized in getTimeoutErrorEventType function: ' +
          eventType
      );
      return {
        eventType: LoaderEventType.UnknownEventType,
      };
  }
}

export function getSyncDirection({ event }: { event: AirdropEvent }) {
  return event.payload.event_context.mode;
}

export function getFilesToLoad({
  supportedItemTypes,
  statsFile,
}: {
  supportedItemTypes: string[];
  statsFile: StatsFileObject[];
}): FileToLoad[] {
  const filesToLoad = [];

  if (supportedItemTypes.length === 0 || statsFile.length === 0) {
    return [];
  }

  const filteredStatsFile = statsFile.filter((file) =>
    supportedItemTypes.includes(file.item_type)
  );

  const orderedFiles = filteredStatsFile.sort((a, b) => {
    const aIndex = supportedItemTypes.indexOf(a.item_type);
    const bIndex = supportedItemTypes.indexOf(b.item_type);

    return aIndex - bIndex;
  });

  for (const file of orderedFiles) {
    filesToLoad.push({
      id: file.id,
      file_name: file.file_name,
      itemType: file.item_type,
      count: parseInt(file.count),
      completed: false,
      lineToProcess: 0,
    });
  }

  return filesToLoad;
}

export function addReportToLoaderReport({
  loaderReports,
  report,
}: {
  loaderReports: LoaderReport[];
  report: LoaderReport;
}): LoaderReport[] {
  const existingReport = loaderReports.find(
    (loaderReport) => loaderReport.item_type === report.item_type
  );

  if (existingReport) {
    existingReport[ActionType.CREATED] = existingReport[ActionType.CREATED]
      ? report[ActionType.CREATED]
        ? existingReport[ActionType.CREATED] + report[ActionType.CREATED]
        : existingReport[ActionType.CREATED]
      : report[ActionType.CREATED];

    existingReport[ActionType.UPDATED] = existingReport[ActionType.UPDATED]
      ? report[ActionType.UPDATED]
        ? existingReport[ActionType.UPDATED] + report[ActionType.UPDATED]
        : existingReport[ActionType.UPDATED]
      : report[ActionType.UPDATED];

    existingReport[ActionType.FAILED] = existingReport[ActionType.FAILED]
      ? report[ActionType.FAILED]
        ? existingReport[ActionType.FAILED] + report[ActionType.FAILED]
        : existingReport[ActionType.FAILED]
      : report[ActionType.FAILED];
  } else {
    loaderReports.push(report);
  }

  return loaderReports;
}

// read adaas library version from package.json
export function getLibraryVersion() {
  try {
    const version = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
    )?.version;

    if (version) {
      return version;
    }
    return '';
  } catch (error) {
    console.error(
      'Error reading adaas library version from package.json',
      error
    );
    return '';
  }
}

export async function sleep(ms: number) {
  console.log(`Sleeping for ${ms}ms.`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncateFilename(filename: string): string {
  // If the filename is already within the limit, return it as is.
  if (filename.length <= MAX_DEVREV_FILENAME_LENGTH) {
    return filename;
  }

  console.warn(
    `Filename length exceeds the maximum limit of ${MAX_DEVREV_FILENAME_LENGTH} characters. Truncating filename.`
  );

  const extension = filename.slice(-MAX_DEVREV_FILENAME_EXTENSION_LENGTH);
  // Calculate how many characters are available for the name part after accounting for the extension and "..."
  const availableNameLength =
    MAX_DEVREV_FILENAME_LENGTH - MAX_DEVREV_FILENAME_EXTENSION_LENGTH - 3; // -3 for "..."

  // Truncate the name part and add an ellipsis
  const truncatedFilename = filename.slice(0, availableNameLength);

  return `${truncatedFilename}...${extension}`;
}

export interface MemoryInfo {
  rssUsedMB: string;
  rssUsedPercent: string; // Critical for OOM detection
  heapUsedPercent: string; // GC pressure indicator
  externalMB: string; // C++ objects and buffers (HTTP streams, etc.)
  arrayBuffersMB: string; // Buffer data (unclosed streams show here)
  formattedMessage: string;
}

export function getMemoryUsage(): MemoryInfo {
  try {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    const rssUsedMB = memUsage.rss / 1024 / 1024;
    const heapLimitMB = heapStats.heap_size_limit / 1024 / 1024;

    const effectiveMemoryLimitMB = heapLimitMB;

    // Calculate heap values for consistent format
    const heapUsedMB = heapStats.used_heap_size / 1024 / 1024;
    const heapTotalMB = heapStats.heap_size_limit / 1024 / 1024;

    // Calculate external and buffer values (critical for detecting stream leaks)
    const externalMB = memUsage.external / 1024 / 1024;
    const arrayBuffersMB = memUsage.arrayBuffers / 1024 / 1024;

    // Critical percentages for OOM detection
    const rssUsedPercent =
      ((rssUsedMB / effectiveMemoryLimitMB) * 100).toFixed(2) + '%';
    const heapUsedPercent =
      ((heapStats.used_heap_size / heapStats.heap_size_limit) * 100).toFixed(
        2
      ) + '%';

    // Detailed message showing RSS breakdown for leak detection
    const formattedMessage = `Memory: RSS ${rssUsedMB.toFixed(
      2
    )}/${effectiveMemoryLimitMB.toFixed(
      2
    )}MB (${rssUsedPercent}) [Heap ${heapUsedMB.toFixed(
      2
    )}/${heapTotalMB.toFixed(
      2
    )}MB (${heapUsedPercent}) + External ${externalMB.toFixed(
      2
    )}MB + Buffers ${arrayBuffersMB.toFixed(2)}MB].`;

    return {
      rssUsedMB: rssUsedMB.toFixed(2),
      rssUsedPercent,
      heapUsedPercent,
      externalMB: externalMB.toFixed(2),
      arrayBuffersMB: arrayBuffersMB.toFixed(2),
      formattedMessage,
    };
  } catch (err) {
    console.warn('Error retrieving memory usage', err);
    throw err;
  }
}
