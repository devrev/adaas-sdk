import fs, { promises as fsPromises } from 'fs';
import { jsonl } from 'js-jsonl';
import zlib from 'zlib';

import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from '../common/constants';
import { UploaderResult } from './uploader.interfaces';

/**
 * Compresses a JSONL string using gzip compression.
 * @param {string} jsonlObject - The JSONL string to compress
 * @returns {Buffer | void} The compressed buffer or undefined on error
 */
export function compressGzip(jsonlObject: string): UploaderResult<Buffer> {
  try {
    return { response: zlib.gzipSync(jsonlObject) };
  } catch (error) {
    return { error };
  }
}

/**
 * Decompresses a gzipped buffer to a JSONL string.
 * @param {Buffer} gzippedJsonlObject - The gzipped buffer to decompress
 * @returns {string | void} The decompressed JSONL string or undefined on error
 */
export function decompressGzip(gzippedJsonlObject: Buffer): UploaderResult<string> {
  try {
    const jsonlObject = zlib.gunzipSync(gzippedJsonlObject);
    return { response: jsonlObject.toString() };
  } catch (error) {
    return { error };
  }
}

/**
 * Parses a JSONL string into an array of objects.
 * @param {string} jsonlObject - The JSONL string to parse
 * @returns {object[] | null} The parsed array of objects or null on error
 */
export function parseJsonl(jsonlObject: string): UploaderResult<object[]> {
  try {
    return {response: jsonl.parse(jsonlObject)};
  } catch (error) {
    return { error };
  }
}

/**
 * Downloads fetched objects to the local file system (for local development).
 * @param {string} itemType - The type of items being downloaded
 * @param {object | object[]} fetchedObjects - The objects to write to file
 * @returns {Promise<void>} Resolves when the file is written or rejects on error
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
    const filePath = `extracted_files/extractor_${itemType}_${timestamp}.${itemType === 'external_domain_metadata' ? 'json' : 'jsonl'
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
 * Truncates a filename if it exceeds the maximum allowed length.
 * @param {string} filename - The filename to truncate
 * @returns {string} The truncated filename
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
