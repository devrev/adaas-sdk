import { readFileSync } from 'fs';
import * as path from 'path';
import * as v8 from 'v8';

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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Yields once to the event loop so pending events (e.g. worker messages) can
 * be delivered before continuing.
 */
export async function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
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

    const heapUsedMB = heapStats.used_heap_size / 1024 / 1024;
    const heapTotalMB = heapStats.heap_size_limit / 1024 / 1024;

    const externalMB = memUsage.external / 1024 / 1024;
    const arrayBuffersMB = memUsage.arrayBuffers / 1024 / 1024;

    const rssUsedPercent =
      ((rssUsedMB / effectiveMemoryLimitMB) * 100).toFixed(2) + '%';
    const heapUsedPercent =
      ((heapStats.used_heap_size / heapStats.heap_size_limit) * 100).toFixed(
        2
      ) + '%';

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
