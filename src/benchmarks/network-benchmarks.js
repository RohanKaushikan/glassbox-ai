import { runTests } from '../runner.js';
import { OptimizedTestRunner } from '../optimization/optimized-runner.js';
import { CacheManager } from '../cache/cache-manager.js';
import axios from 'axios';
import { platformUtils } from '../utils/platform-utils.js';

/**
 * Network Bandwidth and API Call Efficiency Benchmarks
 * Measures network performance, latency, throughput, and connection efficiency
 */
export class NetworkBenchmarks {
  constructor() {
    this.cacheManager = new CacheManager();
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };
  }

  /**
   * Generate test suite for network testing
   */
  generateNetworkTestSuite(testCount, promptSize = 'medium') {
    const prompts = {
      small: 'Generate a short response.',
      medium: 'Generate a medium-length response with some detail.',
      large: 'Generate a comprehensive response with detailed explanations, examples, and multiple paragraphs. Include technical details, code examples, and thorough analysis.',
      extraLarge: 'Generate an extremely detailed response with comprehensive explanations, multiple code examples, detailed analysis, step-by-step instructions, best practices, common pitfalls, and extensive documentation. This should be a very thorough and complete response.'
    };

    const tests = [];
    
    for (let i = 0; i < testCount; i++) {
      tests.push({
        name: `Network Test ${i + 1} (${promptSize})`,
        description: `Network benchmark test ${i + 1} with ${promptSize} prompt`,
        prompt: prompts[promptSize],
        expect: {
          contains: ['response', 'generated'],
          not_contains: ['error', 'sorry', 'cannot']
        },
        max_tokens: promptSize === 'small' ? 50 : 
                   promptSize === 'medium' ? 150 : 
                   promptSize === 'large' ? 500 : 1000,
        temperature: 0.7
      });
    }

    return {
      name: `network-benchmark-${promptSize}`,
      description: `Network benchmark suite with ${testCount} ${promptSize} tests`,
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
   * Record network request statistics
   */
  recordNetworkRequest(bytes, latency, success = true, timeout = false) {
    this.networkStats.requests++;
    this.networkStats.totalBytes += bytes;
    this.networkStats.latencies.push(latency);
    
    if (!success) {
      this.networkStats.errors++;
    }
    
    if (timeout) {
      this.networkStats.timeouts++;
    }
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    if (this.networkStats.latencies.length === 0) {
      return null;
    }

    const latencies = this.networkStats.latencies;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];

    return {
      requests: this.networkStats.requests,
      totalBytes: this.networkStats.totalBytes,
      totalMB: this.networkStats.totalBytes / (1024 * 1024),
      averageLatency: avgLatency,
      minLatency,
      maxLatency,
      p95Latency,
      p99Latency,
      errors: this.networkStats.errors,
      timeouts: this.networkStats.timeouts,
      errorRate: (this.networkStats.errors / this.networkStats.requests) * 100,
      timeoutRate: (this.networkStats.timeouts / this.networkStats.requests) * 100,
      throughput: (this.networkStats.totalBytes / 1024 / 1024) / (avgLatency / 1000) // MB/s
    };
  }

  /**
   * Benchmark: Network latency measurement
   */
  async benchmarkNetworkLatency() {
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };

    const suite = this.generateNetworkTestSuite(20, 'small');
    const testObjects = [suite];
    
    const startTime = Date.now();
    const results = await runTests(testObjects);
    const endTime = Date.now();
    
    const networkStats = this.getNetworkStats();
    
    return {
      testCount: suite.tests.length,
      totalTime: endTime - startTime,
      executionTime: results.aggregated.summary.totalDuration,
      networkStats,
      successRate: results.aggregated.summary.successRate
    };
  }

  /**
   * Benchmark: Network throughput measurement
   */
  async benchmarkNetworkThroughput() {
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };

    const suite = this.generateNetworkTestSuite(10, 'extraLarge');
    const testObjects = [suite];
    
    const startTime = Date.now();
    const results = await runTests(testObjects);
    const endTime = Date.now();
    
    const networkStats = this.getNetworkStats();
    
    return {
      testCount: suite.tests.length,
      totalTime: endTime - startTime,
      executionTime: results.aggregated.summary.totalDuration,
      networkStats,
      successRate: results.aggregated.summary.successRate,
      dataTransferred: networkStats.totalMB,
      throughput: networkStats.throughput
    };
  }

  /**
   * Benchmark: Connection pooling efficiency
   */
  async benchmarkConnectionPooling() {
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };

    const suite = this.generateNetworkTestSuite(30, 'medium');
    const testObjects = [suite];
    
    // Run with connection pooling (optimized runner)
    const optimizedRunner = new OptimizedTestRunner({
      maxConcurrency: 5,
      batchSize: 10,
      enableStreaming: false,
      enableCaching: false,
      enableProgress: false,
      enableMemoryProfiling: false
    });
    
    const startTime = Date.now();
    const results = await optimizedRunner.runTests(testObjects);
    await optimizedRunner.cleanup();
    const endTime = Date.now();
    
    const networkStats = this.getNetworkStats();
    
    return {
      testCount: suite.tests.length,
      totalTime: endTime - startTime,
      executionTime: results.aggregated.summary.totalDuration,
      networkStats,
      successRate: results.aggregated.summary.successRate,
      averageLatency: networkStats.averageLatency,
      p95Latency: networkStats.p95Latency
    };
  }

  /**
   * Benchmark: API call efficiency with different batch sizes
   */
  async benchmarkBatchSizeEfficiency() {
    const suite = this.generateNetworkTestSuite(40, 'medium');
    const testObjects = [suite];
    
    const batchSizes = [1, 5, 10, 20];
    const results = {};
    
    for (const batchSize of batchSizes) {
      this.networkStats = {
        requests: 0,
        totalBytes: 0,
        latencies: [],
        errors: 0,
        timeouts: 0
      };
      
      const runner = new OptimizedTestRunner({
        maxConcurrency: 5,
        batchSize,
        enableStreaming: false,
        enableCaching: false,
        enableProgress: false,
        enableMemoryProfiling: false
      });
      
      const startTime = Date.now();
      const testResults = await runner.runTests(testObjects);
      await runner.cleanup();
      const endTime = Date.now();
      
      const networkStats = this.getNetworkStats();
      
      results[batchSize] = {
        batchSize,
        executionTime: testResults.aggregated.summary.totalDuration,
        totalTime: endTime - startTime,
        networkStats,
        successRate: testResults.aggregated.summary.successRate,
        requestsPerSecond: networkStats.requests / (testResults.aggregated.summary.totalDuration / 1000)
      };
    }
    
    return results;
  }

  /**
   * Benchmark: Network efficiency with caching
   */
  async benchmarkCachedNetworkEfficiency() {
    const suite = this.generateNetworkTestSuite(20, 'medium');
    const testObjects = [suite];
    
    // Initialize cache
    await this.cacheManager.initialize();
    
    // First run (cache miss)
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };
    
    const firstStartTime = Date.now();
    const firstResults = await runTests(testObjects);
    const firstEndTime = Date.now();
    const firstNetworkStats = this.getNetworkStats();
    
    // Second run (cache hit)
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };
    
    const secondStartTime = Date.now();
    const secondResults = await runTests(testObjects);
    const secondEndTime = Date.now();
    const secondNetworkStats = this.getNetworkStats();
    
    return {
      testCount: suite.tests.length,
      firstRun: {
        executionTime: firstResults.aggregated.summary.totalDuration,
        totalTime: firstEndTime - firstStartTime,
        networkStats: firstNetworkStats,
        successRate: firstResults.aggregated.summary.successRate
      },
      secondRun: {
        executionTime: secondResults.aggregated.summary.totalDuration,
        totalTime: secondEndTime - secondStartTime,
        networkStats: secondNetworkStats,
        successRate: secondResults.aggregated.summary.successRate
      },
      cacheImprovement: {
        executionTime: ((firstResults.aggregated.summary.totalDuration - secondResults.aggregated.summary.totalDuration) / firstResults.aggregated.summary.totalDuration) * 100,
        networkRequests: ((firstNetworkStats.requests - secondNetworkStats.requests) / firstNetworkStats.requests) * 100,
        dataTransferred: ((firstNetworkStats.totalMB - secondNetworkStats.totalMB) / firstNetworkStats.totalMB) * 100
      }
    };
  }

  /**
   * Benchmark: Network error handling and retry efficiency
   */
  async benchmarkNetworkErrorHandling() {
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };

    const suite = this.generateNetworkTestSuite(15, 'small');
    const testObjects = [suite];
    
    // Run with retry configuration
    const results = await runTests(testObjects);
    
    const networkStats = this.getNetworkStats();
    
    return {
      testCount: suite.tests.length,
      executionTime: results.aggregated.summary.totalDuration,
      networkStats,
      successRate: results.aggregated.summary.successRate,
      errorRate: networkStats.errorRate,
      timeoutRate: networkStats.timeoutRate,
      retryAttempts: results.aggregated.reliability.retryAttempts || 0
    };
  }

  /**
   * Benchmark: Streaming vs non-streaming network efficiency
   */
  async benchmarkStreamingEfficiency() {
    const suite = this.generateNetworkTestSuite(20, 'large');
    const testObjects = [suite];
    
    // Non-streaming test
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };
    
    const nonStreamingRunner = new OptimizedTestRunner({
      maxConcurrency: 3,
      batchSize: 5,
      enableStreaming: false,
      enableCaching: false,
      enableProgress: false,
      enableMemoryProfiling: false
    });
    
    const nonStreamingStartTime = Date.now();
    const nonStreamingResults = await nonStreamingRunner.runTests(testObjects);
    await nonStreamingRunner.cleanup();
    const nonStreamingEndTime = Date.now();
    const nonStreamingNetworkStats = this.getNetworkStats();
    
    // Streaming test
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      latencies: [],
      errors: 0,
      timeouts: 0
    };
    
    const streamingRunner = new OptimizedTestRunner({
      maxConcurrency: 3,
      batchSize: 5,
      enableStreaming: true,
      enableCaching: false,
      enableProgress: false,
      enableMemoryProfiling: false
    });
    
    const streamingStartTime = Date.now();
    const streamingResults = await streamingRunner.runTests(testObjects);
    await streamingRunner.cleanup();
    const streamingEndTime = Date.now();
    const streamingNetworkStats = this.getNetworkStats();
    
    return {
      testCount: suite.tests.length,
      nonStreaming: {
        executionTime: nonStreamingResults.aggregated.summary.totalDuration,
        totalTime: nonStreamingEndTime - nonStreamingStartTime,
        networkStats: nonStreamingNetworkStats,
        successRate: nonStreamingResults.aggregated.summary.successRate
      },
      streaming: {
        executionTime: streamingResults.aggregated.summary.totalDuration,
        totalTime: streamingEndTime - streamingStartTime,
        networkStats: streamingNetworkStats,
        successRate: streamingResults.aggregated.summary.successRate
      },
      streamingImprovement: {
        executionTime: ((nonStreamingResults.aggregated.summary.totalDuration - streamingResults.aggregated.summary.totalDuration) / nonStreamingResults.aggregated.summary.totalDuration) * 100,
        totalTime: ((nonStreamingEndTime - nonStreamingStartTime) - (streamingEndTime - streamingStartTime)) / (nonStreamingEndTime - nonStreamingStartTime) * 100
      }
    };
  }

  /**
   * Benchmark: Network performance with different models
   */
  async benchmarkModelNetworkPerformance() {
    const models = ['gpt-3.5-turbo', 'gpt-4'];
    const results = {};
    
    for (const model of models) {
      this.networkStats = {
        requests: 0,
        totalBytes: 0,
        latencies: [],
        errors: 0,
        timeouts: 0
      };
      
      const suite = {
        name: `model-network-${model}`,
        description: `Network benchmark with ${model}`,
        settings: {
          provider: 'openai',
          model,
          timeout_ms: 30000,
          max_retries: 2
        },
        tests: [{
          name: `Model Network Test (${model})`,
          description: `Network test with ${model}`,
          prompt: 'Generate a comprehensive response with detailed explanations.',
          expect: {
            contains: ['response', 'detailed'],
            not_contains: ['error', 'sorry', 'cannot']
          },
          max_tokens: 300,
          temperature: 0.7
        }]
      };
      
      const testObjects = [suite];
      const startTime = Date.now();
      const testResults = await runTests(testObjects);
      const endTime = Date.now();
      
      const networkStats = this.getNetworkStats();
      
      results[model] = {
        model,
        executionTime: testResults.aggregated.summary.totalDuration,
        totalTime: endTime - startTime,
        networkStats,
        successRate: testResults.aggregated.summary.successRate,
        totalCost: testResults.aggregated.summary.totalCost
      };
    }
    
    return results;
  }

  /**
   * Get all network benchmarks
   */
  getBenchmarks() {
    return {
      'Network Latency': {
        fn: () => this.benchmarkNetworkLatency(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'Network Throughput': {
        fn: () => this.benchmarkNetworkThroughput(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Connection Pooling': {
        fn: () => this.benchmarkConnectionPooling(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'Batch Size Efficiency': {
        fn: () => this.benchmarkBatchSizeEfficiency(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cached Network Efficiency': {
        fn: () => this.benchmarkCachedNetworkEfficiency(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Network Error Handling': {
        fn: () => this.benchmarkNetworkErrorHandling(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Streaming Efficiency': {
        fn: () => this.benchmarkStreamingEfficiency(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Model Network Performance': {
        fn: () => this.benchmarkModelNetworkPerformance(),
        options: { iterations: 2, warmupRuns: 1 }
      }
    };
  }
} 