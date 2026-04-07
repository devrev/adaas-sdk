import { AirdropEvent, EventType } from '../types/extraction';

import { CreateEventParams } from './create-event.interfaces';

/**
 * Creates a fully-formed {@link AirdropEvent} populated with sensible test
 * defaults. Every field can be overridden through the params object.
 *
 * Unlike the internal test helper this function is **portable** — it accepts
 * `mockServerBaseUrl` as an explicit parameter so it can be used both inside
 * the SDK test suite and by external consumers (e.g. local runners).
 *
 * @example
 * ```ts
 * const event = createEvent({
 *   mockServerBaseUrl: mockServer.baseUrl,
 *   eventType: EventType.StartExtractingMetadata,
 *   eventContextOverrides: { mode: 'INITIAL' },
 * });
 * ```
 */
export function createEvent({
  mockServerBaseUrl,
  eventType = EventType.StartExtractingData,
  externalSyncUnits = [],
  progress,
  error,
  delay,
  contextOverrides = {},
  payloadOverrides = {},
  eventContextOverrides = {},
  executionMetadataOverrides = {},
}: CreateEventParams): AirdropEvent {
  const defaultEventContext = {
    callback_url: `${mockServerBaseUrl}/callback_url`,
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
    mode: 'test_mode',
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
    worker_data_url: `${mockServerBaseUrl}/worker_data_url`,
  };

  return {
    context: {
      secrets: {
        service_account_token: 'test_token',
      },
      snap_in_version_id: 'test_snap_in_version_id',
      snap_in_id: 'test_snap_in_id',
      ...contextOverrides,
    },
    payload: {
      connection_data: {
        org_id: 'test_org_id',
        org_name: 'test_org_name',
        key: 'test_key',
        key_type: 'test_key_type',
      },
      event_context: {
        ...defaultEventContext,
        ...eventContextOverrides,
      },
      event_type: eventType,
      event_data: {
        external_sync_units: externalSyncUnits,
        progress,
        error,
        delay,
      },
      ...payloadOverrides,
    },
    execution_metadata: {
      devrev_endpoint: mockServerBaseUrl,
      ...executionMetadataOverrides,
    },
    input_data: {
      global_values: {
        test_global_key: 'test_global_value',
      },
      event_sources: {
        test_event_source_key: 'test_event_source_id',
      },
    },
  };
}
