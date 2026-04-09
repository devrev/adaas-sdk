import {
  AirdropEvent,
  ConnectionData,
  EventContext,
  EventType,
} from '../types/extraction';

export type MockEventOverrides = {
  mockServerBaseUrl: string;
  eventType: EventType;
  fixture?: {
    connection_data?: object;
    event_context?: object;
    event_data?: object;
    context?: object;
  };
};

export function createMockEvent(overrides: MockEventOverrides): AirdropEvent {
  const connectionData: ConnectionData = {
    org_id: 'test_org_id',
    org_name: 'test_org_name',
    key: 'test_key',
    key_type: 'test_key_type',
    ...overrides.fixture?.connection_data,
  };

  const eventContext: EventContext = {
    dev_org: 'test_dev_org',
    dev_oid: 'test_dev_oid',
    dev_org_id: 'test_dev_org_id',
    dev_user: 'test_dev_user',
    dev_user_id: 'test_dev_user_id',
    dev_uid: 'test_dev_uid',
    event_type_adaas: 'test_event_type_adaas',
    external_sync_unit: 'test_external_sync_unit',
    external_sync_unit_id: 'test_external_sync_unit_id',
    external_sync_unit_name: 'test_external_sync_unit_name',
    external_system: 'test_external_system',
    external_system_id: 'test_external_system_id',
    external_system_name: 'test_external_system_name',
    external_system_type: 'test_external_system_type',
    import_slug: 'test_import_slug',
    mode: 'INITIAL',
    request_id: 'test_request_id',
    request_id_adaas: 'test_request_id_adaas',
    run_id: 'test_run_id',
    sequence_version: 'test_sequence_version',
    snap_in_slug: 'test_snap_in_slug',
    snap_in_version_id: 'test_snap_in_version_id',
    sync_run: 'test_sync_run',
    sync_run_id: 'test_sync_run_id',
    sync_tier: 'test_sync_tier',
    sync_unit: 'test_sync_unit',
    sync_unit_id: 'test_sync_unit_id',
    uuid: 'test_uuid',
    ...overrides.fixture?.event_context,
    // MockServer URLs must always override fixture values.
    callback_url: `${overrides.mockServerBaseUrl}/callback_url`,
    worker_data_url: `${overrides.mockServerBaseUrl}/worker_data_url`,
  };

  const event = {
    context: {
      secrets: {
        service_account_token: 'test_token',
      },
      snap_in_version_id: 'test_snap_in_version_id',
      snap_in_id: 'test_snap_in_id',
      ...overrides.fixture?.context,
    },
    payload: {
      connection_data: connectionData,
      event_context: eventContext,
      event_type: overrides.eventType,
      event_data: overrides.fixture?.event_data ?? {},
    },
    execution_metadata: {
      devrev_endpoint: overrides.mockServerBaseUrl,
    },
    input_data: {
      global_values: {},
      event_sources: {},
    },
  } satisfies AirdropEvent;

  return event;
}
