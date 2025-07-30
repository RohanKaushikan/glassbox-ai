import { OptimizedAPIClient } from './optimized-api-client.js';
import { OptimizedParser } from './optimized-parser.js';
import { globalProgressManager } from './progress-manager.js';
import { globalMemoryProfiler } from './memory-profiler.js';
import { validateContent } from '../validators/content-validator.js';
import { detectPII } from '../validators/pii-detector.js';
import { calculateRequestCost } from '../validators/cost-calculator.js';
import { createCachedClient } from '../cache/cache-integration.js';
import { CacheConfig } from '../cache/cache-config.js';

/**
 * Optimized Test Runner with all performance optimizations
 */
export class OptimizedTestRunner {
  constructor(options = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency || 5,
      batchSize: options.batchSize || 10,
      enableStreaming: options.enableStreaming !== false,
      enableCaching: options.enableCaching !== false,
      enableProgress: options.enableProgress !== false,
      enableMemoryProfiling: options.enableMemoryProfiling !== false,
      ...options
    };
    
    this.apiClients = new Map();
    this.parser = new OptimizedParser({
      cacheSize: 100,
      batchSize: this.options.batchSize,
      lazyLoad: true,
      validateOnLoad: true
    });
    
    this.cacheConfig = null;
    this.stats = {
      totalTests: 0,
      completedTests: 0,
      failedTests: 0,
      cachedResponses: 0,
      averageResponseTime: 0,
      memoryUsage: 0
    };
    
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for monitoring
   */
  setupEventListeners() {
    // Parser events
    this.parser.on('batch-start', (data) => {
      if (this.options.enableProgress) {
        globalProgressManager.startOperation(
          `parse-batch-${data.batchIndex}`,
          `Parsing batch ${data.batchIndex + 1}/${data.totalBatches}`,
          { total: data.files.length, showProgressBar: true }
        );
      }
    });

    this.parser.on('batch-complete', (data) => {
      if (this.options.enableProgress) {
        globalProgressManager.completeOperation(`parse-batch-${data.batchIndex}`, data.results);
      }
    });

    this.parser.on('file-parsed', (data) => {
      if (this.options.enableProgress) {
        globalProgressManager.updateProgress(`parse-batch-${data.batchIndex}`, data.index + 1);
      }
    });

    // Memory profiling events
    if (this.options.enableMemoryProfiling) {
      globalMemoryProfiler.on('memory-leak-detected', (data) => {
        console.warn('Memory leak detected:', data.recommendation);
      });

      globalMemoryProfiler.on('snapshot-taken', (snapshot) => {
        this.stats.memoryUsage = snapshot.heapUsed;
      });
    }
  }

  /**
   * Initialize the test runner
   */
  async initialize() {
    // Initialize cache if enabled
    if (this.options.enableCaching) {
      this.cacheConfig = new CacheConfig();
      await this.cacheConfig.load();
    }

    // Start memory profiling if enabled
    if (this.options.enableMemoryProfiling) {
      globalMemoryProfiler.start();
    }

    // Initialize API clients
    await this.initializeAPIClients();
  }

  /**
   * Initialize API clients with connection pooling
   */
  async initializeAPIClients() {
    const providers = [
      {
        name: 'openai',
        baseURL: 'https://api.openai.com',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-3.5-turbo'
      },
      {
        name: 'ollama',
        baseURL: 'http://localhost:11434',
        apiKey: null,
        defaultModel: 'mistral:7b'
      }
    ];

    for (const provider of providers) {
      if (provider.apiKey || provider.name === 'ollama') {
        const client = new OptimizedAPIClient(provider.name, {
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          defaultModel: provider.defaultModel,
          maxConcurrentRequests: this.options.maxConcurrency
        });

        // Wrap with caching if enabled
        if (this.options.enableCaching) {
          const cachedClient = createCachedClient(client, this.cacheConfig.getCacheOptions());
          this.apiClients.set(provider.name, cachedClient);
        } else {
          this.apiClients.set(provider.name, client);
        }
      }
    }
  }

  /**
   * Run tests with all optimizations
   */
  async runTests(testObjects) {
    await this.initialize();

    const allTests = this.extractAllTests(testObjects);
    this.stats.totalTests = allTests.length;

    if (this.options.enableProgress) {
      globalProgressManager.startBatchOperation(
        'test-execution',
        'Running tests',
        allTests.length
      );
    }

    // Process tests in batches
    const batches = this.createBatches(allTests, this.options.batchSize);
    const results = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      if (this.options.enableProgress) {
        globalProgressManager.updateProgress('test-execution', results.length);
      }

      const batchResults = await this.executeBatch(batch);
      results.push(...batchResults);

      // Memory cleanup between batches
      if (this.options.enableMemoryProfiling) {
        globalMemoryProfiler.forceGC();
      }
    }

    if (this.options.enableProgress) {
      globalProgressManager.completeOperation('test-execution', results);
    }

    // Aggregate results
    const aggregation = this.aggregateResults(results);
    
    // Stop memory profiling
    if (this.options.enableMemoryProfiling) {
      globalMemoryProfiler.stop();
    }

    return {
      raw: results,
      aggregated: aggregation,
      machineReadable: {
        summary: aggregation.summary,
        performance: aggregation.performance,
        models: aggregation.models,
        failures: aggregation.failures,
        cache: aggregation.cache,
        memory: this.options.enableMemoryProfiling ? globalMemoryProfiler.getMemoryReport() : null,
        tests: results
      }
    };
  }

  /**
   * Extract all tests from test objects
   */
  extractAllTests(testObjects) {
    const allTests = [];
    
    for (const testObj of testObjects) {
      const { name: suiteName, tests, settings = {} } = testObj;
      
      for (const test of tests) {
        allTests.push({
          test,
          settings,
          suiteName
        });
      }
    }
    
    return allTests;
  }

  /**
   * Create batches of tests
   */
  createBatches(tests, batchSize) {
    const batches = [];
    for (let i = 0; i < tests.length; i += batchSize) {
      batches.push(tests.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Execute a batch of tests
   */
  async executeBatch(batch) {
    const promises = batch.map(({ test, settings, suiteName }) => 
      this.executeTest(test, settings, suiteName)
    );
    
    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        this.stats.completedTests++;
        return result.value;
      } else {
        this.stats.failedTests++;
        return {
          suite: batch[index].suiteName,
          test: batch[index].test.name,
          pass: false,
          error: result.reason.message,
          durationMs: 0,
          cached: false
        };
      }
    });
  }

  /**
   * Execute a single test with optimizations
   */
  async executeTest(test, settings, suiteName) {
    const { name, description, prompt, expect } = test;
    const startTime = Date.now();

    try {
      // Try to get from cache first
      let response = null;
      let cached = false;

      if (this.options.enableCaching) {
        for (const [providerName, client] of this.apiClients.entries()) {
          try {
            const cachedResponse = await client.get(prompt, settings.model || client.defaultModel, settings);
            if (cachedResponse) {
              response = cachedResponse.response;
              cached = true;
              this.stats.cachedResponses++;
              break;
            }
          } catch (error) {
            // Cache miss, continue to API call
          }
        }
      }

      // If not cached, make API call
      if (!response) {
        response = await this.makeAPICall(prompt, settings);
      }

      // Validate response
      const validation = this.validateResponse(response, expect, settings);
      const endTime = Date.now();
      const durationMs = endTime - startTime;

      this.updateStats(durationMs);

      return {
        suite: suiteName,
        test: name,
        description,
        prompt,
        response,
        pass: validation.pass,
        details: validation.details,
        durationMs,
        cached,
        modelUsed: settings.model || 'unknown',
        fallbackUsed: false
      };

    } catch (error) {
      const endTime = Date.now();
      const durationMs = endTime - startTime;

      return {
        suite: suiteName,
        test: name,
        description,
        prompt,
        response: '',
        pass: false,
        details: [error.message],
        durationMs,
        error: error.message,
        cached: false
      };
    }
  }

  /**
   * Make API call with streaming support
   */
  async makeAPICall(prompt, settings) {
    const client = this.getBestClient(settings.model);
    
    if (!client) {
      throw new Error('No available API client');
    }

    const options = {
      model: settings.model || client.defaultModel,
      maxTokens: settings.max_tokens || 1000,
      temperature: settings.temperature || 0.7,
      stream: this.options.enableStreaming && prompt.length > 1000 // Stream for long prompts
    };

    const result = await client.makeRequest(prompt, options);
    return result.response || result.content || result.text || '';
  }

  /**
   * Get the best available client
   */
  getBestClient(preferredModel = null) {
    // Try to find client that supports the preferred model
    if (preferredModel) {
      for (const [name, client] of this.apiClients.entries()) {
        if (client.defaultModel === preferredModel || name === 'openai') {
          return client;
        }
      }
    }

    // Return first available client
    return this.apiClients.values().next().value;
  }

  /**
   * Validate response against expectations
   */
  validateResponse(response, expect, settings = {}) {
    const results = {
      pass: true,
      details: []
    };

    try {
      // Content validation
      if (expect.contains || expect.not_contains) {
        const contentValidation = validateContent(response, expect);
        if (!contentValidation.overall.pass) {
          results.pass = false;
          results.details.push(...contentValidation.overall.details);
        }
      }

      // PII detection
      if (settings.safety_checks?.block_pii) {
        const piiResult = detectPII(response);
        if (piiResult.detected) {
          results.pass = false;
          results.details.push(`PII detected: ${piiResult.types.join(', ')}`);
        }
      }

    } catch (error) {
      results.pass = false;
      results.details.push(`Validation error: ${error.message}`);
    }

    return results;
  }

  /**
   * Update statistics
   */
  updateStats(duration) {
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.completedTests - 1) + duration) / 
      this.stats.completedTests;
  }

  /**
   * Aggregate test results
   */
  aggregateResults(results) {
    const aggregation = {
      summary: {
        total: results.length,
        passed: results.filter(r => r.pass).length,
        failed: results.filter(r => !r.pass).length,
        totalDuration: results.reduce((sum, r) => sum + r.durationMs, 0),
        totalCost: results.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0),
        cachedResponses: results.filter(r => r.cached).length,
        cacheHitRate: 0
      },
      performance: {
        averageDuration: 0,
        fastestTest: null,
        slowestTest: null,
        durationDistribution: {
          fast: 0,
          medium: 0,
          slow: 0
        }
      },
      models: {
        usage: {},
        fallbackRate: 0
      },
      failures: {
        byCategory: {},
        total: 0
      },
      cache: {
        hits: this.stats.cachedResponses,
        misses: results.length - this.stats.cachedResponses,
        hitRate: 0
      }
    };

    // Calculate cache statistics
    aggregation.summary.cacheHitRate = results.length > 0 
      ? (aggregation.summary.cachedResponses / results.length) * 100 
      : 0;
    aggregation.cache.hitRate = aggregation.summary.cacheHitRate;

    // Calculate performance metrics
    if (results.length > 0) {
      aggregation.performance.averageDuration = aggregation.summary.totalDuration / results.length;
      
      const sortedByDuration = [...results].sort((a, b) => a.durationMs - b.durationMs);
      aggregation.performance.fastestTest = sortedByDuration[0];
      aggregation.performance.slowestTest = sortedByDuration[sortedByDuration.length - 1];
      
      results.forEach(result => {
        if (result.durationMs < 5000) aggregation.performance.durationDistribution.fast++;
        else if (result.durationMs < 15000) aggregation.performance.durationDistribution.medium++;
        else aggregation.performance.durationDistribution.slow++;
      });
    }

    // Calculate model usage
    results.forEach(result => {
      const model = result.modelUsed || 'unknown';
      aggregation.models.usage[model] = (aggregation.models.usage[model] || 0) + 1;
    });

    // Calculate failure categories
    results.forEach(result => {
      if (!result.pass) {
        const category = this.categorizeFailure(result);
        aggregation.failures.byCategory[category] = (aggregation.failures.byCategory[category] || 0) + 1;
        aggregation.failures.total++;
      }
    });

    // Calculate success rate
    aggregation.summary.successRate = results.length > 0 
      ? (aggregation.summary.passed / results.length) * 100 
      : 0;

    return aggregation;
  }

  /**
   * Categorize test failure
   */
  categorizeFailure(result) {
    if (result.error) {
      if (result.error.includes('timeout')) return 'TIMEOUT_FAILURE';
      if (result.error.includes('network')) return 'NETWORK_FAILURE';
      if (result.error.includes('model')) return 'MODEL_FAILURE';
      return 'UNKNOWN_FAILURE';
    }

    if (result.details && result.details.length > 0) {
      const details = result.details.join(' ').toLowerCase();
      if (details.includes('pii')) return 'PII_FAILURE';
      if (details.includes('content')) return 'CONTENT_FAILURE';
      return 'VALIDATION_FAILURE';
    }

    return 'UNKNOWN_FAILURE';
  }

  /**
   * Get runner statistics
   */
  getStats() {
    return {
      ...this.stats,
      parserStats: this.parser.getStats(),
      memoryStats: this.options.enableMemoryProfiling ? globalMemoryProfiler.getMemoryReport() : null,
      progressStats: globalProgressManager.getStats()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.options.enableMemoryProfiling) {
      globalMemoryProfiler.stop();
    }
    
    globalProgressManager.clear();
    this.parser.clearCache();
  }
} 