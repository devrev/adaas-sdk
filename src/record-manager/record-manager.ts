import { AxiosResponse } from 'axios';

import { axiosClient } from '../http/axios-client-internal';

import {
  RecordManagerDevRevLoaderSeenGetParams,
  RecordManagerDevRevLoaderSeenGetResponse,
  RecordManagerDevRevLoaderSeenSetParams,
  RecordManagerDevRevLoaderSeenSetResponse,
  RecordManagerExternalExtractorSeenSetParams,
  RecordManagerExternalExtractorSeenSetResponse,
  RecordManagerExternalLoaderSeenGetParams,
  RecordManagerExternalLoaderSeenGetResponse,
  RecordManagerExternalLoaderSeenSetParams,
  RecordManagerExternalLoaderSeenSetResponse,
  RecordManagerFactoryInterface,
} from './record-manager.interfaces';

/**
 * Endpoint paths are placeholders following the platform's established
 * `airdrop.<resource>.<verb>` convention (see Mappers). The record-manager
 * RPCs (RecordDevRevLoaderSeenGet/Set, RecordExternalLoaderSeenGet/Set,
 * RecordExternalExtractorSeenSet) are defined in
 * devrev/airdrop-record-manager `api/record_field_merging.proto` but are not
 * yet wired into the gateway's REST layer (ASFND-186/ASFND-187) - rename in
 * one place once the gateway binding lands.
 */
const RECORD_MANAGER_ENDPOINTS = {
  DEVREV_LOADER_SEEN_GET: 'airdrop.record-devrev-loader-seen.get',
  DEVREV_LOADER_SEEN_SET: 'airdrop.record-devrev-loader-seen.set',
  EXTERNAL_LOADER_SEEN_GET: 'airdrop.record-external-loader-seen.get',
  EXTERNAL_LOADER_SEEN_SET: 'airdrop.record-external-loader-seen.set',
  EXTERNAL_EXTRACTOR_SEEN_SET: 'airdrop.record-external-extractor-seen.set',
} as const;

/**
 * Manages the field-level-merge snapshot records (RecordDevRevLoaderSeen,
 * RecordExternalLoaderSeen, RecordExternalLoaderAttempted,
 * RecordExternalExtractorSeen) that the record-manager stores per synced
 * object, so the SDK can compute field-level diffs across syncs.
 */
export class RecordManager {
  private devrevApiEndpoint: string;
  private devrevApiToken: string;

  constructor({ event }: RecordManagerFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
  }

  /**
   * Reads the stored DevRev-loader-seen object and returns the fields that
   * differ from the supplied devrev_object. If devrev_object is omitted,
   * returns the whole saved object.
   */
  async getDevRevLoaderSeen(
    params: RecordManagerDevRevLoaderSeenGetParams
  ): Promise<AxiosResponse<RecordManagerDevRevLoaderSeenGetResponse>> {
    return axiosClient.get<RecordManagerDevRevLoaderSeenGetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.DEVREV_LOADER_SEEN_GET}`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params,
      }
    );
  }

  /**
   * Overrides the stored DevRev-loader-seen object.
   */
  async putDevRevLoaderSeen(
    params: RecordManagerDevRevLoaderSeenSetParams
  ): Promise<AxiosResponse<RecordManagerDevRevLoaderSeenSetResponse>> {
    return axiosClient.post<RecordManagerDevRevLoaderSeenSetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.DEVREV_LOADER_SEEN_SET}`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }

  /**
   * Reads the stored external-loader-seen object and returns the fields
   * that differ from the supplied external_object. If external_object is
   * omitted, returns the whole saved object.
   */
  async getExternalLoaderSeen(
    params: RecordManagerExternalLoaderSeenGetParams
  ): Promise<AxiosResponse<RecordManagerExternalLoaderSeenGetResponse>> {
    return axiosClient.get<RecordManagerExternalLoaderSeenGetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.EXTERNAL_LOADER_SEEN_GET}`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params,
      }
    );
  }

  /**
   * Overrides the stored external-loader-seen object and the
   * external-loader-attempted object in a single platform-side transaction.
   */
  async putExternalLoaderSeen(
    params: RecordManagerExternalLoaderSeenSetParams
  ): Promise<AxiosResponse<RecordManagerExternalLoaderSeenSetResponse>> {
    return axiosClient.post<RecordManagerExternalLoaderSeenSetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.EXTERNAL_LOADER_SEEN_SET}`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }

  /**
   * Overrides the stored external-extractor-seen object and returns the
   * diff of the supplied external_object against the stored
   * RecordExternalExtractorSeen and RecordExternalLoaderAttempted objects
   * (Diff = external_object - ExternalExtractorSeen - ExternalLoaderAttempted).
   */
  async putExternalExtractorSeen(
    params: RecordManagerExternalExtractorSeenSetParams
  ): Promise<AxiosResponse<RecordManagerExternalExtractorSeenSetResponse>> {
    return axiosClient.post<RecordManagerExternalExtractorSeenSetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.EXTERNAL_EXTRACTOR_SEEN_SET}`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }
}
