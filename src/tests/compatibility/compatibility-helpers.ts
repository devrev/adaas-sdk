import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import * as fs from 'fs';
import * as path from 'path';

export interface ApiMember {
  name: string;
  kind: string;
  canonicalReference?: string;
  releaseTag?: string;
  members?: ApiMember[];
  parameters?: ApiParameter[];
  excerptTokens?: ExcerptToken[];
  typeParameters?: TypeParameter[];
  isOptional?: boolean;
  isProtected?: boolean;
  isReadonly?: boolean;
  initializerTokenRange?: TokenRange;
}

export interface ApiParameter {
  parameterName: string;
  parameterTypeTokenRange: TokenRange;
  isOptional: boolean;
}

export interface ExcerptToken {
  kind: string;
  text: string;
  canonicalReference?: string;
}

export interface TypeParameter {
  typeParameterName: string;
  constraintTokenRange: TokenRange;
  defaultTypeTokenRange: TokenRange;
}

export interface TokenRange {
  startIndex: number;
  endIndex: number;
}

export interface ApiReport {
  members: Array<{
    members: ApiMember[];
  }>;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'unknown';
  signature?: string;
}

export interface CompatibilityChange {
  type: 'added' | 'removed' | 'modified';
  kind: string;
  name: string;
  path: string[];
  isBreaking: boolean;
  description: string;
  previousSignature?: string;
  currentSignature?: string;
  details?: any;
}

export interface CompatibilityReport {
  timestamp: string;
  previousVersion?: string;
  currentVersion?: string;
  summary: {
    totalChanges: number;
    breakingChanges: number;
    nonBreakingChanges: number;
  };
  changes: CompatibilityChange[];
}

/**
 * Extracts API information from the current codebase using API Extractor directly
 */
export function extractCurrentApiInfo(): ApiMember[] {
  try {
    // Load the API Extractor configuration
    const configPath = path.resolve(process.cwd(), 'api-extractor.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('api-extractor.json configuration file not found');
    }
    
    const extractorConfig = ExtractorConfig.loadFileAndPrepare(configPath);
    
    // Run API Extractor
    const extractorResult = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: false
    });
    
    if (!extractorResult.succeeded) {
      throw new Error('API Extractor failed to run successfully');
    }
    
    // Read the generated API JSON file
    const apiJsonPath = path.resolve(process.cwd(), 'temp/api.json');
    if (!fs.existsSync(apiJsonPath)) {
      throw new Error('API JSON file not found after running API Extractor');
    }
    
    const apiReport: ApiReport = JSON.parse(fs.readFileSync(apiJsonPath, 'utf8'));
    return apiReport.members[0]?.members || [];
  } catch (error) {
    throw error;
  }
}

/**
 * Extracts API information from a previous version's API report
 */
export function extractPreviousApiInfo(version: string): ApiMember[] {
  try {
    const apiJsonPath = path.resolve(process.cwd(), `version-api/v${version}.api.json`);
    if (!fs.existsSync(apiJsonPath)) {
      return [];
    }
    
    const apiReport: ApiReport = JSON.parse(fs.readFileSync(apiJsonPath, 'utf8'));
    return apiReport.members[0]?.members || [];
  } catch (error) {
    return [];
  }
}

/**
 * Analyzes runtime exports from the built module
 */
export function analyzeRuntimeExports(): ExportInfo[] {
  try {
    // Import the built module to get runtime exports
    const modulePath = path.resolve(process.cwd(), 'dist/index.js');
    if (!fs.existsSync(modulePath)) {
      throw new Error('Built module not found. Make sure to run npm run build first.');
    }
    
    // Clear require cache to get fresh imports
    delete require.cache[modulePath];
    const moduleExports = require(modulePath);
    
    const exportInfos: ExportInfo[] = [];
    
    for (const [name, value] of Object.entries(moduleExports)) {
      let type: ExportInfo['type'] = 'unknown';
      let signature: string | undefined;
      
      if (typeof value === 'function') {
        type = 'function';
        signature = value.toString().split('\n')[0]; // First line of function
      } else if (typeof value === 'object' && value !== null) {
        if (value.constructor && value.constructor.name !== 'Object') {
          type = 'class';
          signature = value.constructor.name;
        } else {
          type = 'variable';
        }
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        type = 'variable';
      }
      
      exportInfos.push({ name, type, signature });
    }
    
    return exportInfos.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw error;
  }
}

/**
 * Compares API members and returns detailed compatibility results
 */
export function compareApiMembers(previous: ApiMember[], current: ApiMember[]): CompatibilityChange[] {
  const changes: CompatibilityChange[] = [];
  
  const previousMap = new Map(previous.map(m => [m.name, m]));
  const currentMap = new Map(current.map(m => [m.name, m]));
  
  // Check for removed members
  for (const [name, previousMember] of previousMap) {
    if (!currentMap.has(name)) {
      changes.push({
        type: 'removed',
        kind: previousMember.kind,
        name: name,
        path: [name],
        isBreaking: isRemovalBreaking(previousMember),
        description: `${previousMember.kind} '${name}' was removed`,
        previousSignature: getSignature(previousMember)
      });
    }
  }
  
  // Check for added members
  for (const [name, currentMember] of currentMap) {
    if (!previousMap.has(name)) {
      changes.push({
        type: 'added',
        kind: currentMember.kind,
        name: name,
        path: [name],
        isBreaking: false, // Adding new members is generally not breaking
        description: `${currentMember.kind} '${name}' was added`,
        currentSignature: getSignature(currentMember)
      });
    }
  }
  
  // Check for modified members
  for (const [name, currentMember] of currentMap) {
    const previousMember = previousMap.get(name);
    if (previousMember) {
      const memberChanges = compareApiMember(previousMember, currentMember, [name]);
      changes.push(...memberChanges);
    }
  }
  
  return changes;
}

/**
 * Compares individual API members for changes
 */
function compareApiMember(previous: ApiMember, current: ApiMember, path: string[]): CompatibilityChange[] {
  const changes: CompatibilityChange[] = [];
  
  // Check if the kind changed
  if (previous.kind !== current.kind) {
    changes.push({
      type: 'modified',
      kind: previous.kind,
      name: current.name,
      path: path,
      isBreaking: true,
      description: `Changed from ${previous.kind} to ${current.kind}`,
      previousSignature: getSignature(previous),
      currentSignature: getSignature(current)
    });
    return changes; // If kind changed, don't check further
  }
  
  // Check signature changes
  const prevSignature = getSignature(previous);
  const currSignature = getSignature(current);
  if (prevSignature !== currSignature) {
    const isBreaking = isSignatureChangeBreaking(previous, current);
    changes.push({
      type: 'modified',
      kind: current.kind,
      name: current.name,
      path: path,
      isBreaking,
      description: `Signature changed`,
      previousSignature: prevSignature,
      currentSignature: currSignature
    });
  }
  
  // Deep comparison for members (enums, classes, interfaces)
  if (previous.members && current.members) {
    const memberChanges = compareMembers(previous.members, current.members, path);
    changes.push(...memberChanges);
  } else if (previous.members && !current.members) {
    changes.push({
      type: 'modified',
      kind: current.kind,
      name: current.name,
      path: path,
      isBreaking: true,
      description: `All members removed`,
      previousSignature: `${previous.members.length} members`,
      currentSignature: '0 members'
    });
  } else if (!previous.members && current.members) {
    changes.push({
      type: 'modified',
      kind: current.kind,
      name: current.name,
      path: path,
      isBreaking: false,
      description: `Members added`,
      previousSignature: '0 members',
      currentSignature: `${current.members.length} members`
    });
  }
  
  return changes;
}

/**
 * Compares members arrays (for enums, classes, interfaces)
 */
function compareMembers(previous: ApiMember[], current: ApiMember[], parentPath: string[]): CompatibilityChange[] {
  const changes: CompatibilityChange[] = [];
  
  const previousMap = new Map(previous.map(m => [m.name, m]));
  const currentMap = new Map(current.map(m => [m.name, m]));
  
  // Check for removed members
  for (const [name, previousMember] of previousMap) {
    if (!currentMap.has(name)) {
      const memberPath = [...parentPath, name];
      changes.push({
        type: 'removed',
        kind: previousMember.kind,
        name: name,
        path: memberPath,
        isBreaking: isRemovalBreaking(previousMember),
        description: `${previousMember.kind} '${name}' was removed from ${parentPath.join('.')}`,
        previousSignature: getSignature(previousMember)
      });
    }
  }
  
  // Check for added members
  for (const [name, currentMember] of currentMap) {
    if (!previousMap.has(name)) {
      const memberPath = [...parentPath, name];
      const isBreaking = isAdditionBreaking(currentMember, parentPath);
      changes.push({
        type: 'added',
        kind: currentMember.kind,
        name: name,
        path: memberPath,
        isBreaking,
        description: `${currentMember.kind} '${name}' was added to ${parentPath.join('.')}`,
        currentSignature: getSignature(currentMember)
      });
    }
  }
  
  // Check for modified members
  for (const [name, currentMember] of currentMap) {
    const previousMember = previousMap.get(name);
    if (previousMember) {
      const memberPath = [...parentPath, name];
      const memberChanges = compareApiMember(previousMember, currentMember, memberPath);
      changes.push(...memberChanges);
    }
  }
  
  return changes;
}

/**
 * Generates a signature string for an API member
 */
function getSignature(member: ApiMember): string {
  if (!member.excerptTokens || member.excerptTokens.length === 0) {
    return `${member.kind} ${member.name}`;
  }
  
  return member.excerptTokens.map(token => token.text).join('').trim();
}

/**
 * Determines if removing a member is breaking
 */
function isRemovalBreaking(member: ApiMember): boolean {
  // All public member removals are breaking
  return member.releaseTag === 'Public';
}

/**
 * Determines if adding a member is breaking
 */
function isAdditionBreaking(member: ApiMember, parentPath: string[]): boolean {
  // Adding required parameters to functions/methods is breaking
  if (member.kind === 'Parameter' && !member.isOptional) {
    return true;
  }
  
  // Adding abstract methods to classes is breaking
  if (member.kind === 'Method' && parentPath.some(p => p.includes('class'))) {
    // Check if it's abstract (this would need more detailed analysis)
    return false; // Conservative approach - assume non-breaking unless proven otherwise
  }
  
  return false;
}

/**
 * Determines if a signature change is breaking
 */
function isSignatureChangeBreaking(previous: ApiMember, current: ApiMember): boolean {
  // Parameter changes in functions/methods are often breaking
  if ((previous.kind === 'Function' || previous.kind === 'Method' || previous.kind === 'Constructor') && 
      previous.parameters && current.parameters) {
    return areParameterChangesBreaking(previous.parameters, current.parameters);
  }
  
  // Enum value changes are breaking
  if (previous.kind === 'EnumMember' && previous.initializerTokenRange && current.initializerTokenRange) {
    return true; // Any enum value change is breaking
  }
  
  // Property type changes are breaking
  if (previous.kind === 'Property') {
    return true; // Any property type change is breaking
  }
  
  // Return type changes in functions are breaking
  if (previous.kind === 'Function' || previous.kind === 'Method') {
    return true; // Any return type change is breaking
  }
  
  return false;
}

/**
 * Checks if parameter changes are breaking
 */
function areParameterChangesBreaking(previousParams: ApiParameter[], currentParams: ApiParameter[]): boolean {
  // Removing parameters is breaking
  if (currentParams.length < previousParams.length) {
    return true;
  }
  
  // Check each existing parameter
  for (let i = 0; i < previousParams.length; i++) {
    const prevParam = previousParams[i];
    const currParam = currentParams[i];
    
    if (!currParam) {
      return true; // Parameter removed
    }
    
    // Making optional parameter required is breaking
    if (!prevParam.isOptional && currParam.isOptional) {
      return false; // Making required optional is not breaking
    }
    
    if (prevParam.isOptional && !currParam.isOptional) {
      return true; // Making optional required is breaking
    }
    
    // Parameter name changes might indicate type changes (would need deeper analysis)
    if (prevParam.parameterName !== currParam.parameterName) {
      return true; // Conservative approach
    }
  }
  
  // Adding required parameters is breaking
  for (let i = previousParams.length; i < currentParams.length; i++) {
    if (!currentParams[i].isOptional) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generates a compatibility report and saves it to the temp folder
 */
export function generateCompatibilityReport(changes: CompatibilityChange[], previousVersion?: string, currentVersion?: string): CompatibilityReport {
  const breakingChanges = changes.filter(c => c.isBreaking);
  const nonBreakingChanges = changes.filter(c => !c.isBreaking);
  
  const report: CompatibilityReport = {
    timestamp: new Date().toISOString(),
    previousVersion,
    currentVersion,
    summary: {
      totalChanges: changes.length,
      breakingChanges: breakingChanges.length,
      nonBreakingChanges: nonBreakingChanges.length
    },
    changes: changes.sort((a, b) => {
      // Sort by breaking status first, then by type, then by name
      if (a.isBreaking !== b.isBreaking) {
        return a.isBreaking ? -1 : 1;
      }
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    })
  };
  
  // Save to temp folder
  const tempDir = path.resolve(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Generate human-readable Markdown report
  const markdownReport = generateMarkdownReport(report);
  const reportPath = path.join(tempDir, 'compatibility-report.md');
  fs.writeFileSync(reportPath, markdownReport);
  
  return report;
}

/**
 * Generates a human-readable Markdown report
 */
function generateMarkdownReport(report: CompatibilityReport): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# API Compatibility Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`**Previous Version:** ${report.previousVersion || 'Unknown'}`);
  lines.push(`**Current Version:** ${report.currentVersion || 'Unknown'}`);
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Changes | ${report.summary.totalChanges} |`);
  lines.push(`| Breaking Changes | ${report.summary.breakingChanges} |`);
  lines.push(`| Non-Breaking Changes | ${report.summary.nonBreakingChanges} |`);
  lines.push('');
  
  const breakingChanges = report.changes.filter(c => c.isBreaking);
  const nonBreakingChanges = report.changes.filter(c => !c.isBreaking);
  
  // Breaking Changes Section
  if (breakingChanges.length > 0) {
    lines.push('## ❌ Breaking Changes');
    lines.push('');
    lines.push('> ⚠️ **Warning:** These changes may break existing code that depends on this API.');
    lines.push('');
    
    const groupedBreaking = groupChangesByKind(breakingChanges);
    Object.entries(groupedBreaking).forEach(([kind, changes]) => {
      lines.push(`### ${kind}`);
      lines.push('');
      changes.forEach(change => {
        lines.push(`#### ${change.type.toUpperCase()}: \`${change.path.join('.')}\``);
        lines.push('');
        lines.push(`**Description:** ${change.description}`);
        lines.push('');
        
        if (change.previousSignature && change.currentSignature) {
          lines.push('**Signature Changes:**');
          lines.push('');
          lines.push('```typescript');
          lines.push(`// Previous`);
          // Ensure each line of the previous signature is properly handled
          const prevLines = change.previousSignature.split('\n');
          prevLines.forEach(line => {
            lines.push(line);
          });
          lines.push('');
          lines.push(`// Current`);
          // Ensure each line of the current signature is properly handled
          const currLines = change.currentSignature.split('\n');
          currLines.forEach(line => {
            lines.push(line);
          });
          lines.push('```');
          lines.push('');
        } else if (change.previousSignature) {
          lines.push('**Removed:**');
          lines.push('');
          lines.push('```typescript');
          // Ensure each line of the signature is properly handled
          const sigLines = change.previousSignature.split('\n');
          sigLines.forEach(line => {
            lines.push(line);
          });
          lines.push('```');
          lines.push('');
        } else if (change.currentSignature) {
          lines.push('**Added:**');
          lines.push('');
          lines.push('```typescript');
          // Ensure each line of the signature is properly handled
          const sigLines = change.currentSignature.split('\n');
          sigLines.forEach(line => {
            lines.push(line);
          });
          lines.push('```');
          lines.push('');
        }
      });
    });
  }
  
  // Non-Breaking Changes Section
  if (nonBreakingChanges.length > 0) {
    lines.push('## ✅ Non-Breaking Changes');
    lines.push('');
    lines.push('> ℹ️ **Info:** These changes are backwards compatible and should not break existing code.');
    lines.push('');
    
    const groupedNonBreaking = groupChangesByKind(nonBreakingChanges);
    Object.entries(groupedNonBreaking).forEach(([kind, changes]) => {
      lines.push(`### ${kind}`);
      lines.push('');
      
      // For non-breaking changes, show a more compact format
      const addedChanges = changes.filter(c => c.type === 'added');
      const modifiedChanges = changes.filter(c => c.type === 'modified');
      
      if (addedChanges.length > 0) {
        lines.push('**Added:**');
        lines.push('');
        addedChanges.forEach(change => {
          lines.push(`- \`${change.path.join('.')}\` - ${change.description}`);
          if (change.currentSignature) {
            lines.push(`  \`\`\`typescript`);
            // Ensure each line of the signature is properly indented for markdown list
            const signatureLines = change.currentSignature.split('\n');
            signatureLines.forEach(line => {
              lines.push(`  ${line}`);
            });
            lines.push(`  \`\`\``);
          }
        });
        lines.push('');
      }
      
      if (modifiedChanges.length > 0) {
        lines.push('**Modified:**');
        lines.push('');
        modifiedChanges.forEach(change => {
          lines.push(`- \`${change.path.join('.')}\` - ${change.description}`);
          if (change.previousSignature && change.currentSignature) {
            lines.push(`  \`\`\`typescript`);
            // Ensure each line of the signatures is properly indented for markdown list
            const prevLines = change.previousSignature.split('\n');
            const currLines = change.currentSignature.split('\n');
            
            lines.push(`  // Previous:`);
            prevLines.forEach(line => {
              lines.push(`  ${line}`);
            });
            lines.push(`  `);
            lines.push(`  // Current:`);
            currLines.forEach(line => {
              lines.push(`  ${line}`);
            });
            lines.push(`  \`\`\``);
          }
        });
        lines.push('');
      }
    });
  }
  
  // Footer
  if (report.summary.totalChanges === 0) {
    lines.push('## 🎉 No Changes Detected');
    lines.push('');
    lines.push('The API surface is identical between the two versions.');
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push(`*Report generated by API Compatibility Checker*`);
  
  return lines.join('\n');
}

/**
 * Groups changes by their kind for better organization in the report
 */
function groupChangesByKind(changes: CompatibilityChange[]): Record<string, CompatibilityChange[]> {
  const grouped: Record<string, CompatibilityChange[]> = {};
  
  changes.forEach(change => {
    if (!grouped[change.kind]) {
      grouped[change.kind] = [];
    }
    grouped[change.kind].push(change);
  });
  
  // Sort the groups by kind name
  const sortedGroups: Record<string, CompatibilityChange[]> = {};
  Object.keys(grouped).sort().forEach(kind => {
    sortedGroups[kind] = grouped[kind];
  });
  
  return sortedGroups;
}

/**
 * Gets the previous version tag from git
 */
export function getPreviousVersion(): string | null {
  try {
    const { execSync } = require('child_process');
    const previousVersionTag = execSync('git describe --abbrev=0 --tags', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    return previousVersionTag.replace('v', '');
  } catch (error) {
    return null;
  }
}

/**
 * Checks if we should run compatibility tests based on version comparison
 */
export function shouldRunCompatibilityCheck(currentVersion: string, previousVersion: string): boolean {
  const semver = require('semver');
  
  try {
    // Only run compatibility checks for minor/patch updates within the same major version
    return semver.major(currentVersion) === semver.major(previousVersion);
  } catch (error) {
    return false;
  }
}

/**
 * Main function to run compatibility analysis and generate reports
 */
export function runCompatibilityAnalysis(previousVersion?: string): CompatibilityReport {
  try {
    // Extract current API info
    const currentApiInfo = extractCurrentApiInfo();
    
    // Get previous version if not provided
    const prevVersion = previousVersion || getPreviousVersion();
    if (!prevVersion) {
      throw new Error('No previous version found. Cannot perform compatibility analysis.');
    }
    
    // Extract previous API info
    const previousApiInfo = extractPreviousApiInfo(prevVersion);
    if (previousApiInfo.length === 0) {
      throw new Error(`No API report found for version ${prevVersion}`);
    }
    
    // Compare APIs and get detailed changes
    const changes = compareApiMembers(previousApiInfo, currentApiInfo);
    
    // Generate and save reports
    const report = generateCompatibilityReport(changes, prevVersion, getCurrentVersion());
    
    return report;
  } catch (error) {
    throw error;
  }
}

/**
 * Gets the current version from package.json
 */
function getCurrentVersion(): string {
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || 'unknown';
    }
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}
