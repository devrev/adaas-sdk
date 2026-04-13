import * as fs from 'fs';
import * as path from 'path';

import {
  AirdropEvent,
  EventType,
} from '../types/extraction';
import { createMockEvent } from './test-utils';
import { MockServer } from '../mock-server/mock-server';

import type { DeepPartial } from './test-utils';

/**
 * Error thrown when a connector function invoked by the test runner fails.
 * Callers can catch this to distinguish test-runner failures from other errors
 * and decide how to handle them (e.g. set process.exitCode, log, retry).
 */
export class TestRunnerError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TestRunnerError';
    this.cause = cause;
  }
}

/**
 * A map of function names to their run handlers.
 * Each handler receives an array of AirdropEvents and returns a Promise.
 *
 * In the connector template this is typically:
 * ```ts
 * const functionFactory = { extraction: run, loading: run } as const;
 * ```
 */
export type FunctionFactory = Record<
  string,
  (events: AirdropEvent[]) => Promise<void>
>;

export interface TestRunnerProps {
  /** Relative path within fixturesBaseDir (e.g. "start_extracting_data"). */
  fixturePath: string;

  /** The connector's function factory map. */
  functionFactory: FunctionFactory;

  /**
   * Absolute path to the directory that contains fixture sub-directories.
   * Typically `path.resolve(__dirname, '../fixtures')` in the connector.
   */
  fixturesBaseDir: string;

  /**
   * Override the function name to run (e.g. "extraction" or "loading").
   * If omitted the runner infers it from the event_type in event.json.
   */
  functionName?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Replaces `${VAR_NAME}` placeholders with values from `process.env`.
 * Values are JSON-escaped so special characters don't break the JSON structure.
 */
function resolveEnvVariables(raw: string, filePath: string): string {
  return raw.replace(/\$\{(\w+)\}/g, (_match, varName: string) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new Error(
        `Environment variable "${varName}" referenced in ${filePath} is not set. ` +
          'Make sure it is defined in your .env file or exported in your shell.'
      );
    }
    return JSON.stringify(value).slice(1, -1);
  });
}

function readFixtureFile<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (raw.length === 0) {
    return undefined;
  }
  const resolved = resolveEnvVariables(raw, filePath);
  return JSON.parse(resolved) as T;
}

function resolveEventType(input: string): EventType {
  const match = Object.values(EventType).find((v) => v === input);
  if (match) return match as EventType;

  throw new Error(
    `Unknown event_type "${input}". Must be one of: ${Object.values(EventType).join(', ')}`
  );
}

function getFunctionName(eventType: string): string {
  if (eventType.indexOf('EXTRACT') !== -1) {
    return 'extraction';
  } else if (eventType.indexOf('LOAD') !== -1) {
    return 'loading';
  }

  throw new Error(
    `No functionName found for event ${eventType}. Specify functionName using the '--functionName' parameter.`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs a connector function against a fixture directory.
 *
 * The fixture directory must contain at least an `event.json` file with an
 * `event_type` field. Optional `state.json` and `extraction_scope.json` files
 * are injected into the mock server when present.
 *
 * Call `dotenv.config()` (or equivalent) **before** invoking this function so
 * that `${VAR}` placeholders in fixture files can be resolved.
 */
export const testRunner = async ({
  fixturePath,
  functionFactory,
  fixturesBaseDir,
  functionName,
}: TestRunnerProps): Promise<void> => {
  const fixturesDir = path.resolve(fixturesBaseDir, fixturePath);
  if (!fs.existsSync(fixturesDir)) {
    throw new Error(`Fixture directory not found: ${fixturesDir}`);
  }
  return runWithFixtureDir(fixturesDir, functionFactory, functionName);
};

async function runWithFixtureDir(
  fixturesDir: string,
  functionFactory: FunctionFactory,
  functionName?: string
): Promise<void> {
  const eventPath = path.join(fixturesDir, 'event.json');
  const statePath = path.join(fixturesDir, 'state.json');
  const extractionScopePath = path.join(fixturesDir, 'extraction_scope.json');

  const fixtureEvent = readFixtureFile<DeepPartial<AirdropEvent>>(eventPath);
  const fixtureState = readFixtureFile<Record<string, unknown>>(statePath);
  const fixtureExtractionScope = readFixtureFile<Record<string, unknown>>(
    extractionScopePath
  );

  if (!fixtureEvent) {
    throw new Error(
      `Missing or empty event.json in fixture directory: ${eventPath}. ` +
        'Every fixture must have an event.json with at least an "event_type" field.'
    );
  }

  if (!fixtureEvent.payload?.event_type) {
    throw new Error(
      `event.json at ${eventPath} is missing the required "event_type" field. ` +
        'Specify an event type such as "START_EXTRACTING_DATA" or "START_EXTRACTING_EXTERNAL_SYNC_UNITS".'
    );
  }

  const resolvedFunctionName =
    functionName ?? getFunctionName(fixtureEvent.payload?.event_type);

  if (!resolvedFunctionName) {
    throw new Error(
      'No function name provided. Either pass --functionName on the CLI ' +
        'or set "function_name" in event.json.'
    );
  }

  if (!(resolvedFunctionName in functionFactory)) {
    throw new Error(
      `Function "${resolvedFunctionName}" not found in functionFactory. ` +
        `Available: ${Object.keys(functionFactory).join(', ')}`
    );
  }

  const eventType = resolveEventType(fixtureEvent.payload?.event_type);

  console.log(`[test-runner] Function : ${resolvedFunctionName}`);
  console.log(`[test-runner] Event    : ${eventType}`);
  console.log(`[test-runner] Fixture  : ${fixturesDir}`);

  const mockServer = new MockServer(0);
  await mockServer.start();

  console.log(`[test-runner] MockServer started on ${mockServer.baseUrl}`);

  if (fixtureState) {
    mockServer.setRoute({
      path: '/worker_data_url.get',
      method: 'GET',
      status: 200,
      body: {
        state: JSON.stringify(fixtureState),
        objects: JSON.stringify(fixtureExtractionScope ?? {}),
      },
    });
    console.log(`[test-runner] Injected state from state.json`);
  } else {
    mockServer.setRoute({
      path: '/worker_data_url.get',
      method: 'GET',
      status: 404,
      body: {},
    });
    console.log(
      `[test-runner] No state.json found — MockServer will return 404 (connector will create initial state)`
    );
  }

  const event = createMockEvent(mockServer.baseUrl, fixtureEvent);

  // Signal to spawn() that we are running in local development mode.
  // This causes the SDK to use local-friendly logging and file downloads.
  if (!process.argv.includes('--local')) {
    process.argv.push('--local');
  }

  const run = functionFactory[resolvedFunctionName];

  try {
    await run([event]);
    console.log(`[test-runner] Function completed successfully`);
  } catch (err) {
    console.error(`[test-runner] Function threw an error:`, err);
    throw new TestRunnerError(
      `Test runner function "${resolvedFunctionName}" failed`,
      err
    );
  } finally {
    await mockServer.stop();
    console.log(`[test-runner] MockServer stopped`);
  }
}
