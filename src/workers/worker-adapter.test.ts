import { WorkerAdapter } from './worker-adapter';
import { State } from '../state/state';
import { createEvent } from '../tests/test-helpers';
import {
  EventType,
  NormalizedAttachment,
  AdapterState,
  ExtractorEventType,
} from '../types';
import { AttachmentsStreamingPool } from '../attachments-streaming/attachments-streaming-pool';

// Mock dependencies
jest.mock('../common/control-protocol', () => ({
  emit: jest.fn().mockResolvedValue({}),
}));

// const mockPostState = jest.spyOn(State.prototype, 'postState').mockResolvedValue(); // Mock to resolve void
// const mockFetchState = jest.spyOn(State.prototype, 'fetchState').mockResolvedValue({}); // Mock to resolve a default state

jest.mock('../mappers/mappers');
jest.mock('../uploader/uploader');
// jest.mock('../state/state');
jest.mock('../repo/repo');
jest.mock('node:worker_threads', () => ({
  parentPort: {
    postMessage: jest.fn(),
  },
}));
jest.mock('../attachments-streaming/attachments-streaming-pool', () => {
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
    mockEvent = createEvent({ eventType: EventType.ExtractionDataStart });

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
        adapter['uploader'].getAttachmentsFromArtifactId = jest.fn().mockResolvedValue({
          attachments: [
            { url: 'http://example.com/file1.pdf', id: 'attachment1', file_name: 'file1.pdf', parent_id: 'parent1' },
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
        adapter['uploader'].getAttachmentsFromArtifactId = jest.fn().mockResolvedValue({
          attachments: [
            { url: 'http://example.com/file1.pdf', id: 'attachment1', file_name: 'file1.pdf', parent_id: 'parent1' },
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
        adapter['uploader'].getAttachmentsFromArtifactId = jest.fn().mockResolvedValue({
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
        adapter['uploader'].getAttachmentsFromArtifactId = jest.fn().mockResolvedValue({
          attachments: [],
        });

        // Mock methods
        adapter.initializeRepos = jest.fn();
        
        const result = await adapter.streamAttachments({
          stream: mockStream,
        });

        expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([]);
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

  describe(WorkerAdapter.prototype.emit.name, () => {
    let counter: {counter: number};
    let mockPostMessage: jest.Mock;

    beforeEach(() => {
      counter = { counter: 0 };

      // Import the worker_threads module and spy on parentPort.postMessage
      const workerThreads = require('node:worker_threads');
      mockPostMessage = jest.fn().mockImplementation((a: any) => {
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
      adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

      await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
        reports: [],
        processed_files: [],
      });
      await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
        reports: [],
        processed_files: [],
      });
      
      expect(counter.counter).toBe(1);
    });

    it('should emit event when different event type is sent after previous events', async () => {
      adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

      await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
        reports: [],
        processed_files: [],
      });
      await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
        reports: [],
        processed_files: [],
      });
      await adapter.emit(ExtractorEventType.ExtractionMetadataDone, {
        reports: [],
        processed_files: [],
      });
      
      expect(counter.counter).toBe(1);
    });
     
    it('should correctly emit one event even if postState errors', async () => {
      adapter['adapterState'].postState = jest.fn().mockRejectedValue(new Error('postState error'));
      adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

      await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
        reports: [],
        processed_files: [],
      });
      expect(counter.counter).toBe(1);
    });

    it('should correctly emit one event even if uploadAllRepos errors', async () => {
      adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
      adapter.uploadAllRepos = jest.fn().mockRejectedValue(new Error('uploadAllRepos error'));

      await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
        reports: [],
        processed_files: [],
      });
      expect(counter.counter).toBe(1);
    });
  });
});
