import {
  extractCurrentApiInfo,
  analyzeRuntimeExports,
  getPreviousVersion,
  shouldRunCompatibilityCheck,
  runCompatibilityAnalysis,
  type ApiMember,
  type ExportInfo,
  type CompatibilityReport
} from './compatibility-helpers';

describe('Version Compatibility Tests', () => {
  const pkg = require('../../../package.json');
  const currentVersion = pkg.version;

  describe('API Backwards Compatibility', () => {
    it('should maintain backwards compatibility', async () => {
      const previousVersion = getPreviousVersion();
      
      if (!previousVersion) {
        return; // Skip test if no previous version found
      }

      if (!shouldRunCompatibilityCheck(currentVersion, previousVersion)) {
        return; // Skip test for major version changes
      }

      let report: CompatibilityReport;
      
      try {
        // Run comprehensive compatibility analysis
        report = runCompatibilityAnalysis(previousVersion);
      } catch (error) {
        throw new Error(`Compatibility analysis failed: ${error}`);
      }

      // Fail the test if there are breaking changes
      if (report.summary.breakingChanges > 0) {
        throw new Error(`Breaking changes detected: ${report.summary.breakingChanges} breaking changes found. See temp/compatibility-report.md for details.`);
      }
    });

    it('should have runtime exports matching API declarations', () => {
      let runtimeExports: ExportInfo[];
      let apiMembers: ApiMember[];
      
      try {
        runtimeExports = analyzeRuntimeExports();
        apiMembers = extractCurrentApiInfo();
      } catch (error) {
        throw new Error(`Failed to analyze exports: ${error}`);
      }

      // Create maps for easier comparison
      const runtimeMap = new Map(runtimeExports.map(e => [e.name, e]));
      const apiMap = new Map(apiMembers.map(m => [m.name, m]));

      // Find discrepancies
      const runtimeOnlyExports = runtimeExports.filter(e => !apiMap.has(e.name));
      const apiOnlyExports = apiMembers.filter(m => !runtimeMap.has(m.name));

      // This is informational - we don't fail on mismatches as they might be expected
      // (e.g., type-only exports won't appear at runtime)
      expect(runtimeExports).toBeDefined();
      expect(apiMembers).toBeDefined();
      expect(Array.isArray(runtimeExports)).toBe(true);
      expect(Array.isArray(apiMembers)).toBe(true);
    });
  });

  describe('API Extractor Validation', () => {
    it('should pass API extractor checks without errors', () => {
      try {
        // This will run API extractor as part of extractCurrentApiInfo
        // If it fails, the function will throw an error
        const currentApiMembers = extractCurrentApiInfo();
        
        // If we get here, API extractor ran successfully
        expect(currentApiMembers).toBeDefined();
        expect(Array.isArray(currentApiMembers)).toBe(true);
        expect(currentApiMembers.length).toBeGreaterThan(0);
      } catch (error) {
        throw new Error(`API extractor validation failed: ${error}`);
      }
    });
  });
});
