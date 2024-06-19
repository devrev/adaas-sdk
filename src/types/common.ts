export enum ErrorLevel {
  Warning = 'WARNING',
  Error = 'ERROR',
  Info = 'INFO',
}

export interface ErrorRecord {
  message: string;
}

export interface LogRecord {
  level: ErrorLevel;
  message: string;
}

export interface Artifact {
  id: string;
  item_type: string;
  item_count: number;
}

export interface ArtifactsPrepareResponse {
  url: string;
  id: string;
  form_data: {
    key: string;
    value: string;
  }[];
}

export interface AdapterUpdateParams {
  artifact?: Artifact;
  extractor_state?: object;
}

export interface UploadResponse {
  artifact?: Artifact;
  error?: ErrorRecord;
}
