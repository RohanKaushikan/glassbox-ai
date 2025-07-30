import { parseTestFiles } from '../parser.js';
import { runTests } from '../runner.js';
import { runTests as runTestsCached } from '../runner-cached.js';
import { OptimizedTestRunner } from '../optimization/optimized-runner.js';
import { platformUtils } from '../utils/platform-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Test Execution Performance Benchmarks
 * Measures execution time for different suite sizes and configurations
 */
export class TestExecutionBenchmarks {
  constructor() {
    this.testSuites = {
      small: this.generateTestSuite(5, 'small'),
      medium: this.generateTestSuite(25, 'medium'),
      large: this.generateTestSuite(100, 'large'),
      extraLarge: this.generateTestSuite(500, 'extra-large')
    };
  }

  /**
   * Generate test suite with specified number of tests
   */
  generateTestSuite(testCount, name) {
    const tests = [];
    
    for (let i = 0; i < testCount; i++) {
      tests.push({
        name: `Test ${i + 1}`,
        description: `Generated test ${i + 1} for ${name} suite`,
        prompt: `Generate a response for test ${i + 1}. This is a ${name} test suite with ${testCount} tests.`,
        expect: {
          contains: ['response', 'test', 'generated'],
          not_contains: ['error', 'sorry', 'cannot']
        },
        max_tokens: 100,
        temperature: 0.7
      });
    }

    return {
      name: `${name}-suite`,
      description: `${name} test suite with ${testCount} tests`,
      settings: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        timeout_ms: 30000,
        max_retries: 2
      },
      tests
    };
  }

  /**
   * Save test suite to file
   */
  async saveTestSuite(suite, filename) {
    const testDir = platformUtils.joinPaths(process.cwd(), '.benchmark-tests');
    await fs.promises.mkdir(testDir, { recursive: true });
    
    const filepath = platformUtils.joinPaths(testDir, filename);
    const content = JSON.stringify(suite, null, 2);
    await fs.promises.writeFile(filepath, content);
    
    return filepath;
  }

  /**
   * Benchmark: Small test suite execution
   */
  async benchmarkSmallSuite() {
    const suite = this.testSuites.small;
    const filepath = await this.saveTestSuite(suite, 'small-suite.json');
    
    const testObjects = [suite];
    const results = await runTests(testObjects);
    
    return {
      suiteSize: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      successRate: results.aggregated.summary.successRate,
      totalTests: results.aggregated.summary.total
    };
  }

  /**
   * Benchmark: Medium test suite execution
   */
  async benchmarkMediumSuite() {
    const suite = this.testSuites.medium;
    const filepath = await this.saveTestSuite(suite, 'medium-suite.json');
    
    const testObjects = [suite];
    const results = await runTests(testObjects);
    
    return {
      suiteSize: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      successRate: results.aggregated.summary.successRate,
      totalTests: results.aggregated.summary.total
    };
  }

  /**
   * Benchmark: Large test suite execution
   */
  async benchmarkLargeSuite() {
    const suite = this.testSuites.large;
    const filepath = await this.saveTestSuite(suite, 'large-suite.json');
    
    const testObjects = [suite];
    const results = await runTests(testObjects);
    
    return {
      suiteSize: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      successRate: results.aggregated.summary.successRate,
      totalTests: results.aggregated.summary.total
    };
  }

  /**
   * Benchmark: Extra large test suite execution
   */
  async benchmarkExtraLargeSuite() {
    const suite = this.testSuites.extraLarge;
    const filepath = await this.saveTestSuite(suite, 'extra-large-suite.json');
    
    const testObjects = [suite];
    const results = await runTests(testObjects);
    
    return {
      suiteSize: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      successRate: results.aggregated.summary.successRate,
      totalTests: results.aggregated.summary.total
    };
  }

  /**
   * Benchmark: Cached test execution
   */
  async benchmarkCachedExecution() {
    const suite = this.testSuites.medium;
    const filepath = await this.saveTestSuite(suite, 'cached-suite.json');
    
    const testObjects = [suite];
    
    // First run (cache miss)
    const firstResults = await runTestsCached(testObjects);
    
    // Second run (cache hit)
    const secondResults = await runTestsCached(testObjects);
    
    return {
      suiteSize: suite.tests.length,
      firstRunTime: firstResults.aggregated.summary.totalDuration,
      secondRunTime: secondResults.aggregated.summary.totalDuration,
      cacheImprovement: ((firstResults.aggregated.summary.totalDuration - secondResults.aggregated.summary.totalDuration) / firstResults.aggregated.summary.totalDuration) * 100
    };
  }

  /**
   * Benchmark: Optimized runner execution
   */
  async benchmarkOptimizedExecution() {
    const suite = this.testSuites.large;
    const filepath = await this.saveTestSuite(suite, 'optimized-suite.json');
    
    const testObjects = [suite];
    
    // Standard runner
    const standardResults = await runTests(testObjects);
    
    // Optimized runner
    const optimizedRunner = new OptimizedTestRunner({
      maxConcurrency: 5,
      batchSize: 10,
      enableStreaming: false,
      enableCaching: true,
      enableProgress: false,
      enableMemoryProfiling: false
    });
    
    const optimizedResults = await optimizedRunner.runTests(testObjects);
    await optimizedRunner.cleanup();
    
    return {
      suiteSize: suite.tests.length,
      standardTime: standardResults.aggregated.summary.totalDuration,
      optimizedTime: optimizedResults.aggregated.summary.totalDuration,
      optimizationImprovement: ((standardResults.aggregated.summary.totalDuration - optimizedResults.aggregated.summary.totalDuration) / standardResults.aggregated.summary.totalDuration) * 100
    };
  }

  /**
   * Benchmark: Parallel vs sequential execution
   */
  async benchmarkParallelExecution() {
    const suite = this.testSuites.medium;
    const filepath = await this.saveTestSuite(suite, 'parallel-suite.json');
    
    const testObjects = [suite];
    
    // Sequential execution (concurrency: 1)
    const sequentialRunner = new OptimizedTestRunner({
      maxConcurrency: 1,
      batchSize: 1,
      enableStreaming: false,
      enableCaching: false,
      enableProgress: false,
      enableMemoryProfiling: false
    });
    
    const sequentialResults = await sequentialRunner.runTests(testObjects);
    await sequentialRunner.cleanup();
    
    // Parallel execution (concurrency: 5)
    const parallelRunner = new OptimizedTestRunner({
      maxConcurrency: 5,
      batchSize: 10,
      enableStreaming: false,
      enableCaching: false,
      enableProgress: false,
      enableMemoryProfiling: false
    });
    
    const parallelResults = await parallelRunner.runTests(testObjects);
    await parallelRunner.cleanup();
    
    return {
      suiteSize: suite.tests.length,
      sequentialTime: sequentialResults.aggregated.summary.totalDuration,
      parallelTime: parallelResults.aggregated.summary.totalDuration,
      parallelizationImprovement: ((sequentialResults.aggregated.summary.totalDuration - parallelResults.aggregated.summary.totalDuration) / sequentialResults.aggregated.summary.totalDuration) * 100
    };
  }

  /**
   * Benchmark: Different model performance
   */
  async benchmarkModelPerformance() {
    const suite = this.testSuites.small;
    const filepath = await this.saveTestSuite(suite, 'model-suite.json');
    
    const testObjects = [suite];
    
    // Test with different models
    const models = ['gpt-3.5-turbo', 'gpt-4'];
    const results = {};
    
    for (const model of models) {
      const modelSuite = {
        ...suite,
        settings: {
          ...suite.settings,
          model
        }
      };
      
      const modelResults = await runTests([modelSuite]);
      results[model] = {
        executionTime: modelResults.aggregated.summary.totalDuration,
        successRate: modelResults.aggregated.summary.successRate,
        totalCost: modelResults.aggregated.summary.totalCost
      };
    }
    
    return results;
  }

  /**
   * Get all test execution benchmarks
   */
  getBenchmarks() {
    return {
      'Small Suite (5 tests)': {
        fn: () => this.benchmarkSmallSuite(),
        options: { iterations: 5, warmupRuns: 2 }
      },
      'Medium Suite (25 tests)': {
        fn: () => this.benchmarkMediumSuite(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'Large Suite (100 tests)': {
        fn: () => this.benchmarkLargeSuite(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Extra Large Suite (500 tests)': {
        fn: () => this.benchmarkExtraLargeSuite(),
        options: { iterations: 1, warmupRuns: 0 }
      },
      'Cached Execution': {
        fn: () => this.benchmarkCachedExecution(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'Optimized Runner': {
        fn: () => this.benchmarkOptimizedExecution(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Parallel vs Sequential': {
        fn: () => this.benchmarkParallelExecution(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Model Performance Comparison': {
        fn: () => this.benchmarkModelPerformance(),
        options: { iterations: 2, warmupRuns: 1 }
      }
    };
  }
} 