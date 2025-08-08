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
import { readFileSync } from 'fs';
import * as path from 'path';
import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from './constants';

export function getTimeoutErrorEventType(eventType: EventType): {
  eventType: ExtractorEventType | LoaderEventType;
} {
  switch (eventType) {
    case EventType.ExtractionMetadataStart:
      return {
        eventType: ExtractorEventType.ExtractionMetadataError,
      };

    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
      return {
        eventType: ExtractorEventType.ExtractionDataError,
      };

    case EventType.ExtractionDataDelete:
      return {
        eventType: ExtractorEventType.ExtractionDataDeleteError,
      };

    case EventType.ExtractionAttachmentsStart:
    case EventType.ExtractionAttachmentsContinue:
      return {
        eventType: ExtractorEventType.ExtractionAttachmentsError,
      };

    case EventType.ExtractionAttachmentsDelete:
      return {
        eventType: ExtractorEventType.ExtractionAttachmentsDeleteError,
      };

    case EventType.ExtractionExternalSyncUnitsStart:
      return {
        eventType: ExtractorEventType.ExtractionExternalSyncUnitsError,
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

// https://stackoverflow.com/a/53731154
export function getCircularReplacer() {
  const seen = new WeakSet();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (key: any, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
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

export function sleep(ms: number) {
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

  let extension = filename.slice(-MAX_DEVREV_FILENAME_EXTENSION_LENGTH);
  // Calculate how many characters are available for the name part after accounting for the extension and "..."
  const availableNameLength =
    MAX_DEVREV_FILENAME_LENGTH - MAX_DEVREV_FILENAME_EXTENSION_LENGTH - 3; // -3 for "..."

  // Truncate the name part and add an ellipsis
  const truncatedFilename = filename.slice(0, availableNameLength);

  return `${truncatedFilename}...${extension}`;
}

export function logMemory(step: string): void {
  const mem = process.memoryUsage();
  const v8 = require('v8');
  const heapStats = v8.getHeapStatistics();

  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const externalMB = Math.round(mem.external / 1024 / 1024);
  const heapLimitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
  const totalLimitMB = Math.round(heapStats.total_available_size / 1024 / 1024);

  const availableHeapMB = heapLimitMB - heapMB;
  const heapUsagePercent = Math.round((heapMB / heapLimitMB) * 100);
  const rssLimitMB = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
    ? parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE)
    : totalLimitMB;
  const rssUsagePercent = Math.round((rssMB / rssLimitMB) * 100);

  console.log(
    `[MEM] ${step}: RSS=${rssMB}MB/${rssLimitMB}MB(${rssUsagePercent}%) Heap=${heapMB}MB/${heapLimitMB}MB(${heapUsagePercent}%) External=${externalMB}MB Available=${availableHeapMB}MB`
  );

  if (rssUsagePercent > 90 || heapUsagePercent > 90) {
    console.error(
      `[MEM] CRITICAL: Memory usage RSS=${rssUsagePercent}% Heap=${heapUsagePercent}% - OOM imminent!`
    );
  } else if (rssUsagePercent > 80 || heapUsagePercent > 80) {
    console.warn(
      `[MEM] WARNING: High memory usage RSS=${rssUsagePercent}% Heap=${heapUsagePercent}% - OOM risk!`
    );
  }
}
