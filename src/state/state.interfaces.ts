import { AirdropEvent } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * AdapterState is an interface that defines the structure of the adapter state that is used by the external extractor. It extends the connector state with additional fields: lastSyncStarted, lastSuccessfulSyncStarted, and attachmentsMetadata.
 */
export type AdapterState<ConnectorState> = ConnectorState & {
  lastSyncStarted?: string;
  lastSuccessfulSyncStarted?: string;
  toDevRev?: ToDevRev;
  fromDevRev?: FromDevRev;
};

export interface ToDevRev {
  attachmentsMetadata: {
    artifactIds: string[];
    lastProcessed: number;
  };
}

export interface FromDevRev {}

export interface StateInterface<ConnectorState> {
  event: AirdropEvent;
  initialState: ConnectorState;
  options?: WorkerAdapterOptions;
}
