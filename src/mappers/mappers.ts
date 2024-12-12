import axios, { AxiosResponse } from 'axios';

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
  private endpoint: string;
  private token: string;

  constructor({ event }: MappersFactoryInterface) {
    this.endpoint = event.execution_metadata.devrev_endpoint;
    this.token = event.context.secrets.service_account_token;
  }

  async getByTargetId(
    params: MappersGetByTargetIdParams
  ): Promise<AxiosResponse<MappersGetByTargetIdResponse>> {
    const { sync_unit, target } = params;
    return axios.get<MappersGetByTargetIdResponse>(
      `${this.endpoint}/internal/airdrop.sync-mapper-record.get-by-target`,
      {
        headers: {
          Authorization: this.token,
        },
        params: { sync_unit, target },
      }
    );
  }

  async create(
    params: MappersCreateParams
  ): Promise<AxiosResponse<MappersCreateResponse>> {
    return axios.post<MappersCreateResponse>(
      `${this.endpoint}/internal/airdrop.sync-mapper-record.create`,
      params,
      {
        headers: {
          Authorization: this.token,
        },
      }
    );
  }

  async update(
    params: MappersUpdateParams
  ): Promise<AxiosResponse<MappersUpdateResponse>> {
    return axios.post<MappersUpdateResponse>(
      `${this.endpoint}/internal/airdrop.sync-mapper-record.update`,
      params,
      {
        headers: {
          Authorization: this.token,
        },
      }
    );
  }
}
