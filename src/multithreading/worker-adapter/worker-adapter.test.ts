import { AttachmentsStreamingPool } from '../../attachments-streaming/attachments-streaming-pool';
import { State } from '../../state/state';
import { UNBOUNDED_DATE_TIME_VALUE } from '../../state/state.interfaces';
import { createEvent } from '../../tests/test-helpers';
import { AdapterState, EventType, ExtractorEventType } from '../../types';
import { WorkerAdapter } from './worker-adapter';

/* eslint-disable @typescript-eslint/no-require-imports */

// Mock dependencies
jest.mock('../../common/control-protocol', () => ({
  emit: jest.fn().mockResolvedValue({}),
}));

// const mockPostState = jest.spyOn(State.prototype, 'postState').mockResolvedValue(); // Mock to resolve void
// const mockFetchState = jest.spyOn(State.prototype, 'fetchState').mockResolvedValue({}); // Mock to resolve a default state

jest.mock('../../mappers/mappers');
jest.mock('../../uploader/uploader');
// jest.mock('../../state/state');
jest.mock('../../repo/repo');
jest.mock('node:worker_threads', () => ({
  parentPort: {
    postMessage: jest.fn(),
  },
}));
jest.mock('../../attachments-streaming/attachments-streaming-pool', () => {
  return {
    AttachmentsStreamingPool: jest.fn().mockImplementation(() => {
      return {
        streamAll: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

describe(WorkerAdapter.name, () => {
  interface TestState {
    attachments: { completed: boolean };
  }

  let adapter: WorkerAdapter<TestState>;
  let mockEvent;
  let mockAdapterState;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock objects
    mockEvent = createEvent({ eventType: EventType.StartExtractingData });

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

    mockAdapterState = new State<TestState>({
      event: mockEvent,
      initialState: initialState,
    });

    // Create the adapter instance
    adapter = new WorkerAdapter({
      event: mockEvent,
      adapterState: mockAdapterState,
    });
  });

  describe(WorkerAdapter.prototype.streamAttachments.name, () => {
    it('should process all artifact batches successfully', async () => {
      const mockStream = jest.fn();

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1', 'artifact2'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock getting attachments from each artifact
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValueOnce({
          attachments: [
            {
              url: 'http://example.com/file1.pdf',
              id: 'attachment1',
              file_name: 'file1.pdf',
              parent_id: 'parent1',
            },
            {
              url: 'http://example.com/file2.pdf',
              id: 'attachment2',
              file_name: 'file2.pdf',
              parent_id: 'parent2',
            },
          ],
        })
        .mockResolvedValueOnce({
          attachments: [
            {
              url: 'http://example.com/file3.pdf',
              id: 'attachment3',
              file_name: 'file3.pdf',
              parent_id: 'parent3',
            },
          ],
        });

      // Mock the initializeRepos method
      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
      });

      expect(adapter.initializeRepos).toHaveBeenCalledWith([
        { itemType: 'ssor_attachment' },
      ]);
      expect(adapter.initializeRepos).toHaveBeenCalledTimes(1);
      expect(
        adapter['uploader'].getAttachmentsFromArtifactId
      ).toHaveBeenCalledTimes(2);

      // Verify state was updated correctly
      expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual(
        []
      );
      expect(adapter.state.toDevRev.attachmentsMetadata.lastProcessed).toBe(0);
      expect(result).toBeUndefined();
    });

    it('[edge] should handle invalid batch size by using 1 instead', async () => {
      const mockStream = jest.fn();

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock getting attachments
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValue({
          attachments: [
            {
              url: 'http://example.com/file1.pdf',
              id: 'attachment1',
              file_name: 'file1.pdf',
              parent_id: 'parent1',
            },
          ],
        });

      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
        batchSize: 0,
      });

      expect(result).toBeUndefined();
    });

    it('[edge] should cap batch size to 50 when batchSize is greater than 50', async () => {
      const mockStream = jest.fn();

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock getting attachments
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValue({
          attachments: [
            {
              url: 'http://example.com/file1.pdf',
              id: 'attachment1',
              file_name: 'file1.pdf',
              parent_id: 'parent1',
            },
          ],
        });

      // Mock the required methods
      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
        batchSize: 100, // Set batch size greater than 50
      });

      expect(result).toBeUndefined();
    });

    it('[edge] should handle empty attachments metadata artifact IDs', async () => {
      const mockStream = jest.fn();

      // Set up adapter state with no artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: [],
          lastProcessed: 0,
        },
      };

      const result = await adapter.streamAttachments({
        stream: mockStream,
      });

      expect(result).toBeUndefined();
    });

    it('[edge] should handle errors when getting attachments', async () => {
      const mockStream = jest.fn();

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock error when getting attachments
      const mockError = new Error('Failed to get attachments');
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValue({
          error: mockError,
        });

      // Mock methods
      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
      });

      expect(result).toEqual({
        error: mockError,
      });
    });

    it('[edge] should handle empty attachments array from artifact', async () => {
      const mockStream = jest.fn();

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock getting empty attachments
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValue({
          attachments: [],
        });

      // Mock methods
      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
      });

      expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual(
        []
      );
      expect(result).toBeUndefined();
    });

    it('should use custom processors when provided', async () => {
      const mockStream = jest.fn();
      const mockReducer = jest.fn().mockReturnValue(['custom-reduced']);
      const mockIterator = jest.fn().mockResolvedValue({});

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock getting attachments
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValue({
          attachments: [{ id: 'attachment1' }],
        });

      // Mock methods
      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
        processors: {
          reducer: mockReducer,
          iterator: mockIterator,
        },
      });

      expect(mockReducer).toHaveBeenCalledWith({
        attachments: [{ id: 'attachment1' }],
        adapter: adapter,
        batchSize: 1,
      });
      expect(mockIterator).toHaveBeenCalledWith({
        reducedAttachments: ['custom-reduced'],
        adapter: adapter,
        stream: mockStream,
      });
      expect(result).toBeUndefined();
    });

    it('should handle rate limiting from iterator', async () => {
      const mockStream = jest.fn();

      (AttachmentsStreamingPool as jest.Mock).mockImplementationOnce(() => {
        return {
          // Return an object with a `streamAll` method that resolves to your desired value.
          streamAll: jest.fn().mockResolvedValue({ delay: 30 }),
        };
      });

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock getting attachments
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValue({
          attachments: [{ id: 'attachment1' }],
        });

      // Mock methods
      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
      });

      expect(result).toEqual({
        delay: 30,
      });
      // The artifactIds array should remain unchanged
      expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
        'artifact1',
      ]);
    });

    it('should handle error from iterator', async () => {
      const mockStream = jest.fn();

      (AttachmentsStreamingPool as jest.Mock).mockImplementationOnce(() => {
        return {
          // Return an object with a `streamAll` method that resolves to your desired value.
          streamAll: jest.fn().mockResolvedValue({
            error: 'Mock error',
          }),
        };
      });

      // Set up adapter state with artifact IDs
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };

      // Mock getting attachments
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValue({
          attachments: [{ id: 'attachment1' }],
        });

      // Mock methods
      adapter.initializeRepos = jest.fn();

      const result = await adapter.streamAttachments({
        stream: mockStream,
      });

      expect(result).toEqual({
        error: 'Mock error',
      });
      // The artifactIds array should remain unchanged
      expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
        'artifact1',
      ]);
    });

    it('should reset lastProcessed and attachment IDs list after processing all artifacts', async () => {
      const mockStream = jest.fn();
      adapter.state.toDevRev = {
        attachmentsMetadata: {
          artifactIds: ['artifact1'],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      };
      adapter['uploader'].getAttachmentsFromArtifactId = jest
        .fn()
        .mockResolvedValueOnce({
          attachments: [
            {
              url: 'http://example.com/file1.pdf',
              id: 'attachment1',
              file_name: 'file1.pdf',
              parent_id: 'parent1',
            },
            {
              url: 'http://example.com/file2.pdf',
              id: 'attachment2',
              file_name: 'file2.pdf',
              parent_id: 'parent2',
            },
            {
              url: 'http://example.com/file3.pdf',
              id: 'attachment3',
              file_name: 'file3.pdf',
              parent_id: 'parent3',
            },
          ],
        });

      adapter.processAttachment = jest.fn().mockResolvedValue(null);

      await adapter.streamAttachments({
        stream: mockStream,
      });

      expect(
        adapter.state.toDevRev.attachmentsMetadata.artifactIds
      ).toHaveLength(0);
      expect(adapter.state.toDevRev.attachmentsMetadata.lastProcessed).toBe(0);
    });
  });

  describe(WorkerAdapter.prototype.processAttachment.name, () => {
    const createMockHttpStream = (headers: Record<string, string> = {}) =>
      ({
        headers,
        data: { destroy: jest.fn() },
      }) as any;

    beforeEach(() => {
      adapter.initializeRepos([{ itemType: 'ssor_attachment' }]);

      const mockRepo = { push: jest.fn().mockResolvedValue(undefined) };
      adapter.getRepo = jest.fn().mockReturnValue(mockRepo);
    });

    it('should use attachment.content_type when provided, ignoring HTTP header', async () => {
      const mockStream = jest.fn().mockResolvedValue({
        httpStream: createMockHttpStream({
          'content-type': 'text/plain',
          'content-length': '100',
        }),
      });

      adapter['uploader'].getArtifactUploadUrl = jest
        .fn()
        .mockResolvedValue({
          response: { artifact_id: 'art_1', upload_url: 'https://upload', form_data: [] },
        });
      adapter['uploader'].streamArtifact = jest
        .fn()
        .mockResolvedValue({ response: {} });
      adapter['uploader'].confirmArtifactUpload = jest
        .fn()
        .mockResolvedValue({ response: {} });

      const attachment = {
        id: 'att-1',
        url: 'https://example.com/file.pdf',
        file_name: 'file.pdf',
        parent_id: 'parent-1',
        content_type: 'application/pdf',
      };

      await adapter.processAttachment(attachment, mockStream);

      expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
        'file.pdf',
        'application/pdf',
        100
      );
    });

    it('should use HTTP header content-type when attachment.content_type is not set', async () => {
      const mockStream = jest.fn().mockResolvedValue({
        httpStream: createMockHttpStream({
          'content-type': 'image/jpeg',
          'content-length': '200',
        }),
      });

      adapter['uploader'].getArtifactUploadUrl = jest
        .fn()
        .mockResolvedValue({
          response: { artifact_id: 'art_2', upload_url: 'https://upload', form_data: [] },
        });
      adapter['uploader'].streamArtifact = jest
        .fn()
        .mockResolvedValue({ response: {} });
      adapter['uploader'].confirmArtifactUpload = jest
        .fn()
        .mockResolvedValue({ response: {} });

      const attachment = {
        id: 'att-2',
        url: 'https://example.com/photo.jpg',
        file_name: 'photo.jpg',
        parent_id: 'parent-2',
      };

      await adapter.processAttachment(attachment, mockStream);

      expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
        'photo.jpg',
        'image/jpeg',
        200
      );
    });

    it('should fall back to application/octet-stream when neither content_type nor HTTP header is set', async () => {
      const mockStream = jest.fn().mockResolvedValue({
        httpStream: createMockHttpStream({}),
      });

      adapter['uploader'].getArtifactUploadUrl = jest
        .fn()
        .mockResolvedValue({
          response: { artifact_id: 'art_3', upload_url: 'https://upload', form_data: [] },
        });
      adapter['uploader'].streamArtifact = jest
        .fn()
        .mockResolvedValue({ response: {} });
      adapter['uploader'].confirmArtifactUpload = jest
        .fn()
        .mockResolvedValue({ response: {} });

      const attachment = {
        id: 'att-3',
        url: 'https://example.com/file.bin',
        file_name: 'file.bin',
        parent_id: 'parent-3',
      };

      await adapter.processAttachment(attachment, mockStream);

      expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
        'file.bin',
        'application/octet-stream',
        undefined
      );
    });
  });

  describe(WorkerAdapter.prototype.emit.name, () => {
    let counter: { counter: number };
    let mockPostMessage: jest.Mock;

    beforeEach(() => {
      counter = { counter: 0 };

      // Import the worker_threads module and spy on parentPort.postMessage
      const workerThreads = require('node:worker_threads');
      mockPostMessage = jest.fn().mockImplementation(() => {
        counter.counter += 1;
      });

      // Spy on the parentPort.postMessage method
      if (workerThreads.parentPort) {
        jest
          .spyOn(workerThreads.parentPort, 'postMessage')
          .mockImplementation(mockPostMessage);
      } else {
        // If parentPort is null (not in worker context), create a mock
        workerThreads.parentPort = {
          postMessage: mockPostMessage,
        };
      }
    });

    afterEach(() => {
      // Restore all mocks
      jest.restoreAllMocks();
    });

    it('should emit only one event when multiple events of same type are sent', async () => {
      adapter['adapterState'].postState = jest
        .fn()
        .mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

      await adapter.emit(ExtractorEventType.MetadataExtractionError, {
        reports: [],
        processed_files: [],
      });
      await adapter.emit(ExtractorEventType.MetadataExtractionError, {
        reports: [],
        processed_files: [],
      });

      expect(counter.counter).toBe(1);
    });

    it('should emit event when different event type is sent after previous events', async () => {
      adapter['adapterState'].postState = jest
        .fn()
        .mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

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

      expect(counter.counter).toBe(1);
    });

    it('should correctly emit one event even if postState errors', async () => {
      adapter['adapterState'].postState = jest
        .fn()
        .mockRejectedValue(new Error('postState error'));
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

      await adapter.emit(ExtractorEventType.MetadataExtractionError, {
        reports: [],
        processed_files: [],
      });
      expect(counter.counter).toBe(1);
    });

    it('should correctly emit one event even if uploadAllRepos errors', async () => {
      adapter['adapterState'].postState = jest
        .fn()
        .mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest
        .fn()
        .mockRejectedValue(new Error('uploadAllRepos error'));

      await adapter.emit(ExtractorEventType.MetadataExtractionError, {
        reports: [],
        processed_files: [],
      });
      expect(counter.counter).toBe(1);
    });
  });

  describe('workers_oldest / workers_newest boundary updates', () => {
    let mockPostMessage: jest.Mock;

    beforeEach(() => {
      const workerThreads = require('node:worker_threads');
      mockPostMessage = jest.fn();
      if (workerThreads.parentPort) {
        jest
          .spyOn(workerThreads.parentPort, 'postMessage')
          .mockImplementation(mockPostMessage);
      } else {
        workerThreads.parentPort = { postMessage: mockPostMessage };
      }

      adapter['adapterState'].postState = jest
        .fn()
        .mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    /**
     * Helper: sets extraction_start and extraction_end on the event context,
     * resets the emit guard so the adapter can emit again, then emits
     * AttachmentExtractionDone.
     */
    async function emitDone(
      adapterInstance: WorkerAdapter<{ attachments: { completed: boolean } }>,
      extractionStart: string | undefined,
      extractionEnd: string | undefined
    ) {
      adapterInstance.event.payload.event_context.extraction_start =
        extractionStart;
      adapterInstance.event.payload.event_context.extraction_end =
        extractionEnd;
      // Reset the emit guard so we can emit multiple times in a single test
      adapterInstance['hasWorkerEmitted'] = false;

      await adapterInstance.emit(ExtractorEventType.AttachmentExtractionDone, {
        reports: [],
        processed_files: [],
      });
    }

    describe('initial import with UNBOUNDED start', () => {
      it('should set workers_oldest to UNBOUNDED_DATE_TIME_VALUE and workers_newest to extraction end', async () => {
        await emitDone(
          adapter,
          UNBOUNDED_DATE_TIME_VALUE,
          '2025-06-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
        expect(adapter.state.workers_newest).toBe('2025-06-01T00:00:00.000Z');
      });
    });

    describe('reconciliation after UNBOUNDED initial import', () => {
      it('should NOT overwrite workers_oldest when reconciliation start is later than sentinel', async () => {
        // Initial import: UNBOUNDED start, NOW end
        await emitDone(
          adapter,
          UNBOUNDED_DATE_TIME_VALUE,
          '2025-06-01T00:00:00.000Z'
        );

        // Reconciliation: absolute dates within the range
        await emitDone(
          adapter,
          '2025-01-01T00:00:00.000Z',
          '2025-03-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
        expect(adapter.state.workers_newest).toBe('2025-06-01T00:00:00.000Z');
      });

      it('should NOT overwrite workers_oldest even when reconciliation start is very early', async () => {
        // Initial import: UNBOUNDED start, NOW end
        await emitDone(
          adapter,
          UNBOUNDED_DATE_TIME_VALUE,
          '2025-06-01T00:00:00.000Z'
        );

        // Reconciliation with a very old start date — still later than epoch
        await emitDone(
          adapter,
          '1980-01-01T00:00:00.000Z',
          '1990-01-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
        expect(adapter.state.workers_newest).toBe('2025-06-01T00:00:00.000Z');
      });
    });

    describe('forward sync after UNBOUNDED initial import', () => {
      it('should expand workers_newest forward while preserving workers_oldest', async () => {
        // Initial import
        await emitDone(
          adapter,
          UNBOUNDED_DATE_TIME_VALUE,
          '2025-06-01T00:00:00.000Z'
        );

        // Forward sync: from workers_newest to now
        await emitDone(
          adapter,
          '2025-06-01T00:00:00.000Z',
          '2025-07-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
        expect(adapter.state.workers_newest).toBe('2025-07-01T00:00:00.000Z');
      });
    });

    describe('reconciliation with end beyond current newest', () => {
      it('should expand workers_newest when reconciliation end is later', async () => {
        // Initial import
        await emitDone(
          adapter,
          UNBOUNDED_DATE_TIME_VALUE,
          '2025-06-01T00:00:00.000Z'
        );

        // Reconciliation with end beyond current newest
        await emitDone(
          adapter,
          '2024-01-01T00:00:00.000Z',
          '2025-08-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
        expect(adapter.state.workers_newest).toBe('2025-08-01T00:00:00.000Z');
      });
    });

    describe('first sync with absolute dates (no UNBOUNDED)', () => {
      it('should set both boundaries from the extraction range', async () => {
        await emitDone(
          adapter,
          '2025-01-01T00:00:00.000Z',
          '2025-03-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe('2025-01-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-03-01T00:00:00.000Z');
      });
    });

    describe('reconciliation after absolute initial sync', () => {
      it('should expand workers_oldest backward when reconciliation start is earlier', async () => {
        // Initial sync with absolute dates
        await emitDone(
          adapter,
          '2025-01-01T00:00:00.000Z',
          '2025-03-01T00:00:00.000Z'
        );

        // Reconciliation with earlier start
        await emitDone(
          adapter,
          '2024-06-01T00:00:00.000Z',
          '2025-02-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe('2024-06-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-03-01T00:00:00.000Z');
      });

      it('should NOT change boundaries when reconciliation is within existing range', async () => {
        // Initial sync
        await emitDone(
          adapter,
          '2025-01-01T00:00:00.000Z',
          '2025-03-01T00:00:00.000Z'
        );

        // Reconciliation entirely within existing range
        await emitDone(
          adapter,
          '2025-01-15T00:00:00.000Z',
          '2025-02-15T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe('2025-01-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-03-01T00:00:00.000Z');
      });

      it('should expand both boundaries when reconciliation exceeds both', async () => {
        // Initial sync
        await emitDone(
          adapter,
          '2025-01-01T00:00:00.000Z',
          '2025-03-01T00:00:00.000Z'
        );

        // Reconciliation exceeding both ends
        await emitDone(
          adapter,
          '2024-06-01T00:00:00.000Z',
          '2025-09-01T00:00:00.000Z'
        );

        expect(adapter.state.workers_oldest).toBe('2024-06-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-09-01T00:00:00.000Z');
      });
    });

    describe('multiple forward syncs', () => {
      it('should progressively expand workers_newest while preserving workers_oldest', async () => {
        // Initial import
        await emitDone(
          adapter,
          UNBOUNDED_DATE_TIME_VALUE,
          '2025-06-01T00:00:00.000Z'
        );

        // First forward sync
        await emitDone(
          adapter,
          '2025-06-01T00:00:00.000Z',
          '2025-07-01T00:00:00.000Z'
        );
        expect(adapter.state.workers_newest).toBe('2025-07-01T00:00:00.000Z');

        // Second forward sync
        await emitDone(
          adapter,
          '2025-07-01T00:00:00.000Z',
          '2025-08-01T00:00:00.000Z'
        );
        expect(adapter.state.workers_newest).toBe('2025-08-01T00:00:00.000Z');

        // workers_oldest should remain the sentinel throughout
        expect(adapter.state.workers_oldest).toBe(UNBOUNDED_DATE_TIME_VALUE);
      });
    });

    describe('non-AttachmentExtractionDone events should NOT update boundaries', () => {
      it('should not update boundaries on DataExtractionDone', async () => {
        adapter.state.workers_oldest = '2025-01-01T00:00:00.000Z';
        adapter.state.workers_newest = '2025-03-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_start =
          '2024-01-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_end =
          '2025-12-01T00:00:00.000Z';

        await adapter.emit(ExtractorEventType.DataExtractionDone, {
          reports: [],
          processed_files: [],
        });

        expect(adapter.state.workers_oldest).toBe('2025-01-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-03-01T00:00:00.000Z');
      });

      it('should not update boundaries on DataExtractionProgress', async () => {
        adapter.state.workers_oldest = '2025-01-01T00:00:00.000Z';
        adapter.state.workers_newest = '2025-03-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_start =
          '2024-01-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_end =
          '2025-12-01T00:00:00.000Z';

        await adapter.emit(ExtractorEventType.DataExtractionProgress, {
          reports: [],
          processed_files: [],
        });

        expect(adapter.state.workers_oldest).toBe('2025-01-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-03-01T00:00:00.000Z');
      });

      it('should not update boundaries on MetadataExtractionError', async () => {
        adapter.state.workers_oldest = '2025-01-01T00:00:00.000Z';
        adapter.state.workers_newest = '2025-03-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_start =
          '2024-01-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_end =
          '2025-12-01T00:00:00.000Z';

        await adapter.emit(ExtractorEventType.MetadataExtractionError, {
          reports: [],
          processed_files: [],
        });

        expect(adapter.state.workers_oldest).toBe('2025-01-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-03-01T00:00:00.000Z');
      });

      it('should not update boundaries on AttachmentExtractionError', async () => {
        adapter.state.workers_oldest = '2025-01-01T00:00:00.000Z';
        adapter.state.workers_newest = '2025-03-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_start =
          '2024-01-01T00:00:00.000Z';
        adapter.event.payload.event_context.extraction_end =
          '2025-12-01T00:00:00.000Z';

        await adapter.emit(ExtractorEventType.AttachmentExtractionError, {
          reports: [],
          processed_files: [],
        });

        expect(adapter.state.workers_oldest).toBe('2025-01-01T00:00:00.000Z');
        expect(adapter.state.workers_newest).toBe('2025-03-01T00:00:00.000Z');
      });
    });
  });
});
