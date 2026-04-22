import { UNBOUNDED_DATE_TIME_VALUE } from '../../common/constants';
import { State } from '../../state/state';
import { mockServer } from '../../tests/jest.setup';
import { createMockEvent } from '../../common/test-utils';
import {
  AdapterState,
  AirdropEvent,
  Artifact,
  EventType,
  ExtractorEventType,
  LoaderEventType,
} from '../../types';
import { ActionType, LoaderReport } from '../../types/loading';
import { WorkerAdapter } from './worker-adapter';

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('../../common/control-protocol', () => ({
  emit: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../mappers/mappers');
jest.mock('../../uploader/uploader');
jest.mock('../../repo/repo');
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

function makeAdapter(eventType: EventType = EventType.StartExtractingData): {
  adapter: WorkerAdapter<TestState>;
  event: AirdropEvent;
  adapterState: State<TestState>;
} {
  const event = createMockEvent(mockServer.baseUrl, {
    payload: { event_type: eventType },
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
  return { adapter, event, adapterState };
}

describe(`${WorkerAdapter.name}.emit`, () => {
  let adapter: WorkerAdapter<TestState>;
  let counter: { counter: number };
  let mockPostMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter());

    counter = { counter: 0 };
    const workerThreads = require('node:worker_threads');
    mockPostMessage = jest.fn().mockImplementation(() => {
      counter.counter += 1;
    });
    if (workerThreads.parentPort) {
      jest
        .spyOn(workerThreads.parentPort, 'postMessage')
        .mockImplementation(mockPostMessage);
    } else {
      workerThreads.parentPort = { postMessage: mockPostMessage };
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should emit only one event when multiple events of same type are sent', async () => {
    // Arrange
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

    // Act
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      reports: [],
      processed_files: [],
    });
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      reports: [],
      processed_files: [],
    });

    // Assert
    expect(counter.counter).toBe(1);
  });

  it('should emit only once even when a different event type follows', async () => {
    // Arrange
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

    // Act
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      reports: [],
      processed_files: [],
    });
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      reports: [],
      processed_files: [],
    });
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      reports: [],
      processed_files: [],
    });

    // Assert
    expect(counter.counter).toBe(1);
  });

  it('should correctly emit one event even if postState errors', async () => {
    // Arrange
    adapter['adapterState'].postState = jest
      .fn()
      .mockRejectedValue(new Error('postState error'));
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

    // Act
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      reports: [],
      processed_files: [],
    });

    // Assert
    expect(counter.counter).toBe(1);
  });

  it('should correctly emit one event even if uploadAllRepos errors', async () => {
    // Arrange
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest
      .fn()
      .mockRejectedValue(new Error('uploadAllRepos error'));

    // Act
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      reports: [],
      processed_files: [],
    });

    // Assert
    expect(counter.counter).toBe(1);
  });

  it('should include artifacts in data for extraction events', async () => {
    // Arrange
    const { emit: mockEmit } = require('../../common/control-protocol');
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);
    adapter['_artifacts'] = [
      { id: 'art-1', item_count: 10, item_type: 'issues' },
    ] as Artifact[];

    // Act
    await adapter.emit(ExtractorEventType.DataExtractionDone);

    // Assert
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifacts: expect.arrayContaining([
            expect.objectContaining({ id: 'art-1' }),
          ]),
        }),
      })
    );
    const callData = mockEmit.mock.calls[0][0].data;
    expect(callData).not.toHaveProperty('reports');
    expect(callData).not.toHaveProperty('processed_files');
  });

  it('should include reports and processed_files in data for loader events', async () => {
    // Arrange
    const { emit: mockEmit } = require('../../common/control-protocol');
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);
    adapter['loaderReports'] = [
      { item_type: 'tasks', [ActionType.CREATED]: 5 },
    ] as LoaderReport[];
    adapter['_processedFiles'] = ['file-1', 'file-2'];

    // Act
    await adapter.emit(LoaderEventType.DataLoadingDone);

    // Assert
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reports: expect.arrayContaining([
            expect.objectContaining({ item_type: 'tasks' }),
          ]),
          processed_files: ['file-1', 'file-2'],
        }),
      })
    );
    const callData = mockEmit.mock.calls[0][0].data;
    expect(callData).not.toHaveProperty('artifacts');
  });

  it('should not include artifacts, reports, or processed_files for unknown event types', async () => {
    // Arrange
    const { emit: mockEmit } = require('../../common/control-protocol');
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);
    adapter['_artifacts'] = [
      { id: 'art-1', item_count: 10, item_type: 'issues' },
    ] as Artifact[];
    adapter['loaderReports'] = [
      { item_type: 'tasks', [ActionType.CREATED]: 5 },
    ] as LoaderReport[];
    adapter['_processedFiles'] = ['file-1'];

    // Act
    await adapter.emit('SOME_UNKNOWN_EVENT' as ExtractorEventType);

    // Assert
    const callData = mockEmit.mock.calls[0][0].data;
    expect(callData).not.toHaveProperty('artifacts');
    expect(callData).not.toHaveProperty('reports');
    expect(callData).not.toHaveProperty('processed_files');
  });

  it('should include artifacts for all ExtractorEventType values', async () => {
    // Arrange
    const { emit: mockEmit } = require('../../common/control-protocol');
    const extractorEvents = [
      ExtractorEventType.DataExtractionDone,
      ExtractorEventType.DataExtractionProgress,
      ExtractorEventType.DataExtractionError,
      ExtractorEventType.AttachmentExtractionDone,
      ExtractorEventType.AttachmentExtractionProgress,
    ];

    for (const eventType of extractorEvents) {
      jest.clearAllMocks();
      adapter.hasWorkerEmitted = false;
      adapter['adapterState'].postState = jest
        .fn()
        .mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

      // Act
      await adapter.emit(eventType);

      // Assert
      const callData = mockEmit.mock.calls[0]?.[0]?.data;
      expect(callData).toHaveProperty('artifacts');
      expect(callData).not.toHaveProperty('reports');
    }
  });

  it('should include reports and processed_files for all LoaderEventType values', async () => {
    // Arrange
    const { emit: mockEmit } = require('../../common/control-protocol');
    const loaderEvents = [
      LoaderEventType.DataLoadingDone,
      LoaderEventType.DataLoadingProgress,
      LoaderEventType.DataLoadingError,
      LoaderEventType.AttachmentLoadingDone,
      LoaderEventType.AttachmentLoadingProgress,
    ];

    for (const eventType of loaderEvents) {
      jest.clearAllMocks();
      adapter.hasWorkerEmitted = false;
      adapter['adapterState'].postState = jest
        .fn()
        .mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

      // Act
      await adapter.emit(eventType);

      // Assert
      const callData = mockEmit.mock.calls[0]?.[0]?.data;
      expect(callData).toHaveProperty('reports');
      expect(callData).toHaveProperty('processed_files');
      expect(callData).not.toHaveProperty('artifacts');
    }
  });

  it('should truncate a long error message, preserving the original prefix', async () => {
    // Arrange
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);
    const longMessage = 'E'.repeat(20_000);

    // Act
    await adapter.emit(ExtractorEventType.DataExtractionError, {
      error: { message: longMessage },
    });

    // Assert
    const { emit: mockEmit } = require('../../common/control-protocol');
    const emittedMessage = mockEmit.mock.calls[0][0].data?.error
      ?.message as string;
    expect(emittedMessage.length).toBeLessThan(longMessage.length);
    expect(emittedMessage.startsWith('E'.repeat(100))).toBe(true);
  });
});

describe(`${WorkerAdapter.name}.emit — ExternalSyncUnitExtractionDone legacy path`, () => {
  it('should upload ESUs via a repo and strip external_sync_units from the emitted payload', async () => {
    // Arrange
    const { adapter } = makeAdapter(EventType.StartExtractingExternalSyncUnits);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);
    const pushMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(adapter, 'initializeRepos');
    jest.spyOn(adapter, 'getRepo').mockReturnValue({ push: pushMock } as never);
    const esus = [{ id: 'esu-1' }, { id: 'esu-2' }] as never;

    // Act
    await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone, {
      external_sync_units: esus,
    });

    // Assert
    expect(pushMock).toHaveBeenCalledWith(esus);
    // external_sync_units must NOT appear in the payload sent to the platform
    // (it would be too large for SQS — that is the entire reason this path exists).
    const { emit: mockEmit } = require('../../common/control-protocol');
    const emittedData = mockEmit.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(emittedData).not.toHaveProperty('external_sync_units');
  });
});

describe('WorkerAdapter — workersOldest / workersNewest boundary updates', () => {
  let adapter: WorkerAdapter<TestState>;
  let mockPostMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter());

    const workerThreads = require('node:worker_threads');
    mockPostMessage = jest.fn();
    if (workerThreads.parentPort) {
      jest
        .spyOn(workerThreads.parentPort, 'postMessage')
        .mockImplementation(mockPostMessage);
    } else {
      workerThreads.parentPort = { postMessage: mockPostMessage };
    }

    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function emitDone(
    adapterInstance: WorkerAdapter<TestState>,
    extractionStart: string | undefined,
    extractionEnd: string | undefined
  ) {
    adapterInstance.event.payload.event_context.extract_from = extractionStart;
    adapterInstance.event.payload.event_context.extract_to = extractionEnd;
    // Reset the emit guard so we can emit multiple times within one test.
    adapterInstance['hasWorkerEmitted'] = false;

    await adapterInstance.emit(ExtractorEventType.AttachmentExtractionDone, {
      reports: [],
      processed_files: [],
    });
  }

  describe('initial import with UNBOUNDED start', () => {
    it('should set workersOldest to UNBOUNDED_DATE_TIME_VALUE and workersNewest to extraction end', async () => {
      await emitDone(
        adapter,
        UNBOUNDED_DATE_TIME_VALUE,
        '2025-06-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
      expect(adapter.state.workersNewest).toBe('2025-06-01T00:00:00.000Z');
    });
  });

  describe('reconciliation after UNBOUNDED initial import', () => {
    it('should NOT overwrite workersOldest when reconciliation start is later than sentinel', async () => {
      await emitDone(
        adapter,
        UNBOUNDED_DATE_TIME_VALUE,
        '2025-06-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '2025-01-01T00:00:00.000Z',
        '2025-03-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
      expect(adapter.state.workersNewest).toBe('2025-06-01T00:00:00.000Z');
    });

    it('should NOT overwrite workersOldest even when reconciliation start is very early', async () => {
      await emitDone(
        adapter,
        UNBOUNDED_DATE_TIME_VALUE,
        '2025-06-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '1980-01-01T00:00:00.000Z',
        '1990-01-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
      expect(adapter.state.workersNewest).toBe('2025-06-01T00:00:00.000Z');
    });
  });

  describe('forward sync after UNBOUNDED initial import', () => {
    it('should expand workersNewest forward while preserving workersOldest', async () => {
      await emitDone(
        adapter,
        UNBOUNDED_DATE_TIME_VALUE,
        '2025-06-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '2025-06-01T00:00:00.000Z',
        '2025-07-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
      expect(adapter.state.workersNewest).toBe('2025-07-01T00:00:00.000Z');
    });
  });

  describe('reconciliation with end beyond current newest', () => {
    it('should expand workersNewest when reconciliation end is later', async () => {
      await emitDone(
        adapter,
        UNBOUNDED_DATE_TIME_VALUE,
        '2025-06-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '2024-01-01T00:00:00.000Z',
        '2025-08-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
      expect(adapter.state.workersNewest).toBe('2025-08-01T00:00:00.000Z');
    });
  });

  describe('first sync with absolute dates (no UNBOUNDED)', () => {
    it('should set both boundaries from the extraction range', async () => {
      await emitDone(
        adapter,
        '2025-01-01T00:00:00.000Z',
        '2025-03-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe('2025-01-01T00:00:00.000Z');
      expect(adapter.state.workersNewest).toBe('2025-03-01T00:00:00.000Z');
    });
  });

  describe('reconciliation after absolute initial sync', () => {
    it('should expand workersOldest backward when reconciliation start is earlier', async () => {
      await emitDone(
        adapter,
        '2025-01-01T00:00:00.000Z',
        '2025-03-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '2024-06-01T00:00:00.000Z',
        '2025-02-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe('2024-06-01T00:00:00.000Z');
      expect(adapter.state.workersNewest).toBe('2025-03-01T00:00:00.000Z');
    });

    it('should NOT change boundaries when reconciliation is within existing range', async () => {
      await emitDone(
        adapter,
        '2025-01-01T00:00:00.000Z',
        '2025-03-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '2025-01-15T00:00:00.000Z',
        '2025-02-15T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe('2025-01-01T00:00:00.000Z');
      expect(adapter.state.workersNewest).toBe('2025-03-01T00:00:00.000Z');
    });

    it('should expand both boundaries when reconciliation exceeds both', async () => {
      await emitDone(
        adapter,
        '2025-01-01T00:00:00.000Z',
        '2025-03-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '2024-06-01T00:00:00.000Z',
        '2025-09-01T00:00:00.000Z'
      );

      expect(adapter.state.workersOldest).toBe('2024-06-01T00:00:00.000Z');
      expect(adapter.state.workersNewest).toBe('2025-09-01T00:00:00.000Z');
    });
  });

  describe('multiple forward syncs', () => {
    it('should progressively expand workersNewest while preserving workersOldest', async () => {
      await emitDone(
        adapter,
        UNBOUNDED_DATE_TIME_VALUE,
        '2025-06-01T00:00:00.000Z'
      );

      await emitDone(
        adapter,
        '2025-06-01T00:00:00.000Z',
        '2025-07-01T00:00:00.000Z'
      );
      expect(adapter.state.workersNewest).toBe('2025-07-01T00:00:00.000Z');

      await emitDone(
        adapter,
        '2025-07-01T00:00:00.000Z',
        '2025-08-01T00:00:00.000Z'
      );
      expect(adapter.state.workersNewest).toBe('2025-08-01T00:00:00.000Z');

      expect(adapter.state.workersOldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
    });
  });

  describe('non-AttachmentExtractionDone events should NOT update boundaries', () => {
    it.each([
      ['DataExtractionDone', ExtractorEventType.DataExtractionDone],
      ['DataExtractionProgress', ExtractorEventType.DataExtractionProgress],
      ['MetadataExtractionError', ExtractorEventType.MetadataExtractionError],
      [
        'AttachmentExtractionError',
        ExtractorEventType.AttachmentExtractionError,
      ],
    ])('should not update boundaries on %s', async (_label, eventType) => {
      adapter.state.workersOldest = '2025-01-01T00:00:00.000Z';
      adapter.state.workersNewest = '2025-03-01T00:00:00.000Z';
      adapter.event.payload.event_context.extract_from =
        '2024-01-01T00:00:00.000Z';
      adapter.event.payload.event_context.extract_to =
        '2025-12-01T00:00:00.000Z';

      await adapter.emit(eventType, {
        reports: [],
        processed_files: [],
      });

      expect(adapter.state.workersOldest).toBe('2025-01-01T00:00:00.000Z');
      expect(adapter.state.workersNewest).toBe('2025-03-01T00:00:00.000Z');
    });
  });
});
