import {
  Item,
  NormalizedAttachment,
  NormalizedItem,
} from '../repo/repo.interfaces';
import { AirdropEvent } from '../types/extraction';
import { CreateEventInterface } from './test-helpers.interfaces';

export function createEvent({
  eventType,
  externalSyncUnits = [],
  progress,
  error,
  delay,
  contextOverrides = {},
  payloadOverrides = {},
}: CreateEventInterface): AirdropEvent {
  return {
    context: {
      secrets: {
        service_account_token: 'test_token',
      },
      snap_in_version_id: 'test_snap_in_version_id',
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
        callback_url: 'test_callback_url',
        dev_org: 'test_dev_org',
        dev_org_id: 'test_dev_org_id',
        dev_user: 'test_dev_user',
        dev_user_id: 'test_dev_user_id',
        external_sync_unit: 'test_external_sync_unit',
        external_sync_unit_id: 'test_external_sync_unit_id',
        external_sync_unit_name: 'test_external_sync_unit_name',
        external_system: 'test_external_system',
        external_system_type: 'test_external_system_type',
        import_slug: 'test_import_slug',
        mode: 'test_mode',
        request_id: 'test_request_id',
        snap_in_slug: 'test_snap_in_slug',
        sync_run: 'test_sync_run',
        sync_run_id: 'test_sync_run_id',
        sync_tier: 'test_sync_tier',
        sync_unit: 'test_sync_unit',
        sync_unit_id: 'test_sync_unit_id',
        uuid: 'test_uuid',
        worker_data_url: 'test_worker_data_url',
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
      devrev_endpoint: 'test_devrev_endpoint',
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

export function createItem(id: number): Item {
  return {
    id,
    created_at: '2021-01-01',
    updated_at: '2021-01-01',
    name: 'item' + id,
  };
}

export function createItems(count: number): Item[] {
  return Array.from({ length: count }, (_, index) => createItem(index));
}

export function normalizeItem(item: Item): NormalizedItem {
  return {
    id: item.id,
    created_date: item.created_at,
    modified_date: item.updated_at,
    data: {
      name: item.name,
    },
  };
}

export function createAttachment(id: number): NormalizedAttachment {
  return {
    id: id.toString(),
    url: 'https://test.com/' + id,
    author_id: 'author' + id,
    file_name: 'file' + id,
    parent_id: 'parent' + id,
  };
}

export function createAttachments(count: number): NormalizedAttachment[] {
  return Array.from({ length: count }, (_, index) => createAttachment(index));
}
