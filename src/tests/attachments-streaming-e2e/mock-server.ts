import express from 'express';
import type { Server } from 'http';

export class MockServer {
  public readonly port = 3001;
  public readonly callbackUrl = '/callback_url';
  public readonly workerDataUrl = '/worker_data_url';
  public readonly artifactsUrl = '/artifacts_url';
  public readonly app = express();
  private server: Server | null = null;

  constructor() {
    this.app.get(`${this.workerDataUrl}.get`, (_req, res) => {
      const stringifiedState = JSON.stringify({ test: 'test' });
      res.status(200).json({
        state: stringifiedState,
      });
    });
  }

  get baseUrl() {
    return `http://localhost:${this.port}`;
  }

  async start(): Promise<Server> {
    if (this.server) return this.server;
    await new Promise<void>((resolve) => {
      this.server = this.app.listen(this.port, () => resolve());
    });
    console.log(`Mock server running on port ${this.port}.`);
    return this.server!;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()));
    });
    console.log(`Mock server stopped on port ${this.port}.`);
    this.server = null;
  }
}
