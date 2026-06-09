import { AxiosResponse } from 'axios';
import { axiosClient } from '../http/axios-client-internal';
import {
  AirSyncEvent,
  EventData,
  ExtractorEvent,
  ExtractorEventType,
  LoaderEvent,
} from '../types/extraction';
import { LoaderEventType } from '../types/loading';
import { LIBRARY_VERSION } from './constants';

/**
 * Parameters for emitting a worker control message back to the platform.
 *
 * Used by {@link emit} to construct and post the outgoing extractor/loader event.
 */
export interface EmitInterface {
  /** The incoming AirSync event currently being processed; supplies the callback URL, event context, and auth secrets. */
  event: AirSyncEvent;
  /** The outgoing event type to report. In v2 this value is used directly (no event-type translation). */
  eventType: ExtractorEventType | LoaderEventType;
  /** Optional payload describing progress, results, or error details to attach to the event. */
  data?: EventData;
}

/**
 * Emits a worker control message to the parent/platform via the event callback URL.
 *
 * Used to report extraction/loading progress, completion, delays, or errors back to AirSync.
 * Wraps the given event type and data into an ExtractorEvent/LoaderEvent envelope (stamped with
 * the library version) and POSTs it to the callback URL with the service account authorization.
 *
 * @param event - The incoming AirSyncEvent providing callback URL, event context, and auth secrets.
 * @param eventType - The outgoing ExtractorEventType or LoaderEventType, used directly as the event_type.
 * @param data - Optional EventData payload to include in the emitted event.
 * @returns Promise resolving to the AxiosResponse of the callback POST request.
 */
export const emit = async ({
  event,
  eventType,
  data,
}: EmitInterface): Promise<AxiosResponse> => {
  const newEvent: ExtractorEvent | LoaderEvent = {
    event_type: eventType,
    event_context: event.payload.event_context,
    event_data: {
      ...data,
    },
    worker_metadata: {
      adaas_library_version: LIBRARY_VERSION,
    },
  };

  console.info('Emitting event', newEvent);

  return axiosClient.post(
    event.payload.event_context.callback_url,
    { ...newEvent },
    {
      headers: {
        Accept: 'application/json, text/plain, */*',
        Authorization: event.context.secrets.service_account_token,
        'Content-Type': 'application/json',
        'X-DevRev-Client-Platform': event.payload.event_context.snap_in_slug,
        'X-DevRev-Client-Id': event.payload.event_context.snap_in_version_id,
        'X-DevRev-Client-Version': LIBRARY_VERSION,
      },
    }
  );
};
