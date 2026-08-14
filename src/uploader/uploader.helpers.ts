import fs, { promises as fsPromises } from 'fs';
import zlib from 'zlib';

import { jsonl } from 'js-jsonl';

import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from '../common/constants';
import { NormalizedItem } from '../repo/repo.interfaces';

import {
  ArtifactDateField,
  ArtifactDateRanges,
  UploaderResult,
} from './uploader.interfaces';

/** Computes oldest/newest created and modified timestamps (RFC3339) across uploaded items. */
export function computeArtifactDateRanges(
  fetchedObjects: object[] | object
): ArtifactDateRanges {
  const items = Array.isArray(fetchedObjects)
    ? fetchedObjects
    : [fetchedObjects];

  const created = {
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  };
  const modified = {
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  };
  let hasCreated = false;
  let hasModified = false;

  const parseTimestamp = (value: string): number | undefined => {
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? undefined : ts;
  };

  for (const obj of items) {
    if (!obj || typeof obj !== 'object') {
      continue;
    }
    const item = obj as NormalizedItem;
    if (item.created_date != undefined) {
      const ts = parseTimestamp(item.created_date);
      if (ts != undefined) {
        if (ts < created.min) {
          created.min = ts;
        }
        if (ts > created.max) {
          created.max = ts;
        }
        hasCreated = true;
      }
    }
    if (item.modified_date != undefined) {
      const ts = parseTimestamp(item.modified_date);
      if (ts != undefined) {
        if (ts < modified.min) {
          modified.min = ts;
        }
        if (ts > modified.max) {
          modified.max = ts;
        }
        hasModified = true;
      }
    }
  }

  const result: ArtifactDateRanges = {};

  if (hasCreated) {
    result[ArtifactDateField.OldestCreatedDate] = new Date(
      created.min
    ).toISOString();
    result[ArtifactDateField.NewestCreatedDate] = new Date(
      created.max
    ).toISOString();
  }
  if (hasModified) {
    result[ArtifactDateField.OldestModifiedDate] = new Date(
      modified.min
    ).toISOString();
    result[ArtifactDateField.NewestModifiedDate] = new Date(
      modified.max
    ).toISOString();
  }

  return result;
}

export function compressGzip(jsonlObject: string): UploaderResult<Buffer> {
  try {
    return { response: zlib.gzipSync(jsonlObject) };
  } catch (error) {
    return { error };
  }
}

export function decompressGzip(
  gzippedJsonlObject: Buffer
): UploaderResult<string> {
  try {
    const jsonlObject = zlib.gunzipSync(gzippedJsonlObject);
    return { response: jsonlObject.toString() };
  } catch (error) {
    return { error };
  }
}

export function parseJsonl(jsonlObject: string): UploaderResult<object[]> {
  try {
    return { response: jsonl.parse(jsonlObject) };
  } catch (error) {
    return { error };
  }
}

/** Writes fetched objects to the local file system (local development only). */
export async function downloadToLocal(
  itemType: string,
  fetchedObjects: object | object[]
): Promise<void> {
  console.log(`Downloading ${itemType} to local file system.`);
  try {
    if (!fs.existsSync('extracted_files')) {
      fs.mkdirSync('extracted_files');
    }

    const timestamp = new Date().getTime();
    const filePath = `extracted_files/extractor_${itemType}_${timestamp}.${
      itemType === 'external_domain_metadata' ? 'json' : 'jsonl'
    }`;
    const fileHandle = await fsPromises.open(filePath, 'w');
    let objArray = [];
    if (!Array.isArray(fetchedObjects)) {
      objArray.push(fetchedObjects);
    } else {
      objArray = fetchedObjects;
    }
    for (const jsonObject of objArray) {
      const jsonLine = JSON.stringify(jsonObject) + '\n';
      await fileHandle.write(jsonLine);
    }
    await fileHandle.close();
    console.log('Data successfully written to', filePath);
  } catch (error) {
    console.error('Error writing data to file.', error);
    return Promise.reject(error);
  }
}

export function truncateFilename(filename: string): string {
  if (filename.length <= MAX_DEVREV_FILENAME_LENGTH) {
    return filename;
  }

  console.warn(
    `Filename length exceeds the maximum limit of ${MAX_DEVREV_FILENAME_LENGTH} characters. Truncating filename.`
  );

  const extension = filename.slice(-MAX_DEVREV_FILENAME_EXTENSION_LENGTH);
  const availableNameLength =
    MAX_DEVREV_FILENAME_LENGTH - MAX_DEVREV_FILENAME_EXTENSION_LENGTH - 3; // -3 for "..."

  const truncatedFilename = filename.slice(0, availableNameLength);

  return `${truncatedFilename}...${extension}`;
}
