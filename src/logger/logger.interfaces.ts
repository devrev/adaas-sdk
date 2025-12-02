import type { RawAxiosResponseHeaders } from 'axios';
import type { AirdropEvent, EventContext } from '../types/extraction';
import type { WorkerAdapterOptions } from '../types/workers';

export interface LoggerFactoryInterface {
  event: AirdropEvent;
  options?: WorkerAdapterOptions;
}

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface PrintableArray {
  type: 'array';
  length: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firstItem?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastItem?: any;
}

export interface PrintableState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any | PrintableArray | PrintableState;
}

export interface AxiosErrorResponse {
  config: {
    method: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any;
    url: string | undefined;
  };
  isAxiosError: boolean;
  isCorsOrNoNetworkError: boolean;
  response?: {
    data: unknown;
    headers: RawAxiosResponseHeaders;
    status: number;
    statusText: string;
  };
  code?: string;
  message?: string;
}

export interface LoggerTags extends EventContext {
  sdk_version: string;
  is_sdk_log: boolean;
}
