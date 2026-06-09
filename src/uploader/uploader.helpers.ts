import fs, { promises as fsPromises } from 'fs';
import { jsonl } from 'js-jsonl';
import zlib from 'zlib';

import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from '../common/constants';
import { UploaderResult } from './uploader.interfaces';

/**
 * Compresses a JSONL string using gzip.
 *
 * Used to shrink a serialized JSONL batch before uploading it as an artifact.
 *
 * @param jsonlObject - The JSONL string to compress.
 * @returns An UploaderResult wrapping the gzipped Buffer, or an error on failure.
 */
export function compressGzip(jsonlObject: string): UploaderResult<Buffer> {
  try {
    return { response: zlib.gzipSync(jsonlObject) };
  } catch (error) {
    return { error };
  }
}

/**
 * Decompresses a gzipped buffer back into a JSONL string.
 *
 * Used to restore a downloaded gzipped artifact before parsing it.
 *
 * @param gzippedJsonlObject - The gzipped Buffer to decompress.
 * @returns An UploaderResult wrapping the decompressed JSONL string, or an error on failure.
 */
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

/**
 * Parses a JSONL string into an array of objects.
 *
 * Used to turn a decompressed artifact into usable records.
 *
 * @param jsonlObject - The JSONL string to parse.
 * @returns An UploaderResult wrapping the parsed object array, or an error on failure.
 */
export function parseJsonl(jsonlObject: string): UploaderResult<object[]> {
  try {
    return { response: jsonl.parse(jsonlObject) };
  } catch (error) {
    return { error };
  }
}

/**
 * Writes fetched objects to the local file system for local development.
 *
 * Used to inspect extracted data on disk instead of uploading it when running locally; writes a
 * timestamped JSON/JSONL file under the `extracted_files` directory.
 *
 * @param itemType - The string item type, used to name the output file and pick its extension.
 * @param fetchedObjects - The object or array of objects to write, one JSON record per line.
 * @returns Promise that resolves once the file is written, or rejects on a write error.
 */
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

/**
 * Truncates a filename that exceeds the platform's maximum length.
 *
 * Used before requesting an upload URL so the registered file name stays within DevRev limits,
 * preserving the extension and inserting an ellipsis in the middle.
 *
 * @param filename - The string filename to truncate.
 * @returns The original filename if within the limit, otherwise a truncated `name...ext` string.
 */
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
