import { createOOMTestRunner } from './oom-test-helpers';
import { OOMScenario } from './types';

describe('OOM Test Scenarios', () => {
  const testRunner = createOOMTestRunner();

  beforeEach(() => {
    // Clear any existing large objects
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(async () => {
    // Cleanup after each test
    await testRunner.cleanup();
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Leak Scenarios', () => {
    it('should handle gradual memory leak through array growth', async () => {
      const scenario: OOMScenario = {
        name: 'Gradual Array Growth',
        description: 'Continuously append large objects to an array',
        memoryTarget: 200 * 1024 * 1024, // 200MB
        iterations: 1000,
        iterationDelay: 10,
      };

      const result = await testRunner.runScenario(scenario, () => {
        const largeArray: any[] = [];
        for (let i = 0; i < scenario.iterations!; i++) {
          // Create 200KB objects
          const largeObject = {
            id: i,
            data: new Array(50000).fill(`data-${i}`),
            timestamp: Date.now(),
            metadata: new Array(1000).fill({ key: `value-${i}` }),
          };
          largeArray.push(largeObject);
          
          if (i % 100 === 0) {
            console.log(`Iteration ${i}, Array size: ${largeArray.length}, Memory: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
          }
        }
        return largeArray;
      });

      expect(result.completed).toBe(true);
      expect(result.peakMemoryUsage).toBeGreaterThan(0);
    });

    it('should handle rapid memory allocation bursts', async () => {
      const scenario: OOMScenario = {
        name: 'Rapid Memory Bursts',
        description: 'Allocate large chunks of memory in rapid succession',
        memoryTarget: 150 * 1024 * 1024, // 150MB
        iterations: 50,
        iterationDelay: 5,
      };

      const result = await testRunner.runScenario(scenario, () => {
        const chunks: Buffer[] = [];
        for (let i = 0; i < scenario.iterations!; i++) {
          // Allocate 3MB chunks
          const chunk = Buffer.alloc(3 * 1024 * 1024, `chunk-${i}`);
          chunks.push(chunk);
          
          console.log(`Allocated chunk ${i}, Total memory: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
        }
        return chunks;
      });

      expect(result.completed).toBe(true);
      expect(result.chunks).toBeGreaterThan(0);
    });

    it('should handle circular reference memory leaks', async () => {
      const scenario: OOMScenario = {
        name: 'Circular References',
        description: 'Create objects with circular references that prevent GC',
        memoryTarget: 100 * 1024 * 1024, // 100MB
        iterations: 5000,
        iterationDelay: 1,
      };

      const result = await testRunner.runScenario(scenario, () => {
        const objects: any[] = [];
        for (let i = 0; i < scenario.iterations!; i++) {
          const obj1: any = {
            id: i,
            data: new Array(1000).fill(`data-${i}`),
          };
          const obj2: any = {
            id: i + 1,
            data: new Array(1000).fill(`data-${i + 1}`),
          };
          
          // Create circular references
          obj1.reference = obj2;
          obj2.reference = obj1;
          obj1.parent = objects;
          
          objects.push(obj1, obj2);
          
          if (i % 500 === 0) {
            console.log(`Created ${objects.length} objects with circular refs, Memory: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
          }
        }
        return objects;
      });

      expect(result.completed).toBe(true);
      expect(result.objectsCreated).toBeGreaterThan(0);
    });
  });

  describe('LocalStack Integration OOM Tests', () => {
    it('should handle OOM during large file uploads to LocalStack S3', async () => {
      const scenario: OOMScenario = {
        name: 'LocalStack S3 Upload OOM',
        description: 'Upload large files to LocalStack S3 until OOM',
        memoryTarget: 180 * 1024 * 1024, // 180MB
        iterations: 20,
        iterationDelay: 100,
      };

      const result = await testRunner.runScenarioWithLocalStack(scenario, async (aws) => {
        const uploads: any[] = [];
        
        for (let i = 0; i < scenario.iterations!; i++) {
          // Create 10MB file in memory
          const fileContent = Buffer.alloc(10 * 1024 * 1024, `file-content-${i}`);
          
          try {
            const uploadResult = await aws.s3.upload({
              Bucket: 'test-bucket',
              Key: `large-file-${i}.dat`,
              Body: fileContent,
            }).promise();
            
            uploads.push({
              key: uploadResult.Key,
              location: uploadResult.Location,
              size: fileContent.length,
            });
            
            console.log(`Uploaded file ${i}, Size: ${fileContent.length / 1024 / 1024}MB, Memory: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
          } catch (error) {
            console.error(`Upload ${i} failed:`, error.message);
            break;
          }
        }
        
        return uploads;
      });

      expect(result.completed).toBe(true);
      expect(result.uploads).toBeDefined();
    });

    it('should handle OOM during concurrent LocalStack operations', async () => {
      const scenario: OOMScenario = {
        name: 'Concurrent LocalStack Operations',
        description: 'Run multiple concurrent operations against LocalStack',
        memoryTarget: 200 * 1024 * 1024, // 200MB
        iterations: 100,
        iterationDelay: 50,
      };

      const result = await testRunner.runScenarioWithLocalStack(scenario, async (aws) => {
        const operations: Promise<any>[] = [];
        
        for (let i = 0; i < scenario.iterations!; i++) {
          // Create concurrent S3, DynamoDB, and Lambda operations
          const s3Promise = aws.s3.putObject({
            Bucket: 'test-bucket',
            Key: `concurrent-${i}.json`,
            Body: JSON.stringify({ data: new Array(1000).fill(`item-${i}`) }),
          }).promise();
          
          const dynamoPromise = aws.dynamodb.putItem({
            TableName: 'test-table',
            Item: {
              id: { S: `item-${i}` },
              data: { S: JSON.stringify(new Array(100).fill(`data-${i}`)) },
            },
          }).promise();
          
          operations.push(s3Promise, dynamoPromise);
          
          if (operations.length > 50) {
            // Process in batches to avoid too many concurrent operations
            await Promise.allSettled(operations.splice(0, 25));
            console.log(`Processed batch, Memory: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
          }
        }
        
        // Process remaining operations
        const results = await Promise.allSettled(operations);
        return results;
      });

      expect(result.completed).toBe(true);
      expect(result.operationResults).toBeDefined();
    });
  });

  describe('Worker Thread OOM Tests', () => {
    it('should handle OOM in worker threads', async () => {
      const scenario: OOMScenario = {
        name: 'Worker Thread OOM',
        description: 'Create memory pressure in worker threads',
        memoryTarget: 150 * 1024 * 1024, // 150MB
        iterations: 10,
        iterationDelay: 200,
      };

      const result = await testRunner.runWorkerScenario(scenario, (workerData) => {
        return new Promise((resolve, reject) => {
          const { Worker } = require('worker_threads');
          const workers: any[] = [];
          
          for (let i = 0; i < scenario.iterations!; i++) {
            const worker = new Worker(`
              const { parentPort, workerData } = require('worker_threads');
              
              // Allocate memory in worker
              const largeData = [];
              for (let j = 0; j < 1000; j++) {
                largeData.push(new Array(10000).fill(\`worker-\${workerData.id}-data-\${j}\`));
              }
              
              parentPort.postMessage({
                workerId: workerData.id,
                memoryUsage: process.memoryUsage(),
                dataSize: largeData.length
              });
            `, { 
              eval: true,
              workerData: { id: i, scenario: scenario.name }
            });
            
            worker.on('message', (data) => {
              console.log(`Worker ${data.workerId} memory: ${data.memoryUsage.heapUsed / 1024 / 1024}MB`);
            });
            
            worker.on('error', (error) => {
              console.error(`Worker ${i} error:`, error.message);
            });
            
            workers.push(worker);
          }
          
          // Wait for all workers to complete
          Promise.all(workers.map(w => new Promise(resolve => w.on('exit', resolve))))
            .then(() => resolve({ workersCreated: workers.length }))
            .catch(reject);
        });
      });

      expect(result.completed).toBe(true);
      expect(result.workersCreated).toBeGreaterThan(0);
    });
  });
});

