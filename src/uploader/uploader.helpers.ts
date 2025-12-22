import fs, { promises as fsPromises } from 'fs';
import { jsonl } from 'js-jsonl';
import zlib from 'zlib';

/**
 * Compresses a JSONL string using gzip compression.
 * @param {string} jsonlObject - The JSONL string to compress
 * @returns {Buffer | void} The compressed buffer or undefined on error
 */
export function compressGzip(jsonlObject: string): Buffer | void {
  try {
    return zlib.gzipSync(jsonlObject);
  } catch (error) {
    console.error('Error while compressing jsonl object.', error);
  }
}

/**
 * Decompresses a gzipped buffer to a JSONL string.
 * @param {Buffer} gzippedJsonlObject - The gzipped buffer to decompress
 * @returns {string | void} The decompressed JSONL string or undefined on error
 */
export function decompressGzip(gzippedJsonlObject: Buffer): string | void {
  try {
    const jsonlObject = zlib.gunzipSync(gzippedJsonlObject);
    return jsonlObject.toString();
  } catch (error) {
    console.error('Error while decompressing gzipped jsonl object.', error);
  }
}

/**
 * Parses a JSONL string into an array of objects.
 * @param {string} jsonlObject - The JSONL string to parse
 * @returns {object[] | null} The parsed array of objects or null on error
 */
export function parseJsonl(jsonlObject: string): object[] | null {
  try {
    return jsonl.parse(jsonlObject);
  } catch (error) {
    console.error('Error while parsing jsonl object.', error);
  }
  return null;
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
