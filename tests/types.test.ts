import {
  ExternalSyncUnit,
  EventContextIn,
  ConnectionData,
  ErrorRecord,
  Artifact,
} from '../src/types';

describe('Airdrop event types', () => {
  describe('ExternalSyncUnit', () => {
    test('should have the required properties', () => {
      const externalSyncUnit: ExternalSyncUnit = {
        id: '123',
        name: 'test-unit-name',
        description: 'test-unit-description',
        item_count: 0,
      };

      expect(externalSyncUnit).toHaveProperty('id');
      expect(externalSyncUnit).toHaveProperty('name');
      expect(externalSyncUnit).toHaveProperty('description');
      expect(externalSyncUnit).toHaveProperty('item_count');
    });
  });

  describe('EventContextIn', () => {
    test('should have the required properties', () => {
      const eventContext: EventContextIn = {
        mode: 'INITIAL',
        callback_url: 'https://test.com',
        dev_org_id: 'DEV-123',
        dev_user_id: 'DEVU-123',
        external_system_id: '123',
        sync_run_id: '123',
        uuid: '123',
      };

      expect(eventContext).toHaveProperty('mode');
      expect(eventContext).toHaveProperty('callback_url');
      expect(eventContext).toHaveProperty('dev_org_id');
      expect(eventContext).toHaveProperty('dev_user_id');
      expect(eventContext).toHaveProperty('external_system_id');
      expect(eventContext).toHaveProperty('uuid');
    });
  });

  describe('ConnectionData', () => {
    test('should have the required properties', () => {
      const connectionData: ConnectionData = {
        org_id: '123',
        org_name: 'test-org-name',
        key: 'test-key',
        key_type: 'test-key-type',
      };

      expect(connectionData).toHaveProperty('org_id');
      expect(connectionData).toHaveProperty('org_name');
      expect(connectionData).toHaveProperty('key');
      expect(connectionData).toHaveProperty('key_type');
    });
  });

  describe('ErrorRecord', () => {
    test('should have the required properties', () => {
      const errorRecord: ErrorRecord = {
        message: 'test-message',
      };

      expect(errorRecord).toHaveProperty('message');
    });
  });

  describe('Artifact', () => {
    test('should have the required properties', () => {
      const artifact: Artifact = {
        item_count: 0,
        id: '123',
        item_type: 'test-item-type',
      };

      expect(artifact).toHaveProperty('item_type');
      expect(artifact).toHaveProperty('id');
      expect(artifact).toHaveProperty('item_count');
    });
  });
});