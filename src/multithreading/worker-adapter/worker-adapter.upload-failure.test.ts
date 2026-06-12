import { State } from '../../state/state';
import { mockServer } from '../../tests/jest.setup';
import { createItems } from '../../tests/test-helpers';
import { createMockEvent } from '../../common/test-utils';
import {
  AdapterState,
  EventType,
  ExtractorEventType,
} from '../../types';
import { WorkerAdapter } from './worker-adapter';

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('../../common/control-protocol', () => ({
  emit: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../mappers/mappers');
jest.mock('node:worker_threads', () => ({
  parentPort: { postMessage: jest.fn() },
}));
jest.mock('../../attachments-streaming/attachments-streaming-pool', () => ({
  AttachmentsStreamingPool: jest.fn().mockImplementation(() => ({
    streamAll: jest.fn().mockResolvedValue(undefined),
  })),
}));

interface TestState {
  attachments: { completed: boolean };
}

const UPLOAD_URL_PATH = '/internal/airdrop.artifacts.upload-url';

function makeAdapter(): {
  adapter: WorkerAdapter<TestState>;
  mockPostMessage: jest.Mock;
} {
  const event = createMockEvent(mockServer.baseUrl, {
    payload: { event_type: EventType.StartExtractingData },
  });
  const initialState: AdapterState<TestState> = {
    attachments: { completed: false },
    lastSyncStarted: '',
    lastSuccessfulSyncStarted: '',
    snapInVersionId: '',
    toDevRev: {
      attachmentsMetadata: {
        artifactIds: [],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    },
  };
  const adapterState = new State<TestState>({ event, initialState });
  const adapter = new WorkerAdapter<TestState>({ event, adapterState });

  const workerThreads = require('node:worker_threads');
  const mockPostMessage = jest.fn();
  if (workerThreads.parentPort) {
    jest
      .spyOn(workerThreads.parentPort, 'postMessage')
      .mockImplementation(mockPostMessage);
  } else {
    workerThreads.parentPort = { postMessage: mockPostMessage };
  }

  return { adapter, mockPostMessage };
}

describe(`${WorkerAdapter.name} upload failure (near-integration)`, () => {
  let adapter: WorkerAdapter<TestState>;
  let mockPostMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer.resetRoutes();
    ({ adapter, mockPostMessage } = makeAdapter());
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw from repo.push when upload-url returns 400 during batch upload', async () => {
    mockServer.setRoute({
      path: UPLOAD_URL_PATH,
      method: 'GET',
      status: 400,
    });

    adapter.initializeRepos([
      {
        itemType: 'tasks',
        overridenOptions: { batchSize: 10 },
      },
    ]);

    await expect(
      adapter.getRepo('tasks')?.push(createItems(20))
    ).rejects.toThrow('artifact upload URL');

    expect(adapter.getRepo('tasks')?.getItems().length).toBe(20);
  });

  it('should emit DataExtractionError when uploadAllRepos fails', async () => {
    const { emit: mockEmit } = require('../../common/control-protocol');

    mockServer.setRoute({
      path: UPLOAD_URL_PATH,
      method: 'GET',
      status: 400,
    });

    adapter.initializeRepos([{ itemType: 'tasks' }]);
    await adapter.getRepo('tasks')?.push(createItems(5));

    await adapter.emit(ExtractorEventType.DataExtractionDone);

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ExtractorEventType.DataExtractionError,
        data: expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('artifact upload URL'),
          }),
        }),
      })
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'emit',
        payload: { eventType: ExtractorEventType.DataExtractionError },
      })
    );
  });

  it('should include partial artifacts when push batch succeeded before uploadAllRepos fails', async () => {
    const { emit: mockEmit } = require('../../common/control-protocol');

    mockServer.setRoute({
      path: UPLOAD_URL_PATH,
      method: 'GET',
      status: 200,
      succeedThenFail: {
        successCount: 1,
        errorStatus: 400,
      },
    });

    adapter.initializeRepos([
      {
        itemType: 'tasks',
        overridenOptions: { batchSize: 10 },
      },
    ]);
    await adapter.getRepo('tasks')?.push(createItems(15));

    await adapter.emit(ExtractorEventType.DataExtractionDone);

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ExtractorEventType.DataExtractionError,
        data: expect.objectContaining({
          artifacts: expect.arrayContaining([
            expect.objectContaining({ item_count: 10, item_type: 'tasks' }),
          ]),
        }),
      })
    );
  });
});
