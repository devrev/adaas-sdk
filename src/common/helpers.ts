import { readFileSync } from 'fs';
import * as path from 'path';
import * as v8 from 'v8';

import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from './constants';
import { MAX_LOG_STRING_LENGTH } from '../logger/logger.constants';

/**
 * Gets the library version from the package.json file.
 * @returns {string} The library version
 */
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

/**
 * Sleeps for a given number of milliseconds.
 * @param {number} ms - The number of milliseconds to sleep
 * @returns {Promise<void>} A promise that resolves after the given number of milliseconds
 */
export async function sleep(ms: number) {
  console.log(`Sleeping for ${ms}ms.`);
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * MemoryInfo is an interface that represents the memory usage information.
 * @interface MemoryInfo
 * @property {string} rssUsedMB - The RSS used in MB
 * @property {string} rssUsedPercent - The RSS used percentage
 * @property {string} heapUsedPercent - The heap used percentage
 * @property {string} externalMB - The external memory used in MB
 * @property {string} arrayBuffersMB - The array buffers memory used in MB
 * @property {string} formattedMessage - The formatted message
 */
export interface MemoryInfo {
  rssUsedMB: string;
  rssUsedPercent: string; // Critical for OOM detection
  heapUsedPercent: string; // GC pressure indicator
  externalMB: string; // C++ objects and buffers (HTTP streams, etc.)
  arrayBuffersMB: string; // Buffer data (unclosed streams show here)
  formattedMessage: string;
}

/**
 * Gets the memory usage information.
 * @returns {MemoryInfo} The memory usage information
 */
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

/**
 * Truncates a message if it exceeds the maximum allowed length.
 * Adds a suffix indicating how many characters were omitted.
 *
 * @param message - The message to truncate
 * @returns Truncated message or original if within limits
 */
export function truncateMessage(message: string): string {
  if (message.length > MAX_LOG_STRING_LENGTH) {
    return `${message.substring(0, MAX_LOG_STRING_LENGTH)}... ${
      message.length - MAX_LOG_STRING_LENGTH
    } more characters`;
  }
  return message;
}
