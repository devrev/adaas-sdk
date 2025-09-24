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
    // GET methods
    this.app.get(`${this.workerDataUrl}.get`, (_req, res) => {
      const stringifiedState = JSON.stringify({ test_key: 'test_value' });
      res.status(200).json({
        state: stringifiedState,
      });
    });

    this.app.get('/internal/snap-ins.get', (_req, res) => {
      res.status(200).json({
        snap_in: {
          imports: [
            {
              name: 'test-imports-slug',
            },
          ],
          snap_in_version: {
            slug: 'test-snap-in-slug',
          },
        },
      });
    });

    // POST methods
    this.app.post(
      '/internal/airdrop.recipe.initial-domain-mappings.install',
      (_req, res) => {
        res.status(200).json({
          success: true,
        });
      }
    );

    this.app.post(`${this.workerDataUrl}.update`, (_req, res) => {
      res.status(200).json({
        success: true,
      });
    });

    this.app.post(`${this.callbackUrl}`, (_req, res) => {
      res.status(200).json({
        success: true,
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
