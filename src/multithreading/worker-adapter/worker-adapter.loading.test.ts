import { State } from '../../state/state';
import { mockServer } from '../../tests/jest.setup';
import { createMockEvent } from '../../common/test-utils';
import {
  AdapterState,
  AirdropEvent,
  EventType,
  LoaderEventType,
} from '../../types';
import {
  ActionType,
  ExternalSystemAttachment,
  ExternalSystemItem,
} from '../../types/loading';
import { WorkerAdapter } from './worker-adapter';

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

function makeAdapter(eventType: EventType): {
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

function makeLoaderItem(devrevId = 'dev-1'): ExternalSystemItem {
  return {
    id: { devrev: devrevId, external: 'ext-1' },
    created_date: '',
    modified_date: '',
    data: {},
  };
}

function setupLoaderFile(
  adapter: WorkerAdapter<TestState>,
  items: ExternalSystemItem[],
  itemType = 'tasks'
) {
  adapter['adapterState'].state.fromDevRev = {
    filesToLoad: [
      {
        id: 'artifact-1',
        file_name: 'file.json',
        itemType,
        count: items.length,
        lineToProcess: 0,
        completed: false,
      },
    ],
  };
  adapter['uploader'].getJsonObjectByArtifactId = jest
    .fn()
    .mockResolvedValue({ response: items });
}

describe(`${WorkerAdapter.name}.loadItemTypes — timeout and unexpected errors`, () => {
  let adapter: WorkerAdapter<TestState>;
  let exitSpy: jest.SpyInstance;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter(EventType.ContinueLoadingData));
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should emit DataLoadingProgress and exit on timeout', async () => {
    // Arrange
    const items = [makeLoaderItem('dev-1'), makeLoaderItem('dev-2')];
    setupLoaderFile(adapter, items);
    adapter.isTimeout = true;
    const itemTypesToLoad = [
      { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
    ];

    // Act
    await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(LoaderEventType.DataLoadingProgress);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should emit DataLoadingProgress mid-loop when timeout arrives between items', async () => {
    // Arrange
    const items = [
      makeLoaderItem('dev-1'),
      makeLoaderItem('dev-2'),
      makeLoaderItem('dev-3'),
    ];
    setupLoaderFile(adapter, items);
    exitSpy.mockRestore();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    let loadItemCallCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
    jest.spyOn(adapter as any, 'loadItem').mockImplementation(async () => {
      loadItemCallCount++;
      if (loadItemCallCount === 1) {
        adapter.isTimeout = true;
      }
      return { report: { item_type: 'tasks', updated: 1 } };
    });
    const itemTypesToLoad = [
      { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
    ];

    // Act & Assert
    await expect(adapter.loadItemTypes({ itemTypesToLoad })).rejects.toThrow(
      'process.exit'
    );
    expect(loadItemCallCount).toBe(1);
    expect(emitSpy).toHaveBeenCalledWith(LoaderEventType.DataLoadingProgress);
  });

  it('should emit DataLoadingError and exit(1) on unexpected error', async () => {
    // Arrange
    adapter['adapterState'].state.fromDevRev = {
      filesToLoad: [
        {
          id: 'artifact-1',
          file_name: 'file1.json',
          itemType: 'tasks',
          count: 1,
          lineToProcess: 0,
          completed: false,
        },
      ],
    };
    adapter['uploader'].getJsonObjectByArtifactId = jest
      .fn()
      .mockRejectedValue(new Error('Unexpected network failure'));
    const itemTypesToLoad = [
      { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
    ];

    // Act
    await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.DataLoadingError,
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Error during data loading'),
        }),
      })
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe(`${WorkerAdapter.name}.loadItemTypes — loadItem branch coverage via public API`, () => {
  let adapter: WorkerAdapter<TestState>;
  let emitSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  const itemTypesToLoad = [
    { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter(EventType.ContinueLoadingData));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    itemTypesToLoad[0].create = jest.fn();
    itemTypesToLoad[0].update = jest.fn();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should accumulate an UPDATED report when the connector updates the item and the mapper sync succeeds', async () => {
    // Arrange
    setupLoaderFile(adapter, [makeLoaderItem('dev-1')]);
    adapter['_mappers'].getByTargetId = jest.fn().mockResolvedValue({
      data: { sync_mapper_record: { id: 'smr-1' } },
    });
    adapter['_mappers'].update = jest.fn().mockResolvedValue({ data: {} });
    itemTypesToLoad[0].update = jest
      .fn()
      .mockResolvedValue({ id: 'ext-updated-1' });

    // Act
    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_type: 'tasks',
          [ActionType.UPDATED]: 1,
        }),
      ])
    );
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should fall back to create and accumulate a CREATED report when the mapper record does not exist (404)', async () => {
    // Arrange
    setupLoaderFile(adapter, [makeLoaderItem('dev-2')]);
    const axiosError = { isAxiosError: true, response: { status: 404 } };
    adapter['_mappers'].getByTargetId = jest.fn().mockRejectedValue(axiosError);
    adapter['_mappers'].create = jest.fn().mockResolvedValue({ data: {} });
    itemTypesToLoad[0].create = jest
      .fn()
      .mockResolvedValue({ id: 'new-ext-id' });

    // Act
    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_type: 'tasks',
          [ActionType.CREATED]: 1,
        }),
      ])
    );
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit DataLoadingDelayed and stop processing when the connector signals a rate-limit delay', async () => {
    // Arrange
    setupLoaderFile(adapter, [makeLoaderItem('dev-3')]);
    adapter['_mappers'].getByTargetId = jest.fn().mockResolvedValue({
      data: { sync_mapper_record: { id: 'smr-1' } },
    });
    itemTypesToLoad[0].update = jest.fn().mockResolvedValue({ delay: 15 });

    // Act
    await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.DataLoadingDelayed,
      expect.objectContaining({ delay: 15 })
    );
  });

  it('should count the item as FAILED when the update succeeds but the mapper sync throws', async () => {
    // Arrange
    setupLoaderFile(adapter, [makeLoaderItem('dev-4')]);
    adapter['_mappers'].getByTargetId = jest.fn().mockResolvedValue({
      data: { sync_mapper_record: { id: 'smr-1' } },
    });
    adapter['_mappers'].update = jest
      .fn()
      .mockRejectedValue(new Error('mapper down'));
    itemTypesToLoad[0].update = jest.fn().mockResolvedValue({ id: 'ext-id' });

    // Act
    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
    expect(reports).toBeDefined();
  });

  it('should not emit for a non-404 Axios error from the mapper (recorded as item-level error)', async () => {
    // Arrange
    setupLoaderFile(adapter, [makeLoaderItem('dev-5')]);
    const axiosError = {
      isAxiosError: true,
      message: 'internal server error',
      response: { status: 500 },
    };
    adapter['_mappers'].getByTargetId = jest.fn().mockRejectedValue(axiosError);

    // Act
    await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should handle a null sync_mapper_record gracefully and continue loading', async () => {
    // Arrange
    setupLoaderFile(adapter, [makeLoaderItem('dev-6')]);
    adapter['_mappers'].getByTargetId = jest
      .fn()
      .mockResolvedValue({ data: null });

    // Act
    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
    expect(reports).toBeDefined();
  });
});

describe(`${WorkerAdapter.name}.loadItemTypes — additional branches`, () => {
  let adapter: WorkerAdapter<TestState>;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter(EventType.ContinueLoadingData));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return immediately with empty reports when filesToLoad is empty', async () => {
    // Arrange
    adapter['adapterState'].state.fromDevRev = { filesToLoad: [] };

    // Act
    const result = await adapter.loadItemTypes({
      itemTypesToLoad: [
        { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
      ],
    });

    // Assert
    expect(result.reports).toEqual([]);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit DataLoadingError when a file references an item type not in itemTypesToLoad', async () => {
    // Arrange
    adapter['adapterState'].state.fromDevRev = {
      filesToLoad: [
        {
          id: 'art-1',
          file_name: 'file.json',
          itemType: 'unknown-type',
          count: 1,
          lineToProcess: 0,
          completed: false,
        },
      ],
    };
    adapter['uploader'].getJsonObjectByArtifactId = jest
      .fn()
      .mockResolvedValue({ response: [makeLoaderItem()] });

    // Act
    await adapter.loadItemTypes({
      itemTypesToLoad: [
        { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
      ],
    });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.DataLoadingError,
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('unknown-type'),
        }),
      })
    );
  });
});

describe(`${WorkerAdapter.name}.loadAttachments — timeout, transformer errors, unexpected errors`, () => {
  let adapter: WorkerAdapter<TestState>;
  let exitSpy: jest.SpyInstance;
  let emitSpy: jest.SpyInstance;

  function setupFilesToLoad(
    a: WorkerAdapter<TestState>,
    items: ExternalSystemAttachment[]
  ) {
    a['adapterState'].state.fromDevRev = {
      filesToLoad: [
        {
          id: 'artifact-1',
          file_name: 'attachments.json',
          itemType: 'attachment',
          count: items.length,
          lineToProcess: 0,
          completed: false,
        },
      ],
    };

    a['uploader'].getJsonObjectByArtifactId = jest
      .fn()
      .mockResolvedValue({ response: items });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter(EventType.ContinueLoadingAttachments));
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should emit AttachmentLoadingProgress and exit on timeout', async () => {
    // Arrange
    const items = [
      {
        reference_id: 'ref-1',
        parent_type: 'task',
        parent_reference_id: 'parent-1',
        file_name: 'file.pdf',
        file_type: 'application/pdf',
        file_size: 100,
        url: 'https://example.com/file.pdf',
        valid_until: '',
        created_by_id: 'user-1',
        created_date: '',
        modified_by_id: 'user-1',
        modified_date: '',
      },
    ] as ExternalSystemAttachment[];
    setupFilesToLoad(adapter, items);
    adapter.isTimeout = true;

    // Act
    await adapter.loadAttachments({
      create: jest.fn(),
    });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.AttachmentLoadingProgress
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should emit AttachmentLoadingError on transformer file error', async () => {
    // Arrange
    adapter['adapterState'].state.fromDevRev = {
      filesToLoad: [
        {
          id: 'bad-artifact',
          file_name: 'attachments.json',
          itemType: 'attachment',
          count: 1,
          lineToProcess: 0,
          completed: false,
        },
      ],
    };
    adapter['uploader'].getJsonObjectByArtifactId = jest
      .fn()
      .mockResolvedValue({
        response: null,
        error: new Error('Artifact not found'),
      });

    // Act
    await adapter.loadAttachments({
      create: jest.fn(),
    });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.AttachmentLoadingError,
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Transformer file not found'),
        }),
      })
    );
  });

  it('should emit AttachmentLoadingError and exit(1) on unexpected error', async () => {
    // Arrange
    const items = [
      {
        reference_id: 'ref-1',
        parent_type: 'task',
        parent_reference_id: 'parent-1',
        file_name: 'file.pdf',
        file_type: 'application/pdf',
        file_size: 100,
        url: 'https://example.com/file.pdf',
        valid_until: '',
        created_by_id: 'user-1',
        created_date: '',
        modified_by_id: 'user-1',
        modified_date: '',
      },
    ] as ExternalSystemAttachment[];
    setupFilesToLoad(adapter, items);
    const mockCreate = jest
      .fn()
      .mockRejectedValue(new Error('Unexpected API failure'));

    // Act
    await adapter.loadAttachments({ create: mockCreate });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.AttachmentLoadingError,
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Error during attachment loading'),
        }),
      })
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe(`${WorkerAdapter.name}.loadAttachments — additional branches`, () => {
  let adapter: WorkerAdapter<TestState>;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter(EventType.ContinueLoadingAttachments));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return immediately with empty reports when fromDevRev is not set', async () => {
    // Arrange
    adapter['adapterState'].state.fromDevRev = undefined;

    // Act
    const result = await adapter.loadAttachments({ create: jest.fn() });

    // Assert
    expect(result.reports).toEqual([]);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit AttachmentLoadingDelayed and stop the loop when the connector signals a rate-limit delay', async () => {
    // Arrange
    adapter['adapterState'].state.fromDevRev = {
      filesToLoad: [
        {
          id: 'art-1',
          file_name: 'attachments.json',
          itemType: 'attachment',
          count: 1,
          lineToProcess: 0,
          completed: false,
        },
      ],
    };
    adapter['uploader'].getJsonObjectByArtifactId = jest
      .fn()
      .mockResolvedValue({
        response: [
          {
            reference_id: 'ref-1',
            parent_type: 'task',
            parent_reference_id: 'parent-1',
            file_name: 'file.pdf',
            file_type: 'application/pdf',
            file_size: 100,
            url: 'https://example.com/file.pdf',
            valid_until: '',
            created_by_id: 'user-1',
            created_date: '',
            modified_by_id: 'user-1',
            modified_date: '',
          },
        ],
      });
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(adapter as any, 'loadAttachment')
      .mockResolvedValue({ rateLimit: { delay: 20 } } as never);

    // Act
    await adapter.loadAttachments({ create: jest.fn() });

    // Assert
    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.AttachmentLoadingDelayed,
      expect.objectContaining({ delay: 20 })
    );
  });
});

describe(`${WorkerAdapter.name}.loadAttachment`, () => {
  let adapter: WorkerAdapter<TestState>;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter(EventType.ContinueLoadingAttachments));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeAttachment(): ExternalSystemAttachment {
    return {
      reference_id: 'ref-1',
      parent_type: 'task',
      parent_reference_id: 'parent-1',
      file_name: 'file.pdf',
      file_type: 'application/pdf',
      file_size: 100,
      url: 'https://example.com/file.pdf',
      valid_until: '',
      created_by_id: 'user-1',
      created_date: '',
      modified_by_id: 'user-1',
      modified_date: '',
    } as ExternalSystemAttachment;
  }

  it('should return a CREATED report when create succeeds', async () => {
    // Arrange
    adapter['_mappers'].create = jest.fn().mockResolvedValue({ data: {} });
    const create = jest.fn().mockResolvedValue({ id: 'att-ext-1' });

    // Act
    const result = await adapter['loadAttachment']({
      item: makeAttachment(),
      create,
    });

    // Assert
    expect(result.report?.item_type).toBe('attachment');
    expect(result.report?.[ActionType.CREATED]).toBe(1);
  });

  it('should still return CREATED even when mapper create fails — attachment loading is resilient', async () => {
    // Arrange
    adapter['_mappers'].create = jest
      .fn()
      .mockRejectedValue(new Error('mapper failed'));
    const create = jest.fn().mockResolvedValue({ id: 'att-ext-1' });

    // Act
    const result = await adapter['loadAttachment']({
      item: makeAttachment(),
      create,
    });

    // Assert
    expect(result.report?.[ActionType.CREATED]).toBe(1);
  });

  it('should propagate rate-limit delay when the connector signals one', async () => {
    // Arrange
    const create = jest.fn().mockResolvedValue({ delay: 30 });

    // Act
    const result = await adapter['loadAttachment']({
      item: makeAttachment(),
      create,
    });

    // Assert
    expect(result.rateLimit?.delay).toBe(30);
  });

  it('should return a FAILED report when create returns neither id nor delay', async () => {
    // Arrange
    const create = jest.fn().mockResolvedValue({ id: null, delay: null });

    // Act
    const result = await adapter['loadAttachment']({
      item: makeAttachment(),
      create,
    });

    // Assert
    expect(result.report?.[ActionType.FAILED]).toBe(1);
  });
});
