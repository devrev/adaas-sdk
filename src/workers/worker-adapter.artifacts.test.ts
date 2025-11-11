import { State } from '../state/state';
import { createEvent, createItems } from '../tests/test-helpers';
import { Artifact, EventTypeV2 } from '../types';
import { WorkerAdapter } from './worker-adapter';

// 1. Create a mock function for the method you want to override.
const mockUpload = (itemType: string, objects: object[]) => {
  return {
    error: null,
    artifact: {
      id: `artifact-${itemType}-${Math.random().toString(36).substring(2, 15)}`,
      item_type: itemType,
      item_count: objects.length,
    },
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

function checkArtifactOrder(
  artifacts: Artifact[],
  expectedOrder: { itemType: string }[]
): boolean {
  let outerIndex = 0;
  for (const artifact of artifacts) {
    try {
      // Always increase outer index. If items are out of order, the array will overflow and exception will be thrown
      while (artifact.item_type != expectedOrder[outerIndex].itemType) {
        outerIndex++;
      }
    } catch (e) {
      console.error('Error finding artifact type in repos:', e);
      return false;
    }
  }
  return true;
}

describe('Artifact ordering when artifacts overflow batch sizes in repositories', () => {
  interface TestState {
    attachments: { completed: boolean };
  }
  let testAdapter: WorkerAdapter<TestState>;

  beforeEach(() => {
    // Create a fresh adapter instance for this test to avoid mocking conflicts
    const mockEvent = createEvent({
      eventType: EventTypeV2.ExtractionDataStart,
    });
    const mockAdapterState = new State<TestState>({
      event: mockEvent,
      initialState: { attachments: { completed: false } },
    });

    testAdapter = new WorkerAdapter({
      event: mockEvent,
      adapterState: mockAdapterState,
      options: {
        batchSize: 50,
      },
    });
  });

  it('should maintain artifact ordering when repo ItemTypeA has items below batch size and repo ItemTypeB has items above batch size', async () => {
    const repos = [{ itemType: 'ItemTypeA' }, { itemType: 'ItemTypeB' }];

    // Initialize repos
    testAdapter.initializeRepos(repos);

    await testAdapter.getRepo('ItemTypeA')?.push(createItems(5));
    await testAdapter.getRepo('ItemTypeB')?.push(createItems(105));

    await testAdapter.uploadAllRepos();

    const artifacts = testAdapter.artifacts;
    expect(artifacts.length).toBe(4);

    expect(checkArtifactOrder(artifacts, repos)).toBe(true);
  });

  it('should work with more than 2 repos', async () => {
    const repos = [
      { itemType: 'ItemTypeA' },
      { itemType: 'ItemTypeB' },
      { itemType: 'ItemTypeC' },
      { itemType: 'ItemTypeD' },
    ];

    // Initialize repos
    testAdapter.initializeRepos(repos);

    await testAdapter.getRepo('ItemTypeA')?.push(createItems(101));
    await testAdapter.getRepo('ItemTypeB')?.push(createItems(102));
    await testAdapter.getRepo('ItemTypeC')?.push(createItems(103));
    await testAdapter.getRepo('ItemTypeD')?.push(createItems(104));

    await testAdapter.uploadAllRepos();

    const artifacts = testAdapter.artifacts;
    expect(artifacts.length).toBe(12);

    expect(checkArtifactOrder(artifacts, repos)).toBe(true);
  });

  it('should maintain order with multiple pushes and uploads', async () => {
    const repos = [{ itemType: 'ItemTypeA' }, { itemType: 'ItemTypeB' }];

    // Initialize repos
    testAdapter.initializeRepos(repos);

    await testAdapter.getRepo('ItemTypeA')?.push(createItems(101));
    await testAdapter.getRepo('ItemTypeB')?.push(createItems(102));
    await testAdapter.getRepo('ItemTypeA')?.push(createItems(101));
    await testAdapter.getRepo('ItemTypeB')?.push(createItems(102));
    await testAdapter.getRepo('ItemTypeA')?.upload();
    await testAdapter.getRepo('ItemTypeB')?.upload();
    await testAdapter.getRepo('ItemTypeA')?.push(createItems(101));
    await testAdapter.getRepo('ItemTypeB')?.push(createItems(102));
    await testAdapter.getRepo('ItemTypeA')?.push(createItems(101));
    await testAdapter.getRepo('ItemTypeB')?.push(createItems(102));

    await testAdapter.uploadAllRepos();

    const artifacts = testAdapter.artifacts;
    expect(artifacts.length).toBe(20);

    expect(checkArtifactOrder(artifacts, repos)).toBe(true);
  });

  it('should not count artifacts if 0 items are pushed to the repo', async () => {
    const repos = [{ itemType: 'ItemTypeA' }];

    // Initialize repos
    testAdapter.initializeRepos(repos);

    await testAdapter.getRepo('ItemTypeA')?.push([]);

    await testAdapter.uploadAllRepos();

    const artifacts = testAdapter.artifacts;
    expect(artifacts.length).toBe(0);

    expect(checkArtifactOrder(artifacts, repos)).toBe(true);
  });
});
