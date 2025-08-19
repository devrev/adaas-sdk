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
import { MAX_DEVREV_FILENAME_EXTENSION_LENGTH, MAX_DEVREV_FILENAME_LENGTH } from './constants';

const EVENT_TYPE_TRANSLATION_TABLE = {
  "EXTRACTION_EXTERNAL_SYNC_UNITS_START": EventType.ExtractionExternalSyncUnitsStart,
  "EXTRACTION_METADATA_START": EventType.ExtractionMetadataStart,
  "EXTRACTION_DATA_START": EventType.ExtractionDataStart,
  "EXTRACTION_DATA_CONTINUE": EventType.ExtractionDataContinue,
  "EXTRACTION_ATTACHMENTS_START": EventType.ExtractionAttachmentsStart,
  "EXTRACTION_ATTACHMENTS_CONTINUE": EventType.ExtractionAttachmentsContinue,
  "EXTRACTION_DATA_DELETE": EventType.ExtractionDataDelete,
  "EXTRACTION_ATTACHMENTS_DELETE": EventType.ExtractionAttachmentsDelete,

  "EXTRACTION_EXTERNAL_SYNC_UNITS_DONE": ExtractorEventType.ExtractionExternalSyncUnitsDone,
  "EXTRACTION_EXTERNAL_SYNC_UNITS_ERROR": ExtractorEventType.ExtractionExternalSyncUnitsError,
  "EXTRACTION_METADATA_DONE": ExtractorEventType.ExtractionMetadataDone,
  "EXTRACTION_METADATA_ERROR": ExtractorEventType.ExtractionMetadataError,
  "EXTRACTION_DATA_PROGRESS": ExtractorEventType.ExtractionDataProgress,
  "EXTRACTION_DATA_DELAY": ExtractorEventType.ExtractionDataDelay,
  "EXTRACTION_DATA_DONE": ExtractorEventType.ExtractionDataDone,
  "EXTRACTION_DATA_ERROR": ExtractorEventType.ExtractionDataError,
  "EXTRACTION_ATTACHMENTS_PROGRESS": ExtractorEventType.ExtractionAttachmentsProgress,
  "EXTRACTION_ATTACHMENTS_DELAY": ExtractorEventType.ExtractionAttachmentsDelay,
  "EXTRACTION_ATTACHMENTS_DONE": ExtractorEventType.ExtractionAttachmentsDone,
  "EXTRACTION_ATTACHMENTS_ERROR": ExtractorEventType.ExtractionAttachmentsError,
  "EXTRACTION_DATA_DELETE_DONE": ExtractorEventType.ExtractionDataDeleteDone,
  "EXTRACTION_DATA_DELETE_ERROR": ExtractorEventType.ExtractionDataDeleteError,
  "EXTRACTION_ATTACHMENTS_DELETE_DONE": ExtractorEventType.ExtractionAttachmentsDeleteDone,
  "EXTRACTION_ATTACHMENTS_DELETE_ERROR": ExtractorEventType.ExtractionAttachmentsDeleteError
};

/**
 * Translates Event type from the old naming scheme to the new one
 */
export function translateEventType(event_type: string): EventType | ExtractorEventType {
  // If we notice that the event has a newer translation, translate to that
  if(event_type in EVENT_TYPE_TRANSLATION_TABLE){
    return EVENT_TYPE_TRANSLATION_TABLE[event_type as keyof typeof EVENT_TYPE_TRANSLATION_TABLE];
  }

  // Return the correct event type
  if (event_type in ExtractorEventType) {
    return event_type as ExtractorEventType;
  }

  return event_type as EventType;
}

export function isEventType({
  event,
  eventType,
}: {
  event: AirdropEvent;
  eventType: EventType;
}): boolean {
  return translateEventType(event.payload.event_type) === translateEventType(eventType);
}

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
  const availableNameLength = MAX_DEVREV_FILENAME_LENGTH - MAX_DEVREV_FILENAME_EXTENSION_LENGTH - 3; // -3 for "..."

  // Truncate the name part and add an ellipsis
  const truncatedFilename = filename.slice(0, availableNameLength);

  return `${truncatedFilename}...${extension}`;
}
