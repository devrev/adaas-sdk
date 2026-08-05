import { AxiosResponse } from 'axios';

import { axiosClient } from '../http/axios-client-internal';

import {
  RecordManagerDevRevLoaderSeenGetParams,
  RecordManagerDevRevLoaderSeenGetResponse,
  RecordManagerDevRevLoaderSeenSetParams,
  RecordManagerDevRevLoaderSeenSetResponse,
  RecordManagerExtractorRecordMergingSetParams,
  RecordManagerExtractorRecordMergingSetResponse,
  RecordManagerFactoryInterface,
  RecordManagerLoaderRecordMergingGetParams,
  RecordManagerLoaderRecordMergingGetResponse,
  RecordManagerLoaderRecordMergingSetParams,
  RecordManagerLoaderRecordMergingSetResponse,
} from './record-manager.interfaces';

/**
 * Endpoint paths are placeholders following the platform's established
 * `airdrop.<resource>.<verb>` convention (see Mappers). The three
 * snapin-manager proxy RPCs (ExtractorRecordMergingSet,
 * LoaderRecordMergingSet, LoaderRecordMergingGet - devrev/airdrop-snapin-manager
 * PR #434, ASFND-298, OPEN) are RPC_TYPE_INTERNAL and not yet bound into the
 * gateway's REST layer (devrev/gateway apiv2/airdrop_snapin_manager.proto has
 * no record-merging entries) - rename in one place once the gateway binding
 * lands. DEVREV_LOADER_SEEN_* has no proxy RPC at all yet (see class doc).
 */
const RECORD_MANAGER_ENDPOINTS = {
  EXTRACTOR_RECORD_MERGING_SET: 'airdrop.extractor-record-merging.set',
  LOADER_RECORD_MERGING_SET: 'airdrop.loader-record-merging.set',
  LOADER_RECORD_MERGING_GET: 'airdrop.loader-record-merging.get',
  DEVREV_LOADER_SEEN_GET: 'airdrop.devrev-loader-record-merging.get',
  DEVREV_LOADER_SEEN_SET: 'airdrop.devrev-loader-record-merging.set',
} as const;

/**
 * Proxies snap-in calls to the Airdrop Record Manager's field-level-merge
 * snapshot endpoints (RecordExternalExtractorSeen, RecordExternalLoaderSeen +
 * RecordExternalLoaderAttempted), so the SDK can act on the per-field diffs
 * the record-manager computes across syncs. The record-manager - not this
 * class - computes every diff; the SDK only sends normalized objects (and,
 * for the loader, the DevRev changes it applied) and consumes the returned
 * `external_object_diff`.
 *
 * `request_id` and `dev_org_id`, required by every proxy RPC, are derived
 * from the event context rather than passed in by callers.
 * `external_system_specifier` is intentionally not part of any request here:
 * the snapin-manager proxy resolves it server-side from SyncContext, so
 * sending it would be ignored.
 *
 * PLATFORM CHECK REQUIRED: the DevRev-loader-seen pair
 * (getDevRevLoaderSeen/putDevRevLoaderSeen) has no snapin-manager proxy RPC
 * yet - only the underlying record-manager RPCs
 * (RecordDevRevLoaderSeenGet/Set) exist on devrev/airdrop-record-manager
 * main. These two methods are unreachable until that proxy ships; they exist
 * so the E2DR DevRev-primary merge path (ENH-7536 proposal §5.4) has a
 * client ready the moment it does.
 */
export class RecordManager {
  private devrevApiEndpoint: string;
  private devrevApiToken: string;
  private requestId: string;
  private devOrgId: string;

  constructor({ event }: RecordManagerFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
    this.requestId = event.payload.event_context.request_id;
    this.devOrgId = event.payload.event_context.dev_oid;
  }

  private baseParams(): { request_id: string; dev_org_id: string } {
    return { request_id: this.requestId, dev_org_id: this.devOrgId };
  }

  /**
   * Overrides the stored external-extractor-seen object and returns the
   * diff of the supplied external_object against the stored
   * RecordExternalExtractorSeen and RecordExternalLoaderAttempted objects.
   */
  async extractorRecordMergingSet(
    params: RecordManagerExtractorRecordMergingSetParams
  ): Promise<AxiosResponse<RecordManagerExtractorRecordMergingSetResponse>> {
    return axiosClient.post<RecordManagerExtractorRecordMergingSetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.EXTRACTOR_RECORD_MERGING_SET}`,
      { ...this.baseParams(), ...params },
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }

  /**
   * Overrides the stored external-loader-seen object and the
   * external-loader-attempted object (devrev_changes) in a single
   * platform-side transaction.
   */
  async loaderRecordMergingSet(
    params: RecordManagerLoaderRecordMergingSetParams
  ): Promise<AxiosResponse<RecordManagerLoaderRecordMergingSetResponse>> {
    return axiosClient.post<RecordManagerLoaderRecordMergingSetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.LOADER_RECORD_MERGING_SET}`,
      { ...this.baseParams(), ...params },
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
  async loaderRecordMergingGet(
    params: RecordManagerLoaderRecordMergingGetParams
  ): Promise<AxiosResponse<RecordManagerLoaderRecordMergingGetResponse>> {
    return axiosClient.get<RecordManagerLoaderRecordMergingGetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.LOADER_RECORD_MERGING_GET}`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params: { ...this.baseParams(), ...params },
      }
    );
  }

  /**
   * Reads the stored DevRev-loader-seen object and returns the fields that
   * differ from the supplied devrev_object. Unreachable until a
   * snapin-manager proxy fronts RecordDevRevLoaderSeenGet - see class doc.
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
        params: { ...this.baseParams(), ...params },
      }
    );
  }

  /**
   * Overrides the stored DevRev-loader-seen object. Unreachable until a
   * snapin-manager proxy fronts RecordDevRevLoaderSeenSet - see class doc.
   */
  async putDevRevLoaderSeen(
    params: RecordManagerDevRevLoaderSeenSetParams
  ): Promise<AxiosResponse<RecordManagerDevRevLoaderSeenSetResponse>> {
    return axiosClient.post<RecordManagerDevRevLoaderSeenSetResponse>(
      `${this.devrevApiEndpoint}/internal/${RECORD_MANAGER_ENDPOINTS.DEVREV_LOADER_SEEN_SET}`,
      { ...this.baseParams(), ...params },
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }
}
