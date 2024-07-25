import axios from 'axios';
import { createAdapter, Adapter } from '../src/adapter';
import { State, createAdapterState } from '../src/state';
import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
  EventData,
} from '../src/types';
import { getTimeoutExtractorEventType } from '../src/common/helpers';

jest.mock('axios');
jest.mock('../src/state');
jest.mock('../src/common/helpers');
jest.mock('../src/logging');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedCreateAdapterState = createAdapterState as jest.MockedFunction<
  typeof createAdapterState
>;
const mockedGetTimeoutExtractorEventType =
  getTimeoutExtractorEventType as jest.MockedFunction<
    typeof getTimeoutExtractorEventType
  >;

describe('Adapter', () => {
  const event: AirdropEvent = {
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

  describe('createAdapter', () => {
    it('should create an Adapter instance', async () => {
      const adapterState = new State(event, initialState);
      mockedCreateAdapterState.mockResolvedValue(adapterState);

      const adapter = await createAdapter(event, initialState, false);

      expect(adapter).toBeInstanceOf(Adapter);
      expect(mockedCreateAdapterState).toHaveBeenCalledWith(
        event,
        expect.anything()
      );
    });
  });

  describe('Adapter', () => {
    let adapter: Adapter<typeof initialState>;
    let adapterState: State<typeof initialState>;

    beforeEach(() => {
      adapterState = new State(event, initialState);
      adapter = new Adapter(event, adapterState, false);
    });

    it('should emit event and save state if event type is not stateless', async () => {
      const data: EventData = {};
      mockedAxios.post.mockResolvedValue({ data: {} });

      await adapter.emit(ExtractorEventType.ExtractionDataDone, data);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'callback_url',
        expect.objectContaining({
          event_type: ExtractorEventType.ExtractionDataDone,
        }),
        expect.any(Object)
      );
      expect(adapterState.postState).toHaveBeenCalledWith(adapter.state);
    });

    it('should not save state if event type is stateless', async () => {
      const statelessEvent = {
        ...event,
        payload: {
          ...event.payload,
          event_type: EventType.ExtractionExternalSyncUnitsStart,
        },
      };
      adapter = new Adapter(statelessEvent, adapterState, false);
      const data: EventData = {};
      mockedAxios.post.mockResolvedValue({ data: {} });

      await adapter.emit(
        ExtractorEventType.ExtractionExternalSyncUnitsDone,
        data
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'callback_url',
        expect.objectContaining({
          event_type: ExtractorEventType.ExtractionExternalSyncUnitsDone,
        }),
        expect.any(Object)
      );
      expect(adapterState.postState).not.toHaveBeenCalled();
    });

    it('should exit adapter on heartbeat timeout', async () => {
      mockedGetTimeoutExtractorEventType.mockReturnValue({
        eventType: ExtractorEventType.ExtractionMetadataError,
        isError: true,
      });
      jest
        .spyOn(Date, 'now')
        .mockImplementation(
          () => adapter['startTime'] + adapter['lambdaTimeout'] + 1
        );

      const heartbeatResult = await adapter['heartbeat']();

      expect(heartbeatResult).toBe(true);
      expect(mockedGetTimeoutExtractorEventType).toHaveBeenCalledWith(
        event.payload.event_type
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'callback_url',
        expect.objectContaining({
          event_type: ExtractorEventType.ExtractionMetadataError,
        }),
        expect.any(Object)
      );
    });

    it('should not emit event if adapter is in exit state', async () => {
      adapter['exit'] = true;

      await adapter.emit(ExtractorEventType.ExtractionDataDone);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle failed event emission gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await adapter.emit(ExtractorEventType.ExtractionDataDone);

      expect(mockedAxios.post).toHaveBeenCalled();
      expect(adapter['exit']).toBe(true);
    });
  });
});
