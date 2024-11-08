import axios from 'axios';

import {
  AirdropEvent,
  EventData,
  ExtractorEvent,
  ExtractorEventType,
} from '../types/extraction';
import { formatAxiosError } from '../logger/logger';

export interface EmitInterface {
  event: AirdropEvent;
  eventType: ExtractorEventType;
  data?: EventData;
}

export const emit = async ({
  event,
  eventType,
  data,
}: EmitInterface): Promise<void | Error> => {
  const newEvent: ExtractorEvent = {
    event_type: eventType,
    event_context: {
      uuid: event.payload.event_context.uuid,
      sync_run: event.payload.event_context.sync_run_id,
      ...(event.payload.event_context.sync_unit_id && {
        sync_unit: event.payload.event_context.sync_unit_id,
      }),
    },
    event_data: {
      ...data,
    },
  };

  return new Promise<void>(async (resolve, reject) => {
    console.info('Emitting event', newEvent);

    try {
      await axios.post(
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
          formatAxiosError(error)
        );
      } else {
        // TODO: Stop it through UI or think about retrying this request. Implement exponential retry mechanism.
        console.error(
          `Failed to emit event with event type ${eventType}.`,
          error
        );
      }
      reject(error);
    }
  });
};
