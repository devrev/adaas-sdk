import axios from 'axios';

import { createAdapterState, State } from '../src/state';
import { AirdropEvent, EventType } from '../src/types';
import { STATELESS_EVENT_TYPES } from '../src/common/constants';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AdapterState', () => {
  const event: AirdropEvent = {
    execution_metadata: {
      devrev_endpoint: 'devrev_endpoint',
    },
    context: {
      secrets: {
        service_account_token: 'service_account_token',
      },
      snap_in_version_id: 'snap_in_version_id',
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
      event_type: EventType.ExtractionDataStart,
    },
    input_data: {
      global_values: {},
      event_sources: {},
    },
  };

  const initialState = {
    customField: 'initial',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAdapterState', () => {
    it('should create an AdapterState instance', async () => {
      const adapterState = await createAdapterState(event, initialState);
      expect(adapterState).toBeInstanceOf(State);
      expect(adapterState.state).toEqual({
        ...initialState,
        lastSyncStarted: '',
        lastSuccessfulSyncStarted: '',
      });
    });

    it('should fetch state if event type is not stateless', async () => {
      const spy = jest.spyOn(State.prototype, 'fetchState');
      await createAdapterState(event, initialState);
      expect(spy).toHaveBeenCalled();
    });

    it('should not fetch state if event type is stateless', async () => {
      const statelessEvent = {
        ...event,
        payload: { ...event.payload, event_type: STATELESS_EVENT_TYPES[0] },
      };
      const spy = jest.spyOn(State.prototype, 'fetchState');
      await createAdapterState(statelessEvent, initialState);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('AdapterState', () => {
    let adapterState: State<typeof initialState>;

    beforeEach(() => {
      adapterState = new State(event, initialState);
    });

    it('should initialize with given state', () => {
      expect(adapterState.state).toEqual({
        ...initialState,
        lastSyncStarted: '',
        lastSuccessfulSyncStarted: '',
      });
    });

    it('should update state via postState', async () => {
      const newState = { ...initialState, customField: 'updated' };
      mockedAxios.post.mockResolvedValue({ data: {} });

      await adapterState.postState(newState);

      expect(adapterState.state).toEqual(newState);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'worker_data_url.update',
        { state: JSON.stringify(newState) },
        {
          headers: { Authorization: 'service_account_token' },
          params: { sync_unit: 'sync_unit_id' },
        }
      );
    });

    it('should handle non-404 error in fetchState', async () => {
      const error = new Error('Network error');
      mockedAxios.post.mockRejectedValue(error);

      const state = await adapterState.fetchState(initialState);

      expect(state).toBe(error);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'worker_data_url.get',
        {},
        {
          headers: { Authorization: 'service_account_token' },
          params: { sync_unit: 'sync_unit_id' },
        }
      );
    });
  });
});
