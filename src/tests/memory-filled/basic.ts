import { ExtractorEventType, processTask } from '../../index';
import fs from 'fs';

const LARGE_STRING = 'A'.repeat(30 * 1024); // 10 KB of 'A's
const LOG_PATH = 'memory-filled-basic.csv';

const repos = [
    { itemType: 'a'},
    { itemType: 'b'},
    { itemType: 'c'},
    { itemType: 'd'},
    { itemType: 'e'},
    { itemType: 'f'},
    { itemType: 'g'},
    { itemType: 'h'},
    { itemType: 'i'},
    { itemType: 'j'},
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function setupLogging() {
    // Remove file if it already exists
    if (fs.existsSync(LOG_PATH)) {
        fs.unlinkSync(LOG_PATH);
    }

    const header = "timestamp,heap,rss,external,arrayBuffers\n";
    fs.writeFileSync(LOG_PATH, header);
}

async function appendLogEntry() {
    // Log memory usage in MB
    let memoryUsage = process.memoryUsage();
    let entry = `${Date.now()},${memoryUsage.heapUsed / 1024 / 1024},${memoryUsage.rss / 1024 / 1024},${memoryUsage.external / 1024 / 1024},${memoryUsage.arrayBuffers / 1024 / 1024}\n`;

    // Append log to end of the file
    fs.appendFileSync(LOG_PATH, entry);

    sleep(100);
}

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);    

    setupLogging();
    console.warn("Logging set up!");

    for (const repo of repos) {
        console.warn("Processing repo:", repo.itemType);
        for (const _ of Array(2999).keys()) {
            console.log("Iteration for repo:", repo.itemType);
            await adapter.getRepo(repo.itemType)?.push([{itemContent: JSON.stringify(LARGE_STRING)}]);
            await appendLogEntry();
        }
    }

    await adapter.emit(ExtractorEventType.ExtractionDataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});

