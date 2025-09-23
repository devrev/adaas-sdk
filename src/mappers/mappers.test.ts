import { axiosClient } from '../http/axios-client-internal';
import { Mappers } from './mappers';
import {
  SyncMapperRecordStatus,
  SyncMapperRecordTargetType,
  MappersGetByTargetIdParams,
  MappersGetByExternalIdParams,
  MappersCreateParams,
  MappersUpdateParams,
} from './mappers.interface';
import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types/extraction';

// Mock the axios client
jest.mock('../http/axios-client-internal');
const mockAxiosClient = axiosClient as jest.Mocked<typeof axiosClient>;

describe(Mappers.name, () => {
  const apiEndpoint = 'test_devrev_endpoint';
  const apiToken = 'test_service_token';
  const syncUnit = 'test_sync_unit';
  const targetId = 'test_target_id';
  const externalId = 'test_external_id';
  const id = 'test_id';
  const externalIds = ['test_external_id'];
  const targets = ['test_target_id'];

  const mockEvent = createEvent({
    eventType: EventType.ExtractionDataStart,
    executionMetadataOverrides: { devrev_endpoint: apiEndpoint },
    contextOverrides: {
      secrets: { service_account_token: apiToken },
    },
  });

  const mappers = new Mappers({ event: mockEvent });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should call ${mappers.getByTargetId.name} with correct endpoint, headers and params`, async () => {
    // Arrange
    const params: MappersGetByTargetIdParams = {
      sync_unit: syncUnit,
      target: targetId,
    };
    mockAxiosClient.get.mockResolvedValue({ data: {} });

    // Act
    await mappers.getByTargetId(params);

    // Assert
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${apiEndpoint}/internal/airdrop.sync-mapper-record.get-by-target`,
      {
        headers: {
          Authorization: apiToken,
        },
        params: { sync_unit: syncUnit, target: targetId },
      }
    );
  });

  it(`should call ${mappers.getByExternalId.name} with correct endpoint, headers and params`, async () => {
    // Arrange
    const params: MappersGetByExternalIdParams = {
      sync_unit: syncUnit,
      external_id: externalId,
      target_type: SyncMapperRecordTargetType.USER,
    };
    mockAxiosClient.get.mockResolvedValue({ data: {} });

    // Act
    await mappers.getByExternalId(params);

    // Assert
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${apiEndpoint}/internal/airdrop.sync-mapper-record.get-by-external-id`,
      {
        headers: {
          Authorization: apiToken,
        },
        params: {
          sync_unit: syncUnit,
          external_id: externalId,
          target_type: SyncMapperRecordTargetType.USER,
        },
      }
    );
  });

  it(`should call ${mappers.create.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: MappersCreateParams = {
      sync_unit: syncUnit,
      external_ids: externalIds,
      targets: targets,
      status: SyncMapperRecordStatus.OPERATIONAL,
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await mappers.create(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${apiEndpoint}/internal/airdrop.sync-mapper-record.create`,
      params,
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });

  it(`should call ${mappers.update.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: MappersUpdateParams = {
      id: id,
      sync_unit: syncUnit,
      external_ids: { add: externalIds },
      targets: { add: targets },
      status: SyncMapperRecordStatus.OPERATIONAL,
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await mappers.update(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${apiEndpoint}/internal/airdrop.sync-mapper-record.update`,
      params,
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });
});
