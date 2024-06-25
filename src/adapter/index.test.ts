import { Context, ExecutionMetadata } from '@devrev/typescript-sdk/dist/snap-ins';
import { AirdropEvent, EventType } from '../types';
import { Adapter } from './index';

jest.useFakeTimers();

const defaultEvent: AirdropEvent = {
  context: {
    secrets: {
      service_account_token: 'mockToken',
    },
  } as unknown as Context,
  payload: {
    connection_data: {
      org_id: 'mockOrgId',
      org_name: 'mockOrgName',
      key: 'mockKey',
      key_type: 'mockKeyType',
    },
    event_context: {
      mode: 'INITIAL',
      uuid: 'mockUuid',
      callback_url: 'mockCallbackUrl',
      dev_org_id: 'DEV-TESTORG',
      dev_user_id: 'DEV-TESTUSER',
      external_system_id: 'TESTSYSTEM',
      sync_run_id: 'mockSyncRunId',
    },
    event_type: EventType.ExtractionExternalSyncUnitsStart,
  },
  execution_metadata: {
    devrev_endpoint: 'http://api.dev.devrev-eng.ai',
  } as ExecutionMetadata,
  input_data: {
    global_values:{},
    event_sources: {},
  },
};

describe('Adapter', () => {
  let adapter: Adapter;

  beforeEach(() => {
    // Initialize the Adapter instance with mock data
    adapter = new Adapter(defaultEvent);
  });

  afterEach(async () => {
    // Clear all timers
    jest.clearAllTimers();

    // Clear all instances
    jest.clearAllMocks();
  });

  it('should add artifact to the list of artifacts', async () => {
    const artifact = {
      id: 'mockId',
      item_type: 'mockItemType',
      item_count: 1,
      // Mock artifact data
    };

    adapter.update({ artifact: artifact });

    const artifacts = adapter.getArtifacts();
    expect(artifacts).toContain(artifact);

    // Run all timers
    jest.runAllTimers();
  });

  it('should set extractor state if provided', async () => {
    const state = {
      testing: false,
    };

    adapter = new Adapter(
      {
        ...defaultEvent,
      },
      state
    );

    expect(adapter['extractorState']).toEqual(state);

    const newState = {
      testing: true,
    };

    adapter.update({ extractor_state: newState });
    expect(adapter['extractorState']).toEqual(newState);

    // Run all timers
    jest.runAllTimers();
  });

  it('update both an artifact and extractor state', async () => {
    const artifact = {
      id: 'mockId',
      item_type: 'mockItemType',
      item_count: 1,
    };

    const state = {
      willUpdateToTrue: false,
      willAdd4: 0,
    };

    adapter.update({ artifact: artifact, extractor_state: state });

    const artifacts = adapter.getArtifacts();
    expect(artifacts).toContain(artifact);

    expect(adapter['extractorState']).toEqual(state);

    const newState = {
      willUpdateToTrue: true,
      willAdd4: 4,
      newField: 'newField',
    };

    const newArtifact = {
      id: 'newMockId',
      item_type: 'newMockItemType',
      item_count: 2,
    };

    adapter.update({ artifact: newArtifact, extractor_state: newState });
    // Run all timers
    jest.runAllTimers();
  });
});
