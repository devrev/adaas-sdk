import {
  ActionType,
  FileToLoad,
  LoaderReport,
  StatsFileObject,
} from '../../types/loading';

/**
 * Builds the ordered list of files to load from a stats file.
 *
 * Used by the loading adapter to filter the stats file down to the supported
 * item types, order the entries to match that item-type order, and shape each
 * into a FileToLoad with progress fields reset.
 *
 * @param supportedItemTypes - The supported item type names, in desired load order.
 * @param statsFile - The StatsFileObject entries describing available files.
 * @returns The FileToLoad entries to process, ordered by supported item type.
 */
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

/**
 * Merges a report into the accumulated loader reports.
 *
 * Used to keep one running report per item type: when a report for the same
 * item type already exists its created/updated/failed counts are summed,
 * otherwise the report is appended.
 *
 * @param loaderReports - The existing LoaderReport accumulator (mutated in place).
 * @param report - The LoaderReport to merge in.
 * @returns The updated LoaderReport accumulator.
 */
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
