import { runTests } from '../runner.js';
import { parseTestFiles } from '../parser.js';
import { validateInput } from '../validators/input-validator.js';
import { platformUtils } from '../utils/platform-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * VS Code Extension Responsiveness Benchmarks
 * Measures extension performance, command execution, and UI responsiveness
 */
export class VSCodeBenchmarks {
  constructor() {
    this.extensionCommands = [
      'glassbox.runTest',
      'glassbox.validateFile',
      'glassbox.showReport',
      'glassbox.checkHealth'
    ];
  }

  /**
   * Simulate VS Code extension command execution
   */
  async simulateExtensionCommand(command, params = {}) {
    const startTime = performance.now();
    
    try {
      let result;
      
      switch (command) {
        case 'glassbox.runTest':
          result = await this.simulateRunTestCommand(params);
          break;
        case 'glassbox.validateFile':
          result = await this.simulateValidateFileCommand(params);
          break;
        case 'glassbox.showReport':
          result = await this.simulateShowReportCommand(params);
          break;
        case 'glassbox.checkHealth':
          result = await this.simulateCheckHealthCommand(params);
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      
      const endTime = performance.now();
      
      return {
        command,
        success: true,
        executionTime: endTime - startTime,
        result
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        command,
        success: false,
        executionTime: endTime - startTime,
        error: error.message
      };
    }
  }

  /**
   * Simulate runTest command
   */
  async simulateRunTestCommand(params) {
    const { file, suite, reliability = false, metrics = false } = params;
    
    // Simulate file parsing
    const testObjects = await this.generateTestObjects(5);
    
    // Simulate test execution
    const results = await runTests(testObjects);
    
    // Simulate UI update delay
    await this.simulateUIUpdate();
    
    return {
      testCount: results.aggregated.summary.total,
      successRate: results.aggregated.summary.successRate,
      executionTime: results.aggregated.summary.totalDuration
    };
  }

  /**
   * Simulate validateFile command
   */
  async simulateValidateFileCommand(params) {
    const { file, fix = false, strict = false } = params;
    
    // Simulate file reading
    const content = await this.generateTestContent();
    
    // Simulate validation
    const validationResult = await validateInput(content, file, {
      checkAPIConfig: true,
      checkNetwork: true,
      sanitize: fix,
      strict
    });
    
    // Simulate UI update delay
    await this.simulateUIUpdate();
    
    return {
      valid: validationResult.valid,
      errors: validationResult.errors?.length || 0,
      warnings: validationResult.warnings?.length || 0
    };
  }

  /**
   * Simulate showReport command
   */
  async simulateShowReportCommand(params) {
    const { format = 'html', metrics = false } = params;
    
    // Simulate report generation
    const testObjects = await this.generateTestObjects(10);
    const results = await runTests(testObjects);
    
    // Simulate report formatting
    const report = this.generateReport(results, format);
    
    // Simulate UI update delay
    await this.simulateUIUpdate();
    
    return {
      format,
      reportSize: JSON.stringify(report).length,
      testCount: results.aggregated.summary.total
    };
  }

  /**
   * Simulate checkHealth command
   */
  async simulateCheckHealthCommand(params) {
    const { detailed = false } = params;
    
    // Simulate health checks
    const healthChecks = [
      this.checkAPIConfiguration(),
      this.checkNetworkConnectivity(),
      this.checkFileSystem(),
      this.checkCacheStatus()
    ];
    
    const results = await Promise.all(healthChecks);
    
    // Simulate UI update delay
    await this.simulateUIUpdate();
    
    return {
      overall: results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
      checks: results,
      detailed
    };
  }

  /**
   * Simulate UI update delay
   */
  async simulateUIUpdate() {
    // Simulate VS Code UI update delay (typically 16-33ms for 30-60fps)
    await new Promise(resolve => setTimeout(resolve, 16 + Math.random() * 17));
  }

  /**
   * Generate test objects for simulation
   */
  async generateTestObjects(count) {
    const tests = [];
    
    for (let i = 0; i < count; i++) {
      tests.push({
        name: `Simulated Test ${i + 1}`,
        description: `VS Code benchmark test ${i + 1}`,
        prompt: `Generate a response for VS Code extension test ${i + 1}.`,
        expect: {
          contains: ['response', 'test'],
          not_contains: ['error', 'sorry']
        },
        max_tokens: 100,
        temperature: 0.7
      });
    }

    return [{
      name: 'vscode-benchmark-suite',
      description: 'VS Code extension benchmark suite',
      settings: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        timeout_ms: 30000,
        max_retries: 2
      },
      tests
    }];
  }

  /**
   * Generate test content for validation
   */
  async generateTestContent() {
    return `name: "VS Code Benchmark Test"
description: "Test for VS Code extension responsiveness"

settings:
  provider: "openai"
  model: "gpt-3.5-turbo"
  timeout_ms: 30000

tests:
  - name: "Extension Test"
    description: "Test extension responsiveness"
    prompt: "Generate a response for VS Code extension test."
    expect:
      contains: ["response", "test"]
      not_contains: ["error", "sorry"]
    max_tokens: 100
    temperature: 0.7`;
  }

  /**
   * Generate report for simulation
   */
  generateReport(results, format) {
    const baseReport = {
      summary: results.aggregated.summary,
      tests: results.raw,
      timestamp: new Date().toISOString()
    };
    
    switch (format) {
      case 'html':
        return `<html><body><h1>Test Report</h1><p>Tests: ${baseReport.summary.total}</p></body></html>`;
      case 'json':
        return JSON.stringify(baseReport, null, 2);
      case 'csv':
        return 'Test,Status,Duration\nTest1,Pass,100ms';
      default:
        return baseReport;
    }
  }

  /**
   * Simulate health checks
   */
  async checkAPIConfiguration() {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    return {
      name: 'API Configuration',
      status: 'healthy',
      details: 'API keys configured correctly'
    };
  }

  async checkNetworkConnectivity() {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    return {
      name: 'Network Connectivity',
      status: 'healthy',
      details: 'Network connection stable'
    };
  }

  async checkFileSystem() {
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 50));
    return {
      name: 'File System',
      status: 'healthy',
      details: 'File system accessible'
    };
  }

  async checkCacheStatus() {
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70));
    return {
      name: 'Cache Status',
      status: 'healthy',
      details: 'Cache operational'
    };
  }

  /**
   * Benchmark: Extension command responsiveness
   */
  async benchmarkCommandResponsiveness() {
    const results = {};
    
    for (const command of this.extensionCommands) {
      const commandResults = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await this.simulateExtensionCommand(command);
        commandResults.push(result);
      }
      
      const executionTimes = commandResults.map(r => r.executionTime);
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const minTime = Math.min(...executionTimes);
      const maxTime = Math.max(...executionTimes);
      
      results[command] = {
        command,
        averageTime: avgTime,
        minTime,
        maxTime,
        successRate: (commandResults.filter(r => r.success).length / commandResults.length) * 100,
        results: commandResults
      };
    }
    
    return results;
  }

  /**
   * Benchmark: UI update responsiveness
   */
  async benchmarkUIResponsiveness() {
    const uiUpdateTimes = [];
    
    for (let i = 0; i < 20; i++) {
      const startTime = performance.now();
      await this.simulateUIUpdate();
      const endTime = performance.now();
      uiUpdateTimes.push(endTime - startTime);
    }
    
    const avgTime = uiUpdateTimes.reduce((a, b) => a + b, 0) / uiUpdateTimes.length;
    const minTime = Math.min(...uiUpdateTimes);
    const maxTime = Math.max(...uiUpdateTimes);
    
    return {
      averageUpdateTime: avgTime,
      minUpdateTime: minTime,
      maxUpdateTime: maxTime,
      updateTimes: uiUpdateTimes,
      smoothness: avgTime <= 16.67 ? 'excellent' : avgTime <= 33.33 ? 'good' : 'poor'
    };
  }

  /**
   * Benchmark: Extension startup time
   */
  async benchmarkExtensionStartup() {
    const startupTimes = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      
      // Simulate extension activation
      await this.simulateExtensionActivation();
      
      const endTime = performance.now();
      startupTimes.push(endTime - startTime);
    }
    
    const avgTime = startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length;
    const minTime = Math.min(...startupTimes);
    const maxTime = Math.max(...startupTimes);
    
    return {
      averageStartupTime: avgTime,
      minStartupTime: minTime,
      maxStartupTime: maxTime,
      startupTimes,
      performance: avgTime <= 100 ? 'excellent' : avgTime <= 500 ? 'good' : 'poor'
    };
  }

  /**
   * Simulate extension activation
   */
  async simulateExtensionActivation() {
    // Simulate various activation tasks
    await Promise.all([
      this.loadConfiguration(),
      this.initializeAPIClients(),
      this.setupEventListeners(),
      this.registerCommands()
    ]);
  }

  async loadConfiguration() {
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
  }

  async initializeAPIClients() {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  }

  async setupEventListeners() {
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }

  async registerCommands() {
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
  }

  /**
   * Benchmark: File validation performance
   */
  async benchmarkFileValidation() {
    const validationTimes = [];
    const fileSizes = [1, 5, 10, 20, 50];
    
    for (const size of fileSizes) {
      const content = await this.generateLargeTestContent(size);
      
      const startTime = performance.now();
      const validationResult = await validateInput(content, 'test.yml', {
        checkAPIConfig: true,
        checkNetwork: true,
        sanitize: false,
        strict: true
      });
      const endTime = performance.now();
      
      validationTimes.push({
        fileSize: size,
        validationTime: endTime - startTime,
        valid: validationResult.valid,
        errors: validationResult.errors?.length || 0
      });
    }
    
    const avgTime = validationTimes.reduce((sum, v) => sum + v.validationTime, 0) / validationTimes.length;
    
    return {
      averageValidationTime: avgTime,
      validationTimes,
      performance: avgTime <= 100 ? 'excellent' : avgTime <= 500 ? 'good' : 'poor'
    };
  }

  /**
   * Generate large test content
   */
  async generateLargeTestContent(testCount) {
    let content = `name: "Large Test Suite"
description: "Large test suite for validation performance"

settings:
  provider: "openai"
  model: "gpt-3.5-turbo"
  timeout_ms: 30000

tests:
`;

    for (let i = 0; i < testCount; i++) {
      content += `  - name: "Test ${i + 1}"
    description: "Large test ${i + 1}"
    prompt: "Generate a comprehensive response for test ${i + 1} with detailed explanations and examples."
    expect:
      contains: ["response", "detailed", "explanation"]
      not_contains: ["error", "sorry"]
    max_tokens: 300
    temperature: 0.7

`;
    }
    
    return content;
  }

  /**
   * Benchmark: Extension memory usage
   */
  async benchmarkExtensionMemory() {
    const memorySnapshots = [];
    
    // Take initial snapshot
    const initialUsage = process.memoryUsage();
    memorySnapshots.push({
      label: 'initial',
      rss: initialUsage.rss,
      heapUsed: initialUsage.heapUsed,
      heapTotal: initialUsage.heapTotal
    });
    
    // Simulate extension usage
    for (let i = 0; i < 10; i++) {
      await this.simulateExtensionCommand('glassbox.runTest', { file: 'test.yml' });
      
      const usage = process.memoryUsage();
      memorySnapshots.push({
        label: `after-command-${i + 1}`,
        rss: usage.rss,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal
      });
    }
    
    // Calculate memory growth
    const initialRss = memorySnapshots[0].rss;
    const finalRss = memorySnapshots[memorySnapshots.length - 1].rss;
    const memoryGrowth = finalRss - initialRss;
    
    return {
      memorySnapshots,
      initialMemory: initialRss,
      finalMemory: finalRss,
      memoryGrowth,
      memoryGrowthMB: memoryGrowth / (1024 * 1024),
      isMemoryLeak: memoryGrowth > 10 * 1024 * 1024 // 10MB threshold
    };
  }

  /**
   * Get all VS Code benchmarks
   */
  getBenchmarks() {
    return {
      'Extension Command Responsiveness': {
        fn: () => this.benchmarkCommandResponsiveness(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'UI Update Responsiveness': {
        fn: () => this.benchmarkUIResponsiveness(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Extension Startup Time': {
        fn: () => this.benchmarkExtensionStartup(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'File Validation Performance': {
        fn: () => this.benchmarkFileValidation(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Extension Memory Usage': {
        fn: () => this.benchmarkExtensionMemory(),
        options: { iterations: 2, warmupRuns: 1 }
      }
    };
  }
} 