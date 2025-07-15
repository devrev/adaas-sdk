import * as http from 'http';
import * as url from 'url';

export class MockServer {
  private server: http.Server | null = null;
  private port: number;
  private consoleLogs: string[] = [];
  private requests: Array<{ method: string; url: string; body?: any }> = [];

  constructor(port?: number) {
    this.port = port || 3001; // Default to standard test port
  }

  private getDefaultWorkerState() {
    return {
      lastSyncStarted: '',
      lastSuccessfulSyncStarted: '',
      snapInVersionId: 'test-snap-in-version-id',
      toDevRev: {
        attachmentsMetadata: {
          artifactIds: [],
          lastProcessed: 0,
          lastProcessedAttachmentsIdsList: [],
        },
      },
    };
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    // Track this request
    const requestInfo: { method: string; url: string; body?: any } = {
      method,
      url: req.url || '',
    };

    // For POST requests, capture the body
    if (method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk.toString()));
      req.on('end', () => {
        try {
          requestInfo.body = JSON.parse(body);
        } catch {
          requestInfo.body = body;
        }
        this.requests.push(requestInfo);
      });
    } else {
      this.requests.push(requestInfo);
    }

    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    res.setHeader('Content-Type', 'application/json');
    switch (method) {
      case 'OPTIONS':
        // Handle preflight CORS requests
        res.writeHead(200);
        res.end();
        break;

      case 'GET':
        switch (true) {
          case pathname.includes('airdrop.external-worker'):
            // Worker state GET endpoint
            res.writeHead(200);
            res.end(
              JSON.stringify({
                state: JSON.stringify(this.getDefaultWorkerState()),
              })
            );
            break;

          case pathname.includes('snap-ins.get'):
            // Snap-ins endpoint for install-initial-domain-mapping
            res.writeHead(200);
            res.end(
              JSON.stringify({
                snap_in: {
                  imports: [{ name: 'test_import_slug' }],
                  snap_in_version: { slug: 'test_snap_in_slug' },
                },
              })
            );
            break;

          case pathname.includes('/upload') || pathname.includes('/download'):
            // Generic file download endpoints for artifacts
            res.writeHead(200);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.end(Buffer.from('mock file content'));
            break;

          default:
            // Unknown GET endpoint
            res.writeHead(404);
            res.end(
              JSON.stringify({
                error: 'GET endpoint not found',
                code: 'ENDPOINT_NOT_FOUND',
              })
            );
        }
        break;

      case 'POST':
        switch (true) {
          case pathname.includes('airdrop.external-worker'):
            // Worker state POST/UPDATE endpoint
            res.writeHead(200);
            res.end(
              JSON.stringify({
                success: true,
                updated_at: new Date().toISOString(),
              })
            );
            break;

          case pathname.includes('airdrop.external-extractor.message'):
            // Callback endpoint for event emissions
            res.writeHead(200);
            res.end(
              JSON.stringify({
                success: true,
                received_at: new Date().toISOString(),
              })
            );
            break;

          case pathname.includes('recipe.blueprints.create'):
            // Recipe blueprint creation endpoint
            res.writeHead(200);
            res.end(
              JSON.stringify({
                recipe_blueprint: { id: 'test_recipe_blueprint_id' },
              })
            );
            break;

          case pathname.includes('initial-domain-mappings.install'):
            // Domain mappings installation endpoint
            res.writeHead(200);
            res.end(
              JSON.stringify({
                success: true,
                message: 'Initial domain mappings installed successfully',
              })
            );
            break;

          case pathname.includes('artifacts.prepare'):
            // Artifacts prepare endpoint for uploader
            res.writeHead(200);
            res.end(
              JSON.stringify({
                id: `test_artifact_${Date.now()}`,
                url: `${this.getBaseUrl()}/upload`,
                form_data: [
                  { key: 'key', value: 'test-key' },
                  { key: 'x-amz-algorithm', value: 'AWS4-HMAC-SHA256' },
                  { key: 'x-amz-credential', value: 'test-credential' },
                  { key: 'x-amz-date', value: new Date().toISOString() },
                  { key: 'policy', value: 'test-policy' },
                  { key: 'x-amz-signature', value: 'test-signature' },
                ],
              })
            );
            break;

          case pathname.includes('artifacts.locate'):
            // Artifacts locate endpoint for uploader
            res.writeHead(200);
            res.end(
              JSON.stringify({
                url: `${this.getBaseUrl()}/download/artifact.jsonl.gz`,
              })
            );
            break;

          case pathname.includes('/upload'):
            // File upload endpoint for artifacts
            res.writeHead(200);
            res.end(
              JSON.stringify({
                success: true,
                message: 'File uploaded successfully',
                ETag: '"test-etag-12345"',
              })
            );
            break;

          default:
            // Unknown POST endpoint
            res.writeHead(404);
            res.end(
              JSON.stringify({
                error: 'POST endpoint not found',
                code: 'ENDPOINT_NOT_FOUND',
              })
            );
        }
        break;

      case 'PUT':
        switch (true) {
          case pathname.includes('/upload'):
            // PUT file upload endpoint for artifacts (alternative upload method)
            res.writeHead(200);
            res.end(
              JSON.stringify({
                success: true,
                message: 'File uploaded successfully via PUT',
                ETag: '"test-etag-put-12345"',
              })
            );
            break;

          default:
            // Unknown PUT endpoint
            res.writeHead(404);
            res.end(
              JSON.stringify({
                error: 'PUT endpoint not found',
                code: 'ENDPOINT_NOT_FOUND',
              })
            );
        }
        break;

      default:
        // Unsupported HTTP method
        res.writeHead(405);
        res.end(
          JSON.stringify({
            error: `Method ${method} not allowed`,
            code: 'METHOD_NOT_ALLOWED',
          })
        );
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        console.log(`Mock server running on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  getPort(): number {
    return this.port;
  }

  getConsoleLogs(): string[] {
    return [...this.consoleLogs];
  }

  getRequests() {
    return [...this.requests];
  }

  clearRequests() {
    this.requests = [];
  }
}
