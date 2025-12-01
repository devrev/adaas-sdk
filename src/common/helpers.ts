import { readFileSync } from 'fs';
import * as path from 'path';
import * as v8 from 'v8';

import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
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

export function getTimeoutErrorEventType(eventType: EventType): {
  eventType: ExtractorEventType | LoaderEventType;
} {
  switch (eventType) {
    // Metadata extraction (handles both old and new enum members)
    case EventType.StartExtractingMetadata:
    case EventType.ExtractionMetadataStart:
      return {
        eventType: ExtractorEventType.MetadataExtractionError,
      };

    // Data extraction (handles both old and new enum members)
    case EventType.StartExtractingData:
    case EventType.ContinueExtractingData:
    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
      return {
        eventType: ExtractorEventType.DataExtractionError,
      };

    // Data deletion (handles both old and new enum members)
    case EventType.StartDeletingExtractorState:
    case EventType.ExtractionDataDelete:
      return {
        eventType: ExtractorEventType.ExtractorStateDeletionError,
      };

    // Attachments extraction (handles both old and new enum members)
    case EventType.StartExtractingAttachments:
    case EventType.ContinueExtractingAttachments:
    case EventType.ExtractionAttachmentsStart:
    case EventType.ExtractionAttachmentsContinue:
      return {
        eventType: ExtractorEventType.AttachmentExtractionError,
      };

    // Attachments deletion (handles both old and new enum members)
    case EventType.StartDeletingExtractorAttachmentsState:
    case EventType.ExtractionAttachmentsDelete:
      return {
        eventType: ExtractorEventType.ExtractorAttachmentsStateDeletionError,
      };

    // External sync units (handles both old and new enum members)
    case EventType.StartExtractingExternalSyncUnits:
    case EventType.ExtractionExternalSyncUnitsStart:
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
        eventType: LoaderEventType.AttachmentsLoadingError,
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
  rssUsedPercent: string;
  heapUsedPercent: string;
  externalMB: string;
  arrayBuffersMB: string;
  formattedMessage: string;
}

export function getMemoryUsage(
  heapStats: v8.HeapInfo = v8.getHeapStatistics()
): MemoryInfo {
  try {
    const memUsage: NodeJS.MemoryUsage = {
      rss: heapStats.total_heap_size,
      heapTotal: heapStats.total_heap_size,
      heapUsed: heapStats.used_heap_size,
      external: heapStats.external_memory,
      arrayBuffers: 0,
    };

    const rssUsedMB = memUsage.rss / 1024 / 1024;
    const heapLimitMB = heapStats.heap_size_limit / 1024 / 1024;
    const heapUsedMB = heapStats.used_heap_size / 1024 / 1024;
    const heapTotalMB = heapStats.heap_size_limit / 1024 / 1024;
    const externalMB = memUsage.external / 1024 / 1024;
    const arrayBuffersMB = memUsage.arrayBuffers / 1024 / 1024;

    const rssUsedPercent = ((rssUsedMB / heapLimitMB) * 100).toFixed(2) + '%';
    const heapUsedPercent =
      ((heapStats.used_heap_size / heapStats.heap_size_limit) * 100).toFixed(
        2
      ) + '%';

    const formattedMessage = `Worker memory: RSS ${rssUsedMB.toFixed(
      2
    )}/${heapLimitMB.toFixed(
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

/*
 * This function is used to escape special characters in a string to be used in a regex.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
