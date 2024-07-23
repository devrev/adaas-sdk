import axios from 'axios';
import { Adapter, createAdapter } from '../src/adapter';
import {
  AirdropEvent,
  EventType,
  AdapterState,
  ExtractorEventType,
} from '../src/types';

// Mocking axios methods
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockEvent: AirdropEvent = {
  execution_metadata: {
    devrev_endpoint: 'devrev_endpoint',
  },
  context: {
    secrets: {
      service_account_token: 'service_account_token',
    },
  },
  payload: {
    connection_data: {
      org_id: 'org_id',
      org_name: 'org_name',
      key: 'key',
      key_type: 'key_type',
    },
    event_context: {
      mode: 'mode',
      callback_url: 'callback_url',
      dev_org_id: 'dev_org_id',
      dev_user_id: 'dev_user_id',
      external_system_id: 'external_system_id',
      uuid: 'uuid',
      sync_run_id: 'sync_run_id',
      sync_unit_id: 'sync_unit_id',
      worker_data_url: 'worker_data_url',
    },
    event_type: EventType.ExtractionExternalSyncUnitsStart,
  },
  input_data: {
    global_values: {},
    event_sources: {},
  },
};

describe('adapter.ts', () => {
  let adapter: Adapter<object>;

  beforeEach(async () => {
    jest.clearAllMocks();
    adapter = await createAdapter(mockEvent, {}, true);
  });

  it('should create a new instance of the Adapter', async () => {
    expect(adapter).toBeInstanceOf(Adapter);
  });

  describe('postState', () => {
    it('should post state correctly', async () => {
      const state: AdapterState<object> = {};
      mockedAxios.post.mockResolvedValue({ data: {} });

      await adapter.postState(state);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'worker_data_url.update',
        { state: JSON.stringify(state) },
        {
          headers: {
            Authorization: 'service_account_token',
          },
          params: {
            sync_unit: 'sync_unit_id',
          },
        }
      );

      expect(adapter.state).toEqual(state);
    });

    it('should handle post state error correctly', async () => {
      const state: AdapterState<object> = {};
      const error = new Error('Failed to update state');
      mockedAxios.post.mockRejectedValue(error);

      const emitSpy = jest.spyOn(adapter, 'emit');

      await adapter.postState(state);

      expect(emitSpy).toHaveBeenCalledWith(
        ExtractorEventType.ExtractionDataError,
        {
          error: { message: 'Failed to update state' },
        }
      );
    });
  });

  // write tests for fetchState, but use post method because we use it
  // in the fetchState method
  describe('fetchState', () => {
    it('should fetch state correctly', async () => {
      const state: AdapterState<object> = {};
      mockedAxios.post.mockResolvedValue({ data: { state: '{}' } });

      const fetchedState = await adapter.fetchState({});

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'worker_data_url.get',
        {},
        {
          headers: {
            Authorization: 'service_account_token',
          },
          params: {
            sync_unit: 'sync_unit_id',
          },
        }
      );

      expect(fetchedState).toEqual(state);
    });
  });
});
