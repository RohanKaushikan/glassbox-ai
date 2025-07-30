import { runTests } from '../runner.js';
import { OptimizedTestRunner } from '../optimization/optimized-runner.js';
import { CacheManager } from '../cache/cache-manager.js';
import { platformUtils } from '../utils/platform-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Memory Usage Performance Benchmarks
 * Measures memory usage during large test runs and detects memory leaks
 */
export class MemoryBenchmarks {
  constructor() {
    this.cacheManager = new CacheManager();
    this.memorySnapshots = [];
  }

  /**
   * Generate large test suite for memory testing
   */
  generateLargeTestSuite(testCount) {
    const tests = [];
    
    for (let i = 0; i < testCount; i++) {
      tests.push({
        name: `Memory Test ${i + 1}`,
        description: `Memory benchmark test ${i + 1}`,
        prompt: `Generate a detailed response for memory test ${i + 1}. This should be a comprehensive response that uses significant memory. Include multiple paragraphs with detailed explanations, examples, and code snippets.`,
        expect: {
          contains: ['response', 'detailed', 'explanation'],
          not_contains: ['error', 'sorry', 'cannot']
        },
        max_tokens: 500,
        temperature: 0.7
      });
    }

    return {
      name: 'memory-benchmark-suite',
      description: `Memory benchmark suite with ${testCount} tests`,
      settings: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        timeout_ms: 60000,
        max_retries: 2
      },
      tests
    };
  }

  /**
   * Take memory snapshot
   */
  takeMemorySnapshot(label) {
    const usage = process.memoryUsage();
    const snapshot = {
      label,
      timestamp: Date.now(),
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0
    };
    
    this.memorySnapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get memory statistics from snapshots
   */
  getMemoryStats() {
    if (this.memorySnapshots.length < 2) {
      return null;
    }

    const snapshots = this.memorySnapshots;
    const rssValues = snapshots.map(s => s.rss);
    const heapUsedValues = snapshots.map(s => s.heapUsed);
    const heapTotalValues = snapshots.map(s => s.heapTotal);

    return {
      snapshots: snapshots.length,
      duration: snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp,
      rss: {
        start: snapshots[0].rss,
        end: snapshots[snapshots.length - 1].rss,
        peak: Math.max(...rssValues),
        growth: snapshots[snapshots.length - 1].rss - snapshots[0].rss,
        growthRate: (snapshots[snapshots.length - 1].rss - snapshots[0].rss) / (snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp)
      },
      heapUsed: {
        start: snapshots[0].heapUsed,
        end: snapshots[snapshots.length - 1].heapUsed,
        peak: Math.max(...heapUsedValues),
        growth: snapshots[snapshots.length - 1].heapUsed - snapshots[0].heapUsed
      },
      heapTotal: {
        start: snapshots[0].heapTotal,
        end: snapshots[snapshots.length - 1].heapTotal,
        peak: Math.max(...heapTotalValues),
        growth: snapshots[snapshots.length - 1].heapTotal - snapshots[0].heapTotal
      }
    };
  }

  /**
   * Benchmark: Memory usage during large test runs
   */
  async benchmarkLargeTestMemory() {
    this.memorySnapshots = [];
    
    const suite = this.generateLargeTestSuite(50);
    const testObjects = [suite];
    
    // Take initial snapshot
    this.takeMemorySnapshot('before-test');
    
    // Run tests
    const results = await runTests(testObjects);
    
    // Take final snapshot
    this.takeMemorySnapshot('after-test');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.takeMemorySnapshot('after-gc');
    }
    
    const memoryStats = this.getMemoryStats();
    
    return {
      testCount: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      memoryStats,
      successRate: results.aggregated.summary.successRate
    };
  }

  /**
   * Benchmark: Memory usage with optimized runner
   */
  async benchmarkOptimizedRunnerMemory() {
    this.memorySnapshots = [];
    
    const suite = this.generateLargeTestSuite(50);
    const testObjects = [suite];
    
    // Take initial snapshot
    this.takeMemorySnapshot('before-optimized-test');
    
    // Run with optimized runner
    const optimizedRunner = new OptimizedTestRunner({
      maxConcurrency: 5,
      batchSize: 10,
      enableStreaming: false,
      enableCaching: true,
      enableProgress: false,
      enableMemoryProfiling: true
    });
    
    const results = await optimizedRunner.runTests(testObjects);
    await optimizedRunner.cleanup();
    
    // Take final snapshot
    this.takeMemorySnapshot('after-optimized-test');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.takeMemorySnapshot('after-optimized-gc');
    }
    
    const memoryStats = this.getMemoryStats();
    
    return {
      testCount: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      memoryStats,
      successRate: results.aggregated.summary.successRate
    };
  }

  /**
   * Benchmark: Memory usage with caching
   */
  async benchmarkCachedMemory() {
    this.memorySnapshots = [];
    
    const suite = this.generateLargeTestSuite(25);
    const testObjects = [suite];
    
    // Initialize cache
    await this.cacheManager.initialize();
    
    // Take initial snapshot
    this.takeMemorySnapshot('before-cached-test');
    
    // First run (cache miss)
    const firstResults = await runTests(testObjects);
    this.takeMemorySnapshot('after-first-run');
    
    // Second run (cache hit)
    const secondResults = await runTests(testObjects);
    this.takeMemorySnapshot('after-second-run');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.takeMemorySnapshot('after-cached-gc');
    }
    
    const memoryStats = this.getMemoryStats();
    
    return {
      testCount: suite.tests.length,
      firstRunTime: firstResults.aggregated.summary.totalDuration,
      secondRunTime: secondResults.aggregated.summary.totalDuration,
      memoryStats,
      cacheImprovement: ((firstResults.aggregated.summary.totalDuration - secondResults.aggregated.summary.totalDuration) / firstResults.aggregated.summary.totalDuration) * 100
    };
  }

  /**
   * Benchmark: Memory leak detection
   */
  async benchmarkMemoryLeakDetection() {
    this.memorySnapshots = [];
    
    const suite = this.generateLargeTestSuite(10);
    const testObjects = [suite];
    
    const iterations = 5;
    const memoryGrowth = [];
    
    for (let i = 0; i < iterations; i++) {
      // Take snapshot before iteration
      this.takeMemorySnapshot(`iteration-${i}-before`);
      
      // Run tests
      const results = await runTests(testObjects);
      
      // Take snapshot after iteration
      this.takeMemorySnapshot(`iteration-${i}-after`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.takeMemorySnapshot(`iteration-${i}-after-gc`);
      }
      
      // Calculate memory growth for this iteration
      const beforeSnapshot = this.memorySnapshots[this.memorySnapshots.length - 3];
      const afterSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
      
      memoryGrowth.push({
        iteration: i + 1,
        rssGrowth: afterSnapshot.rss - beforeSnapshot.rss,
        heapUsedGrowth: afterSnapshot.heapUsed - beforeSnapshot.heapUsed,
        heapTotalGrowth: afterSnapshot.heapTotal - beforeSnapshot.heapTotal
      });
    }
    
    // Calculate overall memory growth trend
    const rssGrowthTrend = memoryGrowth.map(m => m.rssGrowth);
    const heapUsedGrowthTrend = memoryGrowth.map(m => m.heapUsedGrowth);
    
    const isMemoryLeak = rssGrowthTrend.some(growth => growth > 1024 * 1024); // 1MB threshold
    
    return {
      iterations,
      memoryGrowth,
      isMemoryLeak,
      averageRssGrowth: rssGrowthTrend.reduce((a, b) => a + b, 0) / rssGrowthTrend.length,
      averageHeapUsedGrowth: heapUsedGrowthTrend.reduce((a, b) => a + b, 0) / heapUsedGrowthTrend.length
    };
  }

  /**
   * Benchmark: Memory usage with different concurrency levels
   */
  async benchmarkConcurrencyMemory() {
    this.memorySnapshots = [];
    
    const suite = this.generateLargeTestSuite(30);
    const testObjects = [suite];
    
    const concurrencyLevels = [1, 3, 5, 10];
    const results = {};
    
    for (const concurrency of concurrencyLevels) {
      this.memorySnapshots = [];
      
      // Take initial snapshot
      this.takeMemorySnapshot(`concurrency-${concurrency}-before`);
      
      // Run with specific concurrency
      const runner = new OptimizedTestRunner({
        maxConcurrency: concurrency,
        batchSize: Math.max(1, Math.floor(30 / concurrency)),
        enableStreaming: false,
        enableCaching: false,
        enableProgress: false,
        enableMemoryProfiling: false
      });
      
      const testResults = await runner.runTests(testObjects);
      await runner.cleanup();
      
      // Take final snapshot
      this.takeMemorySnapshot(`concurrency-${concurrency}-after`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.takeMemorySnapshot(`concurrency-${concurrency}-after-gc`);
      }
      
      const memoryStats = this.getMemoryStats();
      
      results[concurrency] = {
        executionTime: testResults.aggregated.summary.totalDuration,
        memoryStats,
        successRate: testResults.aggregated.summary.successRate
      };
    }
    
    return results;
  }

  /**
   * Benchmark: Memory usage with streaming responses
   */
  async benchmarkStreamingMemory() {
    this.memorySnapshots = [];
    
    const suite = this.generateLargeTestSuite(20);
    const testObjects = [suite];
    
    // Take initial snapshot
    this.takeMemorySnapshot('before-streaming-test');
    
    // Run with streaming enabled
    const streamingRunner = new OptimizedTestRunner({
      maxConcurrency: 3,
      batchSize: 5,
      enableStreaming: true,
      enableCaching: false,
      enableProgress: false,
      enableMemoryProfiling: true
    });
    
    const results = await streamingRunner.runTests(testObjects);
    await streamingRunner.cleanup();
    
    // Take final snapshot
    this.takeMemorySnapshot('after-streaming-test');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.takeMemorySnapshot('after-streaming-gc');
    }
    
    const memoryStats = this.getMemoryStats();
    
    return {
      testCount: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      memoryStats,
      successRate: results.aggregated.summary.successRate
    };
  }

  /**
   * Benchmark: Memory usage with different response sizes
   */
  async benchmarkResponseSizeMemory() {
    this.memorySnapshots = [];
    
    const responseSizes = [100, 500, 1000, 2000];
    const results = {};
    
    for (const maxTokens of responseSizes) {
      this.memorySnapshots = [];
      
      const suite = {
        name: `response-size-${maxTokens}`,
        description: `Test suite with ${maxTokens} max tokens`,
        settings: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          timeout_ms: 60000,
          max_retries: 2
        },
        tests: [{
          name: `Response Size Test (${maxTokens} tokens)`,
          description: `Test with ${maxTokens} max tokens`,
          prompt: `Generate a detailed response with approximately ${maxTokens} tokens. Include comprehensive explanations, examples, and detailed information.`,
          expect: {
            contains: ['detailed', 'comprehensive', 'explanation'],
            not_contains: ['error', 'sorry', 'cannot']
          },
          max_tokens: maxTokens,
          temperature: 0.7
        }]
      };
      
      const testObjects = [suite];
      
      // Take initial snapshot
      this.takeMemorySnapshot(`response-size-${maxTokens}-before`);
      
      // Run test
      const testResults = await runTests(testObjects);
      
      // Take final snapshot
      this.takeMemorySnapshot(`response-size-${maxTokens}-after`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.takeMemorySnapshot(`response-size-${maxTokens}-after-gc`);
      }
      
      const memoryStats = this.getMemoryStats();
      
      results[maxTokens] = {
        maxTokens,
        executionTime: testResults.aggregated.summary.totalDuration,
        memoryStats,
        successRate: testResults.aggregated.summary.successRate
      };
    }
    
    return results;
  }

  /**
   * Get all memory benchmarks
   */
  getBenchmarks() {
    return {
      'Large Test Memory Usage': {
        fn: () => this.benchmarkLargeTestMemory(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'Optimized Runner Memory': {
        fn: () => this.benchmarkOptimizedRunnerMemory(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cached Memory Usage': {
        fn: () => this.benchmarkCachedMemory(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Memory Leak Detection': {
        fn: () => this.benchmarkMemoryLeakDetection(),
        options: { iterations: 1, warmupRuns: 0 }
      },
      'Concurrency Memory Usage': {
        fn: () => this.benchmarkConcurrencyMemory(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Streaming Memory Usage': {
        fn: () => this.benchmarkStreamingMemory(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Response Size Memory Usage': {
        fn: () => this.benchmarkResponseSizeMemory(),
        options: { iterations: 2, warmupRuns: 1 }
      }
    };
  }
} 