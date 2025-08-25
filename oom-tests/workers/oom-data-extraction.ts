import { processTask, ExtractorEventType } from '../../src/index';
import { createItems, normalizeItem, createAttachments } from '../../src/tests/test-helpers';
import { NormalizedItem, NormalizedAttachment } from '../../src/repo/repo.interfaces';

// Create a large array to hold memory-consuming data
let memoryLeakArray: any[] = [];

const repos = [
  {
    itemType: 'issues',
    normalize: normalizeItem,
  },
  {
    itemType: 'users', 
    normalize: (item: any): NormalizedItem => ({
      id: item.id,
      created_date: item.created_at,
      modified_date: item.updated_at,
      data: {
        name: item.name,
        email: item.email,
        profile: item.profile, // This will contain large data
      },
    }),
  },
  {
    itemType: 'attachments',
    normalize: (item: any): NormalizedAttachment => ({
      id: item.id,
      url: item.url,
      author_id: item.author_id,
      file_name: item.file_name,
      parent_id: item.parent_id,
    }),
  },
];

processTask({
  task: async ({ adapter }) => {
    console.log('🧪 Starting OOM Data Extraction Worker');
    console.log(`📊 Initial Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    
    adapter.initializeRepos(repos);
    
    try {
      // Simulate data extraction with excessive memory consumption
      const batchSize = 5000; // Large batch size to consume memory
      let totalProcessed = 0;
      const maxBatches = 50; // This should cause OOM with our memory limits
      
      for (let batch = 0; batch < maxBatches; batch++) {
        console.log(`Processing batch ${batch + 1}/${maxBatches}`);
        
        // Create large dataset for issues
        const issues = createItems(batchSize).map(item => ({
          ...item,
          // Add large description to consume more memory
          description: new Array(1000).fill(`Large description for issue ${item.id} - batch ${batch}`).join(' '),
          comments: new Array(100).fill({
            id: Math.random(),
            text: new Array(50).fill(`Comment text ${Math.random()}`).join(' '),
            author: `user-${Math.random()}`,
            timestamp: new Date().toISOString(),
          }),
        }));
        
        // Create large dataset for users with profiles
        const users = createItems(batchSize).map(item => ({
          ...item,
          email: `user${item.id}@example.com`,
          profile: {
            bio: new Array(500).fill(`Bio text for user ${item.id}`).join(' '),
            preferences: new Array(200).fill({ key: `pref-${Math.random()}`, value: `value-${Math.random()}` }),
            activity_log: new Array(300).fill({
              action: `action-${Math.random()}`,
              timestamp: new Date().toISOString(),
              data: new Array(50).fill(`activity data ${Math.random()}`).join(' '),
            }),
          },
        }));
        
        // Create attachments
        const attachments = createAttachments(batchSize / 10).map(attachment => ({
          ...attachment,
          // Add large metadata to consume memory
          metadata: {
            content: new Array(2000).fill(`Attachment metadata ${attachment.id}`).join(' '),
            tags: new Array(100).fill(`tag-${Math.random()}`),
            processing_info: new Array(50).fill({
              step: `step-${Math.random()}`,
              result: new Array(100).fill(`result-${Math.random()}`).join(' '),
            }),
          },
        }));
        
        // Push data to repos (this consumes memory in the SDK)
        await adapter.getRepo('issues')?.push(issues);
        await adapter.getRepo('users')?.push(users);
        await adapter.getRepo('attachments')?.push(attachments);
        
        // Keep references to prevent GC (memory leak simulation)
        memoryLeakArray.push({
          batch,
          issues: issues.slice(0, 100), // Keep some references
          users: users.slice(0, 100),
          attachments: attachments.slice(0, 10),
          largeBuffer: Buffer.alloc(1024 * 1024, `batch-${batch}`), // 1MB per batch
        });
        
        totalProcessed += batchSize;
        
        // Emit progress every few batches
        if (batch % 5 === 0 && batch > 0) {
          const progress = Math.min((batch / maxBatches) * 100, 99);
          console.log(`📈 Progress: ${progress.toFixed(1)}% - Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
          
          await adapter.emit(ExtractorEventType.ExtractionDataProgress, {
            progress: Math.floor(progress),
          });
        }
        
        // Small delay to make the process observable
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Force GC occasionally (but keep the leak array)
        if (global.gc && batch % 10 === 0) {
          global.gc();
          console.log(`♻️  Forced GC after batch ${batch}, Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
        }
      }
      
      // If we somehow survive all batches, emit done
      console.log(`✅ Completed all batches. Total processed: ${totalProcessed} items`);
      console.log(`📊 Final Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
      
      await adapter.emit(ExtractorEventType.ExtractionDataDone, {
        progress: 100,
      });
      
    } catch (error) {
      console.error('❌ Error during data extraction:', error.message);
      console.log(`📊 Error Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
      
      await adapter.emit(ExtractorEventType.ExtractionDataError, {
        error: {
          message: `OOM Data Extraction failed: ${error.message}`,
          code: 'OOM_DATA_EXTRACTION_ERROR',
        },
      });
    }
  },
  onTimeout: async ({ adapter }) => {
    console.log('⏰ OOM Data Extraction Worker timed out');
    console.log(`📊 Timeout Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    
    await adapter.emit(ExtractorEventType.ExtractionDataProgress, {
      progress: 50, // Indicate partial completion
    });
  },
});
