import { AirSyncEvent, EventType } from '../types/extraction';

import { MOCK_SERVER_DEFAULT_URL } from './mock-server';

/**
 * Recursively makes all properties of T optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep merges source into target. Arrays and primitives from source replace
 * those in target; plain objects are merged recursively.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as DeepPartial<Record<string, unknown>>
      ) as T[keyof T];
    } else {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}

/**
 * Creates a mock AirSyncEvent for testing.
 *
 * @param mockServerUrl - Base URL for the mock server. Defaults to {@link MOCK_SERVER_DEFAULT_URL}.
 *   The `callback_url`, `worker_data_url`, and `devrev_endpoint` fields are
 *   derived from this value unless explicitly overridden.
 * @param overrides - Deep partial of AirSyncEvent. Any provided fields are
 *   deep-merged on top of the defaults.
 */
export function createMockEvent(
  mockServerUrl: string = MOCK_SERVER_DEFAULT_URL,
  overrides: DeepPartial<AirSyncEvent> = {}
): AirSyncEvent {
  const base: AirSyncEvent = {
    context: {
      secrets: {
        service_account_token: 'test_token',
      },
      snap_in_version_id: 'test_snap_in_version_id',
      snap_in_id: 'test_snap_in_id',
      user_id: 'test_user_id',
      dev_oid: 'test_dev_oid',
      source_id: 'test_source_id',
      service_account_id: 'test_service_account_id',
    },
    payload: {
      connection_data: {
        org_id: 'test_org_id',
        org_name: 'test_org_name',
        key: 'test_key',
        key_type: 'test_key_type',
      },
      event_context: {
        callback_url: `${mockServerUrl}/callback_url`,
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
        worker_data_url: `${mockServerUrl}/worker_data_url`,
      },
      event_type: EventType.StartExtractingData,
      event_data: {},
    },
    execution_metadata: {
      devrev_endpoint: mockServerUrl,
    },
    input_data: {
      global_values: {},
      event_sources: {},
    },
  };

  const merged = deepMerge(
    base as unknown as Record<string, unknown>,
    overrides as DeepPartial<Record<string, unknown>>
  ) as unknown as AirSyncEvent;

  // Ensure mock server URLs always win over overrides, unless the caller
  // explicitly provided them.
  if (!overrides.payload?.event_context?.callback_url) {
    merged.payload.event_context.callback_url = `${mockServerUrl}/callback_url`;
  }
  if (!overrides.payload?.event_context?.worker_data_url) {
    merged.payload.event_context.worker_data_url = `${mockServerUrl}/worker_data_url`;
  }

  return merged;
}
