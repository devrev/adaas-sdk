import { AxiosResponse } from 'axios';

import { axiosClient } from '../http/axios-client-internal';

import {
  MappersCreateParams,
  MappersCreateResponse,
  MappersFactoryInterface,
  MappersGetByExternalIdParams,
  MappersGetByExternalIdResponse,
  MappersGetByTargetIdParams,
  MappersGetByTargetIdResponse,
  MappersUpdateParams,
  MappersUpdateResponse,
} from './mappers.interface';

/**
 * Manages sync mapper records that link external system items to DevRev items.
 *
 * Used for tracking relationships between external and DevRev entities during sync operations.
 */
export class Mappers {
  private devrevApiEndpoint: string;
  private devrevApiToken: string;

  constructor({ event }: MappersFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
  }

  /**
   * Retrieves a sync mapper record by DevRev ID.
   *
   * Used to find the mapping when you know the DevRev ID and want to find the external system ID.
   *
   * @param params - Query parameters of type MappersGetByTargetIdParams
   * @returns Promise with response data containing the sync mapper record
   */
  async getByTargetId(
    params: MappersGetByTargetIdParams
  ): Promise<AxiosResponse<MappersGetByTargetIdResponse>> {
    const { sync_unit, target } = params;
    return axiosClient.get<MappersGetByTargetIdResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.get-by-target`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params: { sync_unit, target },
      }
    );
  }

  /**
   * Retrieves a sync mapper record by external system ID.
   *
   * Used to find the mapping when you know the external system ID and want to find the DevRev ID.
   *
   * @param params - Query parameters of type MappersGetByExternalIdParams
   * @returns Promise with response data containing the sync mapper record
   */
  async getByExternalId(
    params: MappersGetByExternalIdParams
  ): Promise<AxiosResponse<MappersGetByExternalIdResponse>> {
    const { sync_unit, external_id, target_type } = params;
    return axiosClient.get<MappersGetByExternalIdResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.get-by-external-id`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params: { sync_unit, external_id, target_type },
      }
    );
  }

  /**
   * Creates a new sync mapper record to establish a relationship between external system
   * entities and DevRev entities.
   *
   * This is called after importing an item from external system to DevRev to record
   * the mapping for future synchronization operations.
   *
   * @param params - Creation parameters of type MappersCreateParams
   * @returns Promise with response data containing the created sync mapper record
   */
  async create(
    params: MappersCreateParams
  ): Promise<AxiosResponse<MappersCreateResponse>> {
    return axiosClient.post<MappersCreateResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.create`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }

  /**
   * Updates an existing sync mapper record.
   *
   * Used to modify existing mappings when external system entities change or when
   * additional DevRev entities need to be associated.
   *
   * @param params - Update parameters of type MappersUpdateParams
   * @returns Promise with response data containing the updated sync mapper record
   */
  async update(
    params: MappersUpdateParams
  ): Promise<AxiosResponse<MappersUpdateResponse>> {
    return axiosClient.post<MappersUpdateResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.update`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }
}
