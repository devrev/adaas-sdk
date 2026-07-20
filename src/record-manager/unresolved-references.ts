import { AxiosResponse } from 'axios';

import { axiosClient } from '../http/axios-client-internal';

import {
  UnresolvedReferencesFactoryInterface,
  UnresolvedReferencesListParams,
  UnresolvedReferencesListResponse,
  UnresolvedReferencesResolveParams,
  UnresolvedReferencesResolveResponse,
  UnresolvedReferencesSetParams,
  UnresolvedReferencesSetResponse,
} from './unresolved-references.interfaces';

/**
 * Endpoint paths are placeholders following the platform's established
 * `airdrop.<resource>.<verb>` convention (see Mappers, RecordManager). The
 * UnresolvedReferences RPCs (Set, List, Resolve) are defined in
 * devrev/airdrop-record-manager `api/unresolved_references.proto` and, unlike
 * the record-field-merging RPCs, are fully implemented (real MongoDB-backed
 * persistence, not stubs) - but they are RPC_TYPE_INTERNAL and not yet bound
 * into the gateway's REST layer, so exact REST paths are still guessed.
 * Rename in one place once the gateway binding lands.
 */
const UNRESOLVED_REFERENCES_ENDPOINTS = {
  SET: 'airdrop.unresolved-references.set',
  LIST: 'airdrop.unresolved-references.list',
  RESOLVE: 'airdrop.unresolved-references.resolve',
} as const;

/**
 * Manages unresolved references: field values in an object that point to
 * an external ID with no mapper record yet, so the SDK can record them
 * during loading and later prune the ones that have since resolved.
 *
 * PLATFORM CHECK REQUIRED: no existing SDK worker calls this client yet.
 * The natural call sites are the DevRev-Loader (call `set` when a field
 * reference doesn't resolve to a mapper record while creating/updating an
 * object) and a periodic reconciliation pass (call `list` then `resolve`
 * once referenced objects have since been mapped), but neither has a
 * concrete SDK hook point today - `WorkerAdapter.loadItem` only covers the
 * External-Loader (DR2E) direction, not DevRev-Loader (E2DR), and there is
 * no existing "reconcile unresolved references" entry point to attach a
 * `list`+`resolve` call to. Wiring this in is future work once the platform
 * or a connector author defines that call site.
 */
export class UnresolvedReferences {
  private devrevApiEndpoint: string;
  private devrevApiToken: string;

  constructor({ event }: UnresolvedReferencesFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
  }

  /**
   * Records the current set of unresolved references for one source
   * object. Occurrences from a prior call that are no longer present in
   * unresolved_references are removed.
   */
  async set(
    params: UnresolvedReferencesSetParams
  ): Promise<AxiosResponse<UnresolvedReferencesSetResponse>> {
    return axiosClient.post<UnresolvedReferencesSetResponse>(
      `${this.devrevApiEndpoint}/internal/${UNRESOLVED_REFERENCES_ENDPOINTS.SET}`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }

  /**
   * Lists resolvable unresolved references (references whose target now
   * has a usable mapper record), optionally filtered by object_devrev_type.
   */
  async list(
    params: UnresolvedReferencesListParams
  ): Promise<AxiosResponse<UnresolvedReferencesListResponse>> {
    return axiosClient.get<UnresolvedReferencesListResponse>(
      `${this.devrevApiEndpoint}/internal/${UNRESOLVED_REFERENCES_ENDPOINTS.LIST}`,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
        params,
      }
    );
  }

  /**
   * Removes the given occurrences from the unresolved-references list for
   * one source object, since the caller has since resolved them.
   */
  async resolve(
    params: UnresolvedReferencesResolveParams
  ): Promise<AxiosResponse<UnresolvedReferencesResolveResponse>> {
    return axiosClient.post<UnresolvedReferencesResolveResponse>(
      `${this.devrevApiEndpoint}/internal/${UNRESOLVED_REFERENCES_ENDPOINTS.RESOLVE}`,
      params,
      {
        headers: {
          Authorization: this.devrevApiToken,
        },
      }
    );
  }
}
