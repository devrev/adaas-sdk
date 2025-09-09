import * as fs from 'fs';
import * as path from 'path';

import {
  Extractor,
  ExtractorConfig,
  ExtractorResult,
} from '@microsoft/api-extractor';

// Generate API report before all tests run
export function generateApiReport(): void {
  const apiExtractorJsonPath: string = path.join(
    __dirname,
    'api-extractor.json'
  );
  
  // Ensure the temp and report directories exist
  const tempDir = path.join(__dirname, 'temp');
  const reportDir = path.join(__dirname, 'report');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`Created temp directory: ${tempDir}`);
  }
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
    console.log(`Created report directory: ${reportDir}`);
  }

  const extractorConfig: ExtractorConfig =
    ExtractorConfig.loadFileAndPrepare(apiExtractorJsonPath);

  const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
    localBuild: true,
    showVerboseMessages: false,
  });

  if (extractorResult.succeeded) {
    console.log(`API Extractor completed successfully`);
    process.exitCode = 0;
  } else {
    console.error(
      `API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`
    );
    process.exitCode = 1;
  }
}

// Run the API report generation
generateApiReport();
