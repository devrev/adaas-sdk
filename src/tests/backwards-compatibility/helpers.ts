import {
  Extractor,
  ExtractorConfig,
  ExtractorResult,
} from '@microsoft/api-extractor';
import {
  ApiClass,
  ApiConstructor,
  ApiEnum,
  ApiFunction,
  ApiInterface,
  ApiItem,
  ApiMethodSignature,
  ApiModel,
  ApiProperty,
  ApiPropertySignature,
  ApiTypeAlias,
} from '@microsoft/api-extractor-model';

import * as fs from 'fs';
import { execSync } from 'node:child_process';
import * as path from 'path';

export const newApiMdPath = path.join(__dirname, 'temp', 'ts-adaas.md');
export const currentApiMdPath = path.join(__dirname, 'ts-adaas.md');
export const newApiJsonPath = path.join(__dirname, 'temp', 'ts-adaas.api.json');
export const currentApiJsonPath = path.join(__dirname, 'latest.json');

// Generate API report before all tests run
export function generateApiReport(): void {
  // Before running the api extractor, make sure that the code compiles using `tsc` command
  const tscCommand = 'npm run build';
  try {
    execSync(tscCommand);
  } catch (error: unknown) {
    const err = error as Error & { stdout?: Buffer; stderr?: Buffer };
    // Jest has a nice feature: if any of the setup scripts throw an error, the test run will fail
    // This Error is rethrown to get more information from the error.
    throw new Error(
      `Failed to compile code using tsc command:\n${err.stdout?.toString()}`
    );
  }

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

// Helper function to load API data
export const loadApiData = (): {
  newApiMembers: readonly ApiItem[];
  currentApiMembers: readonly ApiItem[];
} => {
  if (!fs.existsSync(newApiJsonPath)) {
    throw new Error(
      'New API reports not found. Run the generate-api-report test first.'
    );
  }

  if (!fs.existsSync(currentApiJsonPath)) {
    throw new Error(
      'Latest API baseline not found. Run backwards compatibility tests first to generate latest.json.'
    );
  }

  const newApiModel = new ApiModel().loadPackage(newApiJsonPath);
  const newApiMembers = newApiModel.entryPoints[0].members;

  const currentApiModel = new ApiModel().loadPackage(currentApiJsonPath);
  const currentApiMembers = currentApiModel.entryPoints[0].members;

  return { newApiMembers, currentApiMembers };
};

// Helper functions for getting different kinds of items from the API members
export const getFunctions = (members: readonly ApiItem[]): ApiFunction[] => {
  return members.filter(
    (m: ApiItem) => m instanceof ApiFunction && m.kind === 'Function'
  ) as ApiFunction[];
};

export const getConstructor = (members: readonly ApiItem[]): ApiConstructor => {
  return (
    members.filter(
      (m: ApiItem) => m instanceof ApiConstructor && m.kind === 'Constructor'
    ) as ApiConstructor[]
  )[0];
};

export const getEnums = (members: readonly ApiItem[]): ApiEnum[] => {
  return members.filter(
    (m: ApiItem) => m instanceof ApiEnum && m.kind === 'Enum'
  ) as ApiEnum[];
};

export const getClasses = (members: readonly ApiItem[]): ApiClass[] => {
  return members.filter(
    (m: ApiItem) => m instanceof ApiClass && m.kind === 'Class'
  ) as ApiClass[];
};

export const getProperties = (members: readonly ApiItem[]): ApiProperty[] => {
  return members.filter(
    (m: ApiItem) => m instanceof ApiProperty && m.kind === 'Property'
  ) as ApiProperty[];
};

export const getTypes = (members: readonly ApiItem[]): ApiTypeAlias[] => {
  return members.filter(
    (m: ApiItem) => m instanceof ApiTypeAlias && m.kind === 'TypeAlias'
  ) as ApiTypeAlias[];
};

export const getInterfaces = (members: readonly ApiItem[]): ApiInterface[] => {
  return members.filter(
    (m: ApiItem) => m instanceof ApiInterface && m.kind === 'Interface'
  ) as ApiInterface[];
};

export const getMethodSignatures = (
  members: readonly ApiItem[]
): ApiMethodSignature[] => {
  return members.filter(
    (m: ApiItem) =>
      m instanceof ApiMethodSignature && m.kind === 'MethodSignature'
  ) as ApiMethodSignature[];
};

export const getPropertySignatures = (
  members: readonly ApiItem[]
): ApiPropertySignature[] => {
  return members.filter(
    (m: ApiItem) =>
      m instanceof ApiPropertySignature && m.kind === 'PropertySignature'
  ) as ApiPropertySignature[];
};

export const updateCurrentApiJson = () => {
  if (fs.existsSync(newApiMdPath) && fs.existsSync(newApiJsonPath)) {
    fs.copyFileSync(newApiMdPath, currentApiMdPath);

    // Copy new API JSON into latest.json after all tests pass
    const latestJsonPath = path.join(__dirname, 'latest.json');
    fs.copyFileSync(newApiJsonPath, latestJsonPath);

    console.log(`Updated current API baseline files and created latest.json.`);
  } else {
    console.warn('No new API reports found.');
  }
};
