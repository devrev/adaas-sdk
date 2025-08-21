export interface OOMScenario {
  name: string;
  description: string;
  memoryTarget: number; // Target memory usage in bytes
  iterations?: number;
  iterationDelay?: number; // Delay between iterations in ms
  timeoutMs?: number;
}

export interface OOMTestResult {
  scenario: string;
  completed: boolean;
  error?: Error;
  peakMemoryUsage: number;
  duration: number;
  iterations?: number;
  chunks?: number;
  objectsCreated?: number;
  uploads?: any[];
  operationResults?: any[];
  workersCreated?: number;
  memorySnapshots: MemorySnapshot[];
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface LocalStackConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface WorkerScenarioData {
  id: number;
  scenario: string;
  memoryTarget: number;
}

