// 1. Create a mock function for the method you want to override.
const mockUpload = (itemType: string, objects: object[]) => {
  return {
    error: null,
    artifact: {
      id: `artifact-${itemType}-${Math.random().toString(36).substring(2, 15)}`,
      item_type: itemType,
      item_count: objects.length,
    }
  };
};

// 2. Mock the entire 'uploader' module.
// The factory function () => { ... } returns the mock implementation.
jest.mock('../uploader/uploader', () => {
  return {
    // The mocked Uploader class
    Uploader: jest.fn().mockImplementation(() => {
      // The constructor of the mocked Uploader returns an object
      // with the methods you want to control.
      return {
        upload: mockUpload,
      };
    }),
  };
});

import { createEvent, createItems } from '../tests/test-helpers';
import { WorkerAdapter } from "./worker-adapter";
import { State, createAdapterState } from "../state/state";
import { EventType } from "../types";

describe("Batch ordering", () => {

  describe('should take batch ordering into account', () => {
    it('should maintain artifact ordering when repo A has items below batch size and repo B has items above batch size', async () => {
      // Create a fresh adapter instance for this test to avoid mocking conflicts
      interface TestState {
        attachments: { completed: boolean };
      }
      let mockEvent = createEvent({ eventType: EventType.ExtractionDataStart });
      let mockAdapterState = new State<TestState>({
        event: mockEvent,
        initialState: { attachments: { completed: false } },
      });

      const testAdapter = new WorkerAdapter({
        event: mockEvent,
        adapterState: mockAdapterState,
        options: {
          batchSize: 50
        }
      });

      // Track the order of artifacts added to the adapter
      const artifactOrder: string[] = [];
      const originalArtifacts = testAdapter.artifacts;

      // Override the artifacts setter to track order
      Object.defineProperty(testAdapter, 'artifacts', {
        get: () => originalArtifacts,
        set: (artifacts) => {
          // Track the order of artifacts being added
          artifacts.forEach((artifact: any) => {
            artifactOrder.push(artifact.item_type);
          });
          originalArtifacts.push(...artifacts);
        }
      });

      // Initialize repos
      testAdapter.initializeRepos([
        { itemType: 'A' },
        { itemType: 'B' }
      ]);

      await testAdapter.getRepo('A')?.push(createItems(5));
      await testAdapter.getRepo('B')?.push(createItems(105));

      await testAdapter.uploadAllRepos();

      const artifacts = testAdapter.artifacts;
      console.log(artifacts);
      expect(artifacts.length).toBe(4);

      // Check that all 'A' artifacts come before any 'B' artifacts
      let firstBFound = false;
      for (const artifact of artifacts) {
        if (artifact.item_type === 'B') {
          firstBFound = true;
        } else if (artifact.item_type === 'A') {
          // If we find an 'A' artifact after we've already found a 'B' artifact,
          // the ordering is incorrect
          expect(firstBFound).toBe(false);
        }
      }
    });
  });
});