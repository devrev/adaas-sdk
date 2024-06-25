import {
  Context,
  ExecutionMetadata,
} from '@devrev/typescript-sdk/dist/snap-ins';
import { EventType, AirdropEvent } from '../src/types';

export function createAirdropEvent(
  event_type: EventType,
  overrides?: object
): AirdropEvent {
  return {
    execution_metadata: {
      devrev_endpoint: 'devrev_endpoint',
    } as unknown as ExecutionMetadata,
    context: {
      secrets: {
        service_account_token: 'service_account_token',
      },
    } as unknown as Context,
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
      },
      event_type,
    },
    input_data: {
      global_values: {},
      event_sources: {},
    },
    ...overrides,
  };
}