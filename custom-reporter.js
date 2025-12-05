// custom-reporter.js
const { spawn } = require('child_process');
const stripAnsi = require('strip-ansi'); // npm install strip-ansi

class FailuresOnlyReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.failedTests = [];
    this.passedCount = 0;

    // Global output buffer
    this.globalOutputBuffer = [];
    // Track the index of the last processed output entry
    // When a test file result comes in, we grab all output from lastProcessedIndex to current
    this.lastProcessedIndex = 0;
    // Flag to control whether output should be passed through or suppressed
    this.suppressOutput = true;

    // Capture all stdout/stderr
    this.captureConsole();
  }

  captureConsole() {
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
    this.originalStderrWrite = process.stderr.write.bind(process.stderr);

    process.stdout.write = (chunk, encoding, callback) => {
      this.captureOutput('log', chunk.toString());
      // Only pass through if not suppressing output
      if (!this.suppressOutput) {
        return this.originalStdoutWrite(chunk, encoding, callback);
      }
      // Call callback if provided to maintain stream behavior
      if (typeof callback === 'function') callback();
      return true;
    };

    process.stderr.write = (chunk, encoding, callback) => {
      this.captureOutput('error', chunk.toString());
      // Only pass through if not suppressing output
      if (!this.suppressOutput) {
        return this.originalStderrWrite(chunk, encoding, callback);
      }
      // Call callback if provided to maintain stream behavior
      if (typeof callback === 'function') callback();
      return true;
    };
  }

  captureOutput(type, message) {
    // Store in global buffer
    this.globalOutputBuffer.push({
      type,
      message,
    });
  }

  onTestStart(test) {
    // Called at the start of each individual test
  }

  onTestFileStart(test) {
    // Called at the start of each test file
    // We don't use this anymore - we determine output ownership based on when results come in
  }

  onTestFileResult(test, testResult, aggregatedResult) {
    const testPath = testResult.testFilePath;

    // Get all output that was captured since the last test file result
    const startIndex = this.lastProcessedIndex;
    const endIndex = this.globalOutputBuffer.length;

    // Update the last processed index for the next test file
    this.lastProcessedIndex = endIndex;

    // Get the output for this test file
    const capturedOutput = this.globalOutputBuffer.slice(startIndex, endIndex).map(entry => ({
      type: entry.type,
      message: entry.message
    }));

    if (testResult.numFailingTests > 0) {
      // Merge Jest's captured console with our captured output
      const jestConsole = testResult.console || [];
      const allOutput = [...jestConsole, ...capturedOutput];

      this.failedTests.push({
        testPath: testPath.replace(process.cwd(), ''),
        failureMessage: testResult.failureMessage,
        testResults: testResult.testResults.filter(r => r.status === 'failed'),
        console: allOutput,
      });
    } else {
      this.passedCount += testResult.numPassingTests;
    }
  }

  onTestResult(test, testResult, aggregatedResult) {
    // Alias for onTestFileResult - some Jest versions use this instead
    this.onTestFileResult(test, testResult, aggregatedResult);
  }

  onRunComplete(contexts, results) {
    // Re-enable output pass-through for the summary
    this.suppressOutput = false;

    console.log('\n' + '='.repeat(80));
    console.log(`✅ Passed: ${this.passedCount} tests`);
    console.log(`❌ Failed: ${results.numFailedTests} tests`);
    console.log('='.repeat(80));

    if (this.failedTests.length > 0) {
      console.log('\n🔴 FAILED TESTS (with full console output)\n');
      
      this.failedTests.forEach(({ testPath, testResults, console: logs }, index) => {
        console.log('\n' + '─'.repeat(80));
        console.log(`\n📛 Test File #${index + 1}: ${testPath}\n`);
        
        testResults.forEach(result => {
          const fullName = [...result.ancestorTitles, result.title].join(' › ');
          console.log(`  ❌ ${fullName}`);
          
          if (result.failureMessages && result.failureMessages.length > 0) {
            result.failureMessages.forEach(msg => {
              console.log('\n' + msg);
            });
          }
        });

        if (logs && logs.length > 0) {
          console.log('\n  📋 FULL CONSOLE OUTPUT:');
          console.log('  ' + '┄'.repeat(76) + '\n');
          
          // Remove duplicates and format
          const seen = new Set();
          logs.forEach(log => {
            const message = typeof log.message === 'string' 
              ? log.message 
              : (log.message || '').toString();
            
            const cleaned = stripAnsi(message).trim();
            if (cleaned && !seen.has(cleaned)) {
              seen.add(cleaned);
              const type = log.type ? `[${log.type.toUpperCase()}]` : '[LOG]';
              console.log(`  ${type}`);
              console.log(message.split('\n').map(line => `    ${line}`).join('\n'));
              console.log('');
            }
          });
        } else {
          console.log('\n  📋 No console output\n');
        }
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('END OF FAILED TESTS');
      console.log('='.repeat(80) + '\n');
    }
  }
}

module.exports = FailuresOnlyReporter;
