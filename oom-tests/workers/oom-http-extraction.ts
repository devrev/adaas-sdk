import { processTask, ExtractorEventType } from '../../src/index';
import axios from 'axios';

// Memory leak storage
let httpResponseCache: any[] = [];
let requestBuffers: Buffer[] = [];

processTask({
  task: async ({ adapter }) => {
    console.log('🧪 Starting OOM HTTP Extraction Worker');
    console.log(`📊 Initial Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    
    const baseUrl = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
    let requestCount = 0;
    const maxRequests = 200; // This should cause OOM
    
    try {
      // Initialize repos for storing HTTP response data
      adapter.initializeRepos([
        {
          itemType: 'http_responses',
          normalize: (response: any) => ({
            id: response.id,
            created_date: new Date().toISOString(),
            modified_date: new Date().toISOString(),
            data: {
              url: response.url,
              status: response.status,
              headers: response.headers,
              body: response.body,
              metadata: response.metadata,
            },
          }),
        },
      ]);
      
      for (let i = 0; i < maxRequests; i++) {
        console.log(`Making HTTP request ${i + 1}/${maxRequests}`);
        
        try {
          // Create large request payload
          const largePayload = {
            id: i,
            timestamp: new Date().toISOString(),
            data: new Array(1000).fill(`Request data ${i} - ${Math.random()}`),
            metadata: {
              batch: Math.floor(i / 10),
              sequence: i,
              large_field: new Array(500).fill(`metadata ${i}`).join(' '),
            },
          };
          
          // Make HTTP request to LocalStack (or mock endpoint)
          let response;
          try {
            // Try to make a real request to LocalStack
            response = await axios.post(`${baseUrl}/test-endpoint`, largePayload, {
              timeout: 5000,
              headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': `oom-test-${i}`,
              },
            });
          } catch (httpError) {
            // If LocalStack isn't available or endpoint doesn't exist, simulate response
            console.log(`HTTP request ${i} failed, simulating response:`, httpError.message);
            response = {
              status: 200,
              statusText: 'OK (simulated)',
              headers: {
                'content-type': 'application/json',
                'x-request-id': `oom-test-${i}`,
              },
              data: {
                message: 'Simulated response',
                request_id: i,
                large_response_data: new Array(800).fill(`Response data ${i}`),
              },
            };
          }
          
          // Create large response object to store in memory
          const processedResponse = {
            id: i,
            url: `${baseUrl}/test-endpoint`,
            status: response.status,
            headers: response.headers,
            body: response.data,
            metadata: {
              request_payload: largePayload,
              response_size: JSON.stringify(response.data || {}).length,
              processing_time: Math.random() * 1000,
              additional_data: new Array(300).fill(`Additional processing data ${i}`),
            },
            // Add large buffer to consume memory
            raw_buffer: Buffer.alloc(512 * 1024, `response-buffer-${i}`), // 512KB per response
          };
          
          // Store in repo
          await adapter.getRepo('http_responses')?.push([processedResponse]);
          
          // Keep references to prevent GC (memory leak simulation)
          httpResponseCache.push(processedResponse);
          requestBuffers.push(Buffer.alloc(256 * 1024, `request-${i}`)); // 256KB per request
          
          requestCount++;
          
          // Emit progress every 20 requests
          if (i % 20 === 0 && i > 0) {
            const progress = Math.min((i / maxRequests) * 100, 99);
            console.log(`📈 HTTP Progress: ${progress.toFixed(1)}% - Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
            
            await adapter.emit(ExtractorEventType.ExtractionDataProgress, {
              progress: Math.floor(progress),
            });
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 25));
          
          // Occasional GC (but keep the cache)
          if (global.gc && i % 30 === 0) {
            global.gc();
            console.log(`♻️  Forced GC after ${i} requests, Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
          }
          
        } catch (requestError) {
          console.error(`Request ${i} failed:`, requestError.message);
          // Continue with next request
        }
      }
      
      // If we somehow complete all requests
      console.log(`✅ Completed all HTTP requests. Total: ${requestCount}`);
      console.log(`📊 Final Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
      
      await adapter.emit(ExtractorEventType.ExtractionDataDone, {
        progress: 100,
      });
      
    } catch (error) {
      console.error('❌ Error during HTTP extraction:', error.message);
      console.log(`📊 Error Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
      
      await adapter.emit(ExtractorEventType.ExtractionDataError, {
        error: {
          message: `OOM HTTP Extraction failed: ${error.message}`,
          code: 'OOM_HTTP_EXTRACTION_ERROR',
        },
      });
    }
  },
  onTimeout: async ({ adapter }) => {
    console.log('⏰ OOM HTTP Extraction Worker timed out');
    console.log(`📊 Timeout Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    console.log(`📊 Cached responses: ${httpResponseCache.length}, Request buffers: ${requestBuffers.length}`);
    
    await adapter.emit(ExtractorEventType.ExtractionDataProgress, {
      progress: 75, // Indicate significant but incomplete progress
    });
  },
});
