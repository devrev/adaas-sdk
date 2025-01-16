import { axios, axiosClient } from '../http/axios-client';
import {
  AirdropEvent,
  EventData,
  ExtractorEvent,
  ExtractorEventType,
  LoaderEvent,
} from '../types/extraction';
import { LoaderEventType } from '../types/loading';
import { serializeAxiosError } from '../logger/logger';

export interface EmitInterface {
  event: AirdropEvent;
  eventType: ExtractorEventType | LoaderEventType;
  data?: EventData;
}

export const emit = async ({
  event,
  eventType,
  data,
}: EmitInterface): Promise<void | Error> => {
  const newEvent: ExtractorEvent | LoaderEvent = {
    event_type: eventType,
    event_context: event.payload.event_context,
    event_data: {
      ...data,
    },
  };

  return new Promise<void>(async (resolve, reject) => {
    console.info('Emitting event', JSON.stringify(newEvent));

    try {
      await axiosClient.post(
        event.payload.event_context.callback_url,
        { ...newEvent },
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            Authorization: event.context.secrets.service_account_token,
            'Content-Type': 'application/json',
          },
        }
      );

      resolve();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `Failed to emit event with event type ${eventType}.`,
          serializeAxiosError(error)
        );
      } else {
        // TODO: Stop it through UI or think about retrying this request. Implement exponential retry mechanism.
        console.error(
          `Failed to emit event with event type ${eventType}.`,
          error
        );
      }
      reject();
    }
  });
};
