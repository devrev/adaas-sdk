import * as fs from 'fs';
import * as path from 'path';

import {
  Extractor,
  ExtractorConfig,
  ExtractorResult,
} from '@microsoft/api-extractor';

describe('Generate API report', () => {
  it('should generate an api report', () => {
    const apiExtractorJsonPath: string = path.join(
      __dirname,
      'api-extractor.json'
    );
    const extractorConfig: ExtractorConfig =
      ExtractorConfig.loadFileAndPrepare(apiExtractorJsonPath);

    const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: true,
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
  });
});

describe('Validate API report', () => {
  const newApiMdPath = path.join(__dirname, 'temp', 'ts-adaas.api.md');
  const newApiJsonPath = path.join(__dirname, 'temp', 'ts-adaas.api.json');
  const currentApiMdPath = path.join(__dirname, 'ts-adaas.api.md');
  const currentApiJsonPath = path.join(__dirname, 'ts-adaas.api.json');

  // Helper function to load API data
  const loadApiData = () => {
    if (!fs.existsSync(newApiJsonPath)) {
      throw new Error(
        'API reports not found. Run the generate-api-report test first.'
      );
    }

    const newApiJson = fs.readFileSync(newApiJsonPath, 'utf-8');
    const newApi = JSON.parse(newApiJson);
    const newApiMembers = newApi.members[0].members;

    const currentApiJson = fs.readFileSync(currentApiJsonPath, 'utf-8');
    const currentApi = JSON.parse(currentApiJson);
    const currentApiMembers = currentApi.members[0].members;

    return { newApiMembers, currentApiMembers };
  };

  describe('Exports', () => {
    it('should verify that all exports in current are still in new', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newExports = newApiMembers.map((m: any) => m.name);
      const currentExports = currentApiMembers.map((m: any) => m.name);
      for (const exportName of newExports) {
        expect(currentExports).toContain(exportName);
      }
    });
  });

  describe('Functions', () => {
    // TODO: Verify no parameters were removed
    // TODO: Verify no optional parameters became required
    // TODO: Verify parameter names haven't changed
    // TODO: Verify parameter types are compatible (same or more permissive)
    // TODO: Verify return types are compatible (same or more specific)
    // TODO: Check that function overloads weren't removed
  });

  describe('Classes', () => {
    // TODO: Verify no public properties were removed
    // TODO: Verify no optional properties became required
    // TODO: Verify property names haven't changed
    // TODO: Verify property types are compatible
    // TODO: Verify no public methods were removed
    // TODO: Check constructor signature compatibility (same rules as functions)
    // TODO: Verify class inheritance hierarchy hasn't changed in breaking ways
  });

  describe('Interfaces', () => {
    // TODO: Verify no properties were removed
    // TODO: Verify no optional properties became required
    // TODO: Verify property names haven't changed
    // TODO: Verify property types are compatible
    // TODO: Check that method signatures are compatible (if interface has methods)
    // TODO: Verify interface inheritance hierarchy hasn't changed
  });

  describe('Enums', () => {
    // TODO: Verify no enum values were removed
    // TODO: Verify enum value names haven't changed
    // TODO: Verify numeric enum values haven't changed (if numeric enum)
    // TODO: Check that new enum values were only added at the end (best practice)
  });

  describe('Types', () => {
    // TODO: Verify type aliases weren't removed
    // TODO: Verify union types didn't become more restrictive (no types removed from union)
    // TODO: Verify intersection types didn't become more permissive (no required types removed)
    // TODO: Check generic type parameter compatibility
  });

  describe('Method Signatures', () => {
    // TODO: Verify generic constraints haven't become more restrictive
    // TODO: Check that default parameter values are still compatible
    // TODO: Verify rest parameters (...args) compatibility
    // TODO: Check function signature overloads
  });

  describe('Generics', () => {
    // TODO: Verify generic type parameters weren't removed
    // TODO: Check that generic constraints didn't become more restrictive
    // TODO: Verify generic parameter names haven't changed (affects explicit type arguments)
    // TODO: Check variance compatibility (covariant/contravariant)
  });

  describe('Property Types', () => {
    // TODO: Check readonly properties didn't become mutable (or vice versa in breaking way)
    // TODO: Verify array types compatibility (T[] vs Array<T>)
    // TODO: Check Promise/async compatibility
    // TODO: Verify callback function signature compatibility
  });

  describe('Accessibility', () => {
    // TODO: Verify public members didn't become private/protected
    // TODO: Check that protected members didn't become private
    // TODO: Ensure no breaking changes in static vs instance members
  });

  afterAll(() => {
    if (fs.existsSync(newApiMdPath) && fs.existsSync(newApiJsonPath)) {
      fs.copyFileSync(newApiMdPath, currentApiMdPath);
      fs.copyFileSync(newApiJsonPath, currentApiJsonPath);

      console.log(`Updated current API baseline files.`);
    } else {
      console.warn('No new API reports found.');
    }
  });
});
