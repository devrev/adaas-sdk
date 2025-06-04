import { axiosClient } from '../http/axios-client';
import { AxiosResponse } from 'axios';

import {
  MappersFactoryInterface,
  MappersCreateParams,
  MappersCreateResponse,
  MappersGetByTargetIdParams,
  MappersGetByTargetIdResponse,
  MappersUpdateParams,
  MappersUpdateResponse,
} from './mappers.interface';

export class Mappers {
  private devrevApiEndpoint: string;
  private devrevApiToken: string;

  constructor({ event }: MappersFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
  }

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
