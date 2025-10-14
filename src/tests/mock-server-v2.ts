import express, { Express, Request, Response } from 'express';
import { Server } from 'http';

const DEFAULT_PORT = 3001;

export class MockServer {
  private app: Express;
  private server: Server | null = null;
  public readonly port: number;
  public readonly baseUrl: string;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.baseUrl = `http://localhost:${this.port}`;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.setupCallbackRoutes();
    this.setupWorkerDataRoutes();
    this.setupArtifactsRoutes();
  }

  private setupCallbackRoutes(): void {
    this.app.post('/callback_url', (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        received_at: new Date().toISOString(),
      });
    });
  }

  private setupWorkerDataRoutes(): void {
    this.app.post('/worker_data_url', (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
      });
    });
  }

  private setupArtifactsRoutes(): void {}

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock server running on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Mock server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }
}
