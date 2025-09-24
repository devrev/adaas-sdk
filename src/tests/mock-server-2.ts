import express, { Request, Response } from 'express';
import type { Server } from 'http';

import { extractionSdkState } from '../state/state.interfaces';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface MockOverride {
  path: string;
  method: HttpMethod;
  // Optional query parameters to match
  queryParams?: Record<string, any>;
  // Response to return
  response: {
    status?: number;

    // TODO: Repalce body with data?
    body?: any;
  };
  // Optional custom handler for more complex logic
  handler?: (req: Request, res: Response) => void;
}

interface MockServerOptions {
  overrides?: MockOverride[];
}

export class MockServer {
  public readonly port = 3001;
  public readonly callbackUrl = '/callback_url';
  public readonly workerDataUrl = '/worker_data_url';
  public readonly artifactsUrl = '/artifacts_url';
  public readonly app = express();
  private server: Server | null = null;
  private overrides: Map<string, MockOverride> = new Map();

  constructor(options: MockServerOptions = {}) {
    // Process overrides
    if (options.overrides) {
      options.overrides.forEach((override) => {
        const key = this.createOverrideKey(
          override.method,
          override.path,
          override.queryParams
        );
        this.overrides.set(key, override);
      });
    }

    // Middleware to parse JSON bodies
    this.app.use(express.json());

    // Register all routes
    this.registerRoutes();
  }

  private createOverrideKey(
    method: HttpMethod,
    path: string,
    queryParams?: Record<string, any>
  ): string {
    let key = `${method}:${path}`;
    if (queryParams) {
      const sortedParams = Object.keys(queryParams)
        .sort()
        .map((k) => `${k}=${queryParams[k]}`)
        .join('&');
      key += `?${sortedParams}`;
    }
    return key;
  }

  private findOverride(
    method: HttpMethod,
    path: string,
    queryParams: any
  ): MockOverride | undefined {
    // Try exact match with query params
    const keyWithQuery = this.createOverrideKey(method, path, queryParams);
    if (this.overrides.has(keyWithQuery)) {
      return this.overrides.get(keyWithQuery);
    }

    // Try match without query params
    const keyWithoutQuery = this.createOverrideKey(method, path);
    return this.overrides.get(keyWithoutQuery);
  }

  private handleRequest(
    method: HttpMethod,
    path: string,
    defaultHandler: (req: Request, res: Response) => void
  ) {
    return (req: Request, res: Response) => {
      const override = this.findOverride(method, path, req.query);

      if (override) {
        if (override.handler) {
          override.handler(req, res);
        } else {
          const status = override.response.status || 200;
          res.status(status).json(override.response.body);
        }
      } else {
        defaultHandler(req, res);
      }
    };
  }

  private registerRoutes() {
    // GET methods
    this.app.get(
      `${this.workerDataUrl}.get`,
      this.handleRequest('GET', `${this.workerDataUrl}.get`, (_req, res) => {
        const stringifiedState = JSON.stringify(extractionSdkState);
        res.status(200).json({
          state: stringifiedState,
        });
      })
    );

    this.app.get(
      '/internal/snap-ins.get',
      this.handleRequest('GET', '/internal/snap-ins.get', (_req, res) => {
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
      })
    );

    // POST methods
    this.app.post(
      '/internal/airdrop.recipe.initial-domain-mappings.install',
      this.handleRequest(
        'POST',
        '/internal/airdrop.recipe.initial-domain-mappings.install',
        (_req, res) => {
          res.status(200).json({
            success: true,
          });
        }
      )
    );

    this.app.post(
      `${this.workerDataUrl}.update`,
      this.handleRequest(
        'POST',
        `${this.workerDataUrl}.update`,
        (_req, res) => {
          res.status(200).json({
            success: true,
          });
        }
      )
    );

    this.app.post(
      `${this.callbackUrl}`,
      this.handleRequest('POST', `${this.callbackUrl}`, (_req, res) => {
        res.status(200).json({
          success: true,
        });
      })
    );
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
