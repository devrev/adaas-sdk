import { AirdropEvent, EventType, ExtractorEventType } from '../src/types';
import { createAdapter } from '../src/adapter';
import { DemoExtractor } from '../src/demo-extractor';

type ExtractorState = object;

const mockEvent: AirdropEvent = {
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
      worker_data_url: 'worker_data_url',
    },
    event_type: EventType.ExtractionExternalSyncUnitsStart,
  },
  input_data: {
    global_values: {},
    event_sources: {},
  },
};

describe('DemoExtractor', () => {
  it('should create a new instance of the DemoExtractor', async () => {
    const adapter = await createAdapter<ExtractorState>(mockEvent, {});
    const demoExtractor = new DemoExtractor(mockEvent, adapter);
    expect(demoExtractor).toBeInstanceOf(DemoExtractor);
  });

  it('should emit EXTRACTION_EXTERNAL_SYNC_UNITS_DONE with correct payload', async () => {
    const adapter = await createAdapter<ExtractorState>(mockEvent, {});
    const demoExtractor = new DemoExtractor(mockEvent, adapter);
    const spy = jest.spyOn(adapter, 'emit');
    await demoExtractor.run();
    expect(spy).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionExternalSyncUnitsDone,
      {
        external_sync_units: [
          {
            id: 'devrev',
            name: 'devrev',
            description: 'Demo external sync unit',
          },
        ],
      }
    );
  });
});
