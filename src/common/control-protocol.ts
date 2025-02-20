import { AxiosResponse } from 'axios';
import { axiosClient } from '../http/axios-client';
import {
  AirdropEvent,
  EventData,
  ExtractorEvent,
  ExtractorEventType,
  LoaderEvent,
} from '../types/extraction';
import { LoaderEventType } from '../types/loading';

export interface EmitInterface {
  event: AirdropEvent;
  eventType: ExtractorEventType | LoaderEventType;
  data?: EventData;
}

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
  };

  console.info('Emitting event', JSON.stringify(newEvent));

  return axiosClient.post(
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
};
