import { axiosClient } from '../http/client';

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
} from './mappers.interfaces';

/** Manages sync mapper records that link external system items to DevRev items. */
export class Mappers {
  private devrevApiEndpoint: string;
  private devrevApiToken: string;

  constructor({ event }: MappersFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
  }

  async getByTargetId(
    params: MappersGetByTargetIdParams
  ): Promise<MappersGetByTargetIdResponse> {
    const { sync_unit, target } = params;
    const response = await axiosClient.get<MappersGetByTargetIdResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.get-by-target`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params: { sync_unit, target },
      }
    );
    return response.data;
  }

  async getByExternalId(
    params: MappersGetByExternalIdParams
  ): Promise<MappersGetByExternalIdResponse> {
    const { sync_unit, external_id, target_type } = params;
    const response = await axiosClient.get<MappersGetByExternalIdResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.get-by-external-id`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params: { sync_unit, external_id, target_type },
      }
    );
    return response.data;
  }

  /** Called after importing an item to DevRev to record the mapping for future syncs. */
  async create(params: MappersCreateParams): Promise<MappersCreateResponse> {
    const response = await axiosClient.post<MappersCreateResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.create`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
    return response.data;
  }

  async update(params: MappersUpdateParams): Promise<MappersUpdateResponse> {
    const response = await axiosClient.post<MappersUpdateResponse>(
      `${this.devrevApiEndpoint}/internal/airdrop.sync-mapper-record.update`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
    return response.data;
  }
}
