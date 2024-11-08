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
