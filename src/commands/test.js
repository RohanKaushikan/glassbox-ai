import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { runTests } from '../runner-reliable.js';
import { platformUtils } from '../utils/platform-utils.js';

/**
 * Parse a YAML test file
 * @param {string} filePath - Path to the YAML file
 * @returns {object} Parsed test configuration
 */
function parseTestFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const parsed = parse(content);
    
    // Validate required fields
    if (!parsed.name) {
      throw new Error(`Test file missing 'name' field: ${filePath}`);
    }
    if (!parsed.tests || !Array.isArray(parsed.tests)) {
      throw new Error(`Test file missing 'tests' array: ${filePath}`);
    }
    
    // Validate each test
    for (const test of parsed.tests) {
      if (!test.name) {
        throw new Error(`Test missing 'name' field in ${filePath}`);
      }
      if (!test.prompt) {
        throw new Error(`Test missing 'prompt' field in ${filePath}`);
      }
      if (!test.expect) {
        throw new Error(`Test missing 'expect' field in ${filePath}`);
      }
    }
    
    return parsed;
  } catch (error) {
    if (error.name === 'YAMLException') {
      throw new Error(`Invalid YAML in ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Find all test files in the .glassbox directory
 * @returns {Array<string>} Array of test file paths
 */
function findTestFiles() {
  const glassboxDir = platformUtils.joinPaths(process.cwd(), '.glassbox');
  const testFiles = [];
  
  try {
    const files = readdirSync(glassboxDir);
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        testFiles.push(platformUtils.joinPaths(glassboxDir, file));
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`No .glassbox directory found. Run 'glassbox init' to create sample tests.`);
    }
    throw error;
  }
  
  if (testFiles.length === 0) {
    throw new Error(`No test files found in .glassbox directory. Run 'glassbox init' to create sample tests.`);
  }
  
  return testFiles;
}

/**
 * Main test command with enterprise reliability features
 */
export async function testCommand() {
  try {
    console.log('🔍 Enterprise-Grade AI Testing with Reliability Features');
    console.log('=' .repeat(60));
    
    // Find and parse test files
    const testFilePaths = findTestFiles();
    console.log(`📁 Found ${testFilePaths.length} test file(s)`);
    
    const testObjects = [];
    let totalTests = 0;
    
    for (const filePath of testFilePaths) {
      try {
        const testConfig = parseTestFile(filePath);
        testObjects.push(testConfig);
        totalTests += testConfig.tests.length;
        console.log(`✅ Loaded ${testConfig.tests.length} tests from ${testConfig.name}`);
      } catch (error) {
        console.error(`❌ Failed to load ${filePath}: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`\n🚀 Starting ${totalTests} tests with enterprise reliability features...`);
    console.log('📊 Features enabled:');
    console.log('   • Exponential backoff with jitter');
    console.log('   • Circuit breaker pattern');
    console.log('   • Fallback mechanisms');
    console.log('   • Health checks and monitoring');
    console.log('   • Request queuing and throttling');
    console.log('   • Detailed metrics and observability');
    console.log('   • Graceful shutdown procedures');
    console.log('');
    
    // Run tests with reliability features
    const startTime = Date.now();
    const results = await runTests(testObjects);
    const totalDuration = Date.now() - startTime;
    
    // Display final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 ENTERPRISE RELIABILITY TEST COMPLETION');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📈 Success Rate: ${results.aggregated.summary.successRate.toFixed(1)}%`);
    console.log(`🔧 Reliability Status: ${results.aggregated.reliability.healthStatus.toUpperCase()}`);
    console.log(`🔄 Circuit Breaker Trips: ${results.aggregated.reliability.circuitBreakerTrips}`);
    console.log(`🛡️  Fallback Usage: ${results.aggregated.reliability.fallbackUsage}`);
    console.log(`🔄 Total Retry Attempts: ${results.aggregated.reliability.retryAttempts}`);
    
    // Exit with appropriate code
    if (results.aggregated.summary.failed > 0) {
      console.log('\n❌ Some tests failed. Check the output above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
} 