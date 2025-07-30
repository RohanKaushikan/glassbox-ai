import { CacheManager } from '../cache/cache-manager.js';
import { runTests } from '../runner.js';
import { platformUtils } from '../utils/platform-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Cache Hit Rates and Storage Efficiency Benchmarks
 * Measures cache performance, storage optimization, and cache invalidation
 */
export class CacheBenchmarks {
  constructor() {
    this.cacheManager = new CacheManager();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0
    };
  }

  /**
   * Generate test suite for cache testing
   */
  generateCacheTestSuite(testCount, promptType = 'standard') {
    const prompts = {
      standard: 'Generate a standard response.',
      detailed: 'Generate a detailed response with comprehensive explanations and examples.',
      technical: 'Generate a technical response with code examples, best practices, and implementation details.',
      creative: 'Generate a creative and innovative response with unique perspectives and original ideas.'
    };

    const tests = [];
    
    for (let i = 0; i < testCount; i++) {
      tests.push({
        name: `Cache Test ${i + 1} (${promptType})`,
        description: `Cache benchmark test ${i + 1} with ${promptType} prompt`,
        prompt: prompts[promptType],
        expect: {
          contains: ['response', 'generated'],
          not_contains: ['error', 'sorry', 'cannot']
        },
        max_tokens: 200,
        temperature: 0.7
      });
    }

    return {
      name: `cache-benchmark-${promptType}`,
      description: `Cache benchmark suite with ${testCount} ${promptType} tests`,
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
   * Record cache operation
   */
  recordCacheOperation(operation, success = true) {
    switch (operation) {
      case 'hit':
        this.cacheStats.hits++;
        break;
      case 'miss':
        this.cacheStats.misses++;
        break;
      case 'set':
        this.cacheStats.sets++;
        break;
      case 'invalidate':
        this.cacheStats.invalidations++;
        break;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
    
    return {
      ...this.cacheStats,
      total,
      hitRate,
      missRate: 100 - hitRate,
      efficiency: hitRate >= 80 ? 'excellent' : hitRate >= 60 ? 'good' : 'poor'
    };
  }

  /**
   * Benchmark: Cache hit rate performance
   */
  async benchmarkCacheHitRate() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0
    };

    const suite = this.generateCacheTestSuite(20, 'standard');
    const testObjects = [suite];
    
    // Initialize cache
    await this.cacheManager.initialize();
    
    // First run (cache miss)
    const firstStartTime = Date.now();
    const firstResults = await runTests(testObjects);
    const firstEndTime = Date.now();
    this.recordCacheOperation('miss', true);
    this.recordCacheOperation('set', true);
    
    // Second run (cache hit)
    const secondStartTime = Date.now();
    const secondResults = await runTests(testObjects);
    const secondEndTime = Date.now();
    this.recordCacheOperation('hit', true);
    
    const cacheStats = this.getCacheStats();
    
    return {
      testCount: suite.tests.length,
      firstRunTime: firstEndTime - firstStartTime,
      secondRunTime: secondEndTime - secondStartTime,
      cacheStats,
      performance: cacheStats.hitRate >= 80 ? 'excellent' : cacheStats.hitRate >= 60 ? 'good' : 'poor'
    };
  }

  /**
   * Benchmark: Cache storage efficiency
   */
  async benchmarkCacheStorageEfficiency() {
    const storageSizes = [];
    const compressionRatios = [];
    
    // Test with different response sizes
    const responseSizes = [100, 500, 1000, 2000];
    
    for (const size of responseSizes) {
      const suite = this.generateCacheTestSuite(5, 'detailed');
      const testObjects = [suite];
      
      // Run tests to populate cache
      await runTests(testObjects);
      
      // Get cache storage info
      const cacheInfo = await this.getCacheStorageInfo();
      storageSizes.push({
        responseSize: size,
        storageSize: cacheInfo.storageSize,
        compressionRatio: cacheInfo.compressionRatio
      });
      
      compressionRatios.push(cacheInfo.compressionRatio);
    }
    
    const avgCompressionRatio = compressionRatios.reduce((a, b) => a + b, 0) / compressionRatios.length;
    
    return {
      storageSizes,
      averageCompressionRatio: avgCompressionRatio,
      performance: avgCompressionRatio >= 0.7 ? 'excellent' : avgCompressionRatio >= 0.5 ? 'good' : 'poor'
    };
  }

  /**
   * Get cache storage information
   */
  async getCacheStorageInfo() {
    try {
      const cacheDir = this.cacheManager.cacheDir;
      const files = await fs.promises.readdir(cacheDir);
      
      let totalSize = 0;
      let compressedSize = 0;
      
      for (const file of files) {
        if (file.endsWith('.gz')) {
          const stats = await fs.promises.stat(path.join(cacheDir, file));
          compressedSize += stats.size;
        } else {
          const stats = await fs.promises.stat(path.join(cacheDir, file));
          totalSize += stats.size;
        }
      }
      
      const compressionRatio = totalSize > 0 ? compressedSize / totalSize : 1;
      
      return {
        storageSize: totalSize + compressedSize,
        compressionRatio,
        fileCount: files.length
      };
    } catch (error) {
      return {
        storageSize: 0,
        compressionRatio: 1,
        fileCount: 0
      };
    }
  }

  /**
   * Benchmark: Cache invalidation performance
   */
  async benchmarkCacheInvalidation() {
    const suite = this.generateCacheTestSuite(10, 'standard');
    const testObjects = [suite];
    
    // Initialize cache
    await this.cacheManager.initialize();
    
    // Populate cache
    await runTests(testObjects);
    this.recordCacheOperation('set', true);
    
    // Measure invalidation time
    const invalidationStartTime = Date.now();
    await this.cacheManager.clear();
    const invalidationEndTime = Date.now();
    this.recordCacheOperation('invalidate', true);
    
    const invalidationTime = invalidationEndTime - invalidationStartTime;
    
    return {
      invalidationTime,
      performance: invalidationTime <= 100 ? 'excellent' : invalidationTime <= 500 ? 'good' : 'poor'
    };
  }

  /**
   * Benchmark: Cache TTL performance
   */
  async benchmarkCacheTTL() {
    const ttlValues = [60, 300, 900, 3600]; // 1min, 5min, 15min, 1hour
    const ttlResults = {};
    
    for (const ttl of ttlValues) {
      // Create cache manager with specific TTL
      const cacheManager = new CacheManager({
        defaultTTL: ttl * 1000 // Convert to milliseconds
      });
      
      await cacheManager.initialize();
      
      const suite = this.generateCacheTestSuite(5, 'standard');
      const testObjects = [suite];
      
      // Run tests
      const startTime = Date.now();
      await runTests(testObjects);
      const endTime = Date.now();
      
      // Check cache hit rate after TTL
      await new Promise(resolve => setTimeout(resolve, (ttl * 1000) + 1000)); // Wait TTL + 1 second
      
      const cacheHit = await cacheManager.get('test-key');
      
      ttlResults[ttl] = {
        ttl,
        executionTime: endTime - startTime,
        cacheHit: cacheHit !== null,
        performance: cacheHit !== null ? 'good' : 'poor'
      };
      
      await cacheManager.cleanup();
    }
    
    return ttlResults;
  }

  /**
   * Benchmark: Cache memory usage
   */
  async benchmarkCacheMemoryUsage() {
    const memorySnapshots = [];
    
    // Initial memory
    const initialUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'initial',
      rss: initialUsage.rss,
      heapUsed: initialUsage.heapUsed,
      heapTotal: initialUsage.heapTotal
    });
    
    // Initialize cache
    await this.cacheManager.initialize();
    const cacheInitUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'after-cache-init',
      rss: cacheInitUsage.rss,
      heapUsed: cacheInitUsage.heapUsed,
      heapTotal: cacheInitUsage.heapTotal
    });
    
    // Populate cache with data
    const suite = this.generateCacheTestSuite(20, 'detailed');
    const testObjects = [suite];
    await runTests(testObjects);
    
    const cachePopulatedUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'after-cache-populated',
      rss: cachePopulatedUsage.rss,
      heapUsed: cachePopulatedUsage.heapUsed,
      heapTotal: cachePopulatedUsage.heapTotal
    });
    
    // Clear cache
    await this.cacheManager.clear();
    const cacheClearedUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'after-cache-cleared',
      rss: cacheClearedUsage.rss,
      heapUsed: cacheClearedUsage.heapUsed,
      heapTotal: cacheClearedUsage.heapTotal
    });
    
    // Calculate memory efficiency
    const initialRss = memorySnapshots[0].rss;
    const peakRss = Math.max(...memorySnapshots.map(s => s.rss));
    const finalRss = memorySnapshots[memorySnapshots.length - 1].rss;
    
    const memoryGrowth = peakRss - initialRss;
    const memoryRecovery = peakRss - finalRss;
    const recoveryRate = memoryGrowth > 0 ? (memoryRecovery / memoryGrowth) * 100 : 100;
    
    return {
      memorySnapshots,
      initialMemory: initialRss,
      peakMemory: peakRss,
      finalMemory: finalRss,
      memoryGrowth,
      memoryRecovery,
      recoveryRate,
      isMemoryEfficient: recoveryRate >= 80
    };
  }

  /**
   * Benchmark: Cache key distribution
   */
  async benchmarkCacheKeyDistribution() {
    const keyCounts = [10, 50, 100, 500];
    const distributionResults = {};
    
    for (const keyCount of keyCounts) {
      // Generate unique keys
      const keys = Array.from({ length: keyCount }, (_, i) => `test-key-${i}`);
      
      const startTime = Date.now();
      
      // Set cache entries
      for (const key of keys) {
        await this.cacheManager.set(key, `test-value-${key}`, 3600000); // 1 hour TTL
      }
      
      const setTime = Date.now() - startTime;
      
      // Get cache entries
      const getStartTime = Date.now();
      let hits = 0;
      for (const key of keys) {
        const value = await this.cacheManager.get(key);
        if (value !== null) hits++;
      }
      const getTime = Date.now() - getStartTime;
      
      distributionResults[keyCount] = {
        keyCount,
        setTime,
        getTime,
        hitRate: (hits / keyCount) * 100,
        averageSetTime: setTime / keyCount,
        averageGetTime: getTime / keyCount
      };
    }
    
    return distributionResults;
  }

  /**
   * Benchmark: Cache compression efficiency
   */
  async benchmarkCacheCompression() {
    const compressionThresholds = [0, 512, 1024, 2048, 4096];
    const compressionResults = {};
    
    for (const threshold of compressionThresholds) {
      const cacheManager = new CacheManager({
        compressionThreshold: threshold
      });
      
      await cacheManager.initialize();
      
      const testData = 'x'.repeat(1000); // 1KB test data
      const startTime = Date.now();
      
      // Set data multiple times to measure compression
      for (let i = 0; i < 10; i++) {
        await cacheManager.set(`compression-test-${i}`, testData, 3600000);
      }
      
      const setTime = Date.now() - startTime;
      
      // Get storage info
      const storageInfo = await this.getCacheStorageInfo();
      
      compressionResults[threshold] = {
        threshold,
        setTime,
        storageSize: storageInfo.storageSize,
        compressionRatio: storageInfo.compressionRatio,
        efficiency: storageInfo.compressionRatio >= 0.7 ? 'excellent' : storageInfo.compressionRatio >= 0.5 ? 'good' : 'poor'
      };
      
      await cacheManager.cleanup();
    }
    
    return compressionResults;
  }

  /**
   * Benchmark: Cache concurrent access
   */
  async benchmarkCacheConcurrentAccess() {
    const concurrentLevels = [1, 5, 10, 20];
    const concurrentResults = {};
    
    for (const concurrency of concurrentLevels) {
      const startTime = Date.now();
      const promises = [];
      
      // Simulate concurrent cache access
      for (let i = 0; i < concurrency; i++) {
        promises.push(this.simulateConcurrentCacheAccess(i));
      }
      
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      concurrentResults[concurrency] = {
        concurrency,
        totalTime,
        averageTime: totalTime / concurrency,
        throughput: concurrency / (totalTime / 1000) // operations per second
      };
    }
    
    return concurrentResults;
  }

  /**
   * Simulate concurrent cache access
   */
  async simulateConcurrentCacheAccess(index) {
    const key = `concurrent-test-${index}`;
    const value = `test-value-${index}`;
    
    // Set value
    await this.cacheManager.set(key, value, 3600000);
    
    // Get value
    const retrieved = await this.cacheManager.get(key);
    
    return {
      key,
      set: true,
      get: retrieved === value
    };
  }

  /**
   * Benchmark: Cache persistence performance
   */
  async benchmarkCachePersistence() {
    const persistenceResults = {};
    
    // Test cache persistence across restarts
    const suite = this.generateCacheTestSuite(10, 'standard');
    const testObjects = [suite];
    
    // First run - populate cache
    const firstStartTime = Date.now();
    await runTests(testObjects);
    const firstEndTime = Date.now();
    
    // Simulate cache persistence (save to disk)
    const persistenceStartTime = Date.now();
    await this.cacheManager.saveStats();
    const persistenceEndTime = Date.now();
    
    // Simulate cache restoration
    const restorationStartTime = Date.now();
    await this.cacheManager.loadStats();
    const restorationEndTime = Date.now();
    
    persistenceResults.persistence = {
      firstRunTime: firstEndTime - firstStartTime,
      persistenceTime: persistenceEndTime - persistenceStartTime,
      restorationTime: restorationEndTime - restorationStartTime,
      totalPersistenceTime: (persistenceEndTime - persistenceStartTime) + (restorationEndTime - restorationStartTime)
    };
    
    return persistenceResults;
  }

  /**
   * Get all cache benchmarks
   */
  getBenchmarks() {
    return {
      'Cache Hit Rate Performance': {
        fn: () => this.benchmarkCacheHitRate(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'Cache Storage Efficiency': {
        fn: () => this.benchmarkCacheStorageEfficiency(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache Invalidation Performance': {
        fn: () => this.benchmarkCacheInvalidation(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache TTL Performance': {
        fn: () => this.benchmarkCacheTTL(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache Memory Usage': {
        fn: () => this.benchmarkCacheMemoryUsage(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache Key Distribution': {
        fn: () => this.benchmarkCacheKeyDistribution(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache Compression Efficiency': {
        fn: () => this.benchmarkCacheCompression(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache Concurrent Access': {
        fn: () => this.benchmarkCacheConcurrentAccess(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache Persistence Performance': {
        fn: () => this.benchmarkCachePersistence(),
        options: { iterations: 2, warmupRuns: 1 }
      }
    };
  }
} 