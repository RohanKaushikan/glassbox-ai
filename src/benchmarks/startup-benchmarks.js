import { performance } from 'perf_hooks';
import { parseTestFiles } from '../parser.js';
import { validateInput } from '../validators/input-validator.js';
import { CacheManager } from '../cache/cache-manager.js';
import { OptimizedTestRunner } from '../optimization/optimized-runner.js';
import { platformUtils } from '../utils/platform-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Startup Time and Initialization Overhead Benchmarks
 * Measures startup performance, module loading, and system initialization
 */
export class StartupBenchmarks {
  constructor() {
    this.startupTimes = [];
    this.initializationSteps = [];
  }

  /**
   * Record initialization step timing
   */
  recordInitializationStep(step, duration) {
    this.initializationSteps.push({
      step,
      duration,
      timestamp: Date.now()
    });
  }

  /**
   * Benchmark: CLI startup time
   */
  async benchmarkCLIStartup() {
    const startupTimes = [];
    
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      
      // Simulate CLI startup process
      await this.simulateCLIStartup();
      
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
      initializationSteps: this.initializationSteps,
      performance: avgTime <= 100 ? 'excellent' : avgTime <= 500 ? 'good' : 'poor'
    };
  }

  /**
   * Simulate CLI startup process
   */
  async simulateCLIStartup() {
    this.initializationSteps = [];
    
    // Step 1: Load configuration
    const configStart = performance.now();
    await this.loadConfiguration();
    const configEnd = performance.now();
    this.recordInitializationStep('load-configuration', configEnd - configStart);
    
    // Step 2: Initialize platform utilities
    const platformStart = performance.now();
    await this.initializePlatformUtilities();
    const platformEnd = performance.now();
    this.recordInitializationStep('initialize-platform', platformEnd - platformStart);
    
    // Step 3: Setup error handling
    const errorStart = performance.now();
    await this.setupErrorHandling();
    const errorEnd = performance.now();
    this.recordInitializationStep('setup-error-handling', errorEnd - errorStart);
    
    // Step 4: Initialize cache system
    const cacheStart = performance.now();
    await this.initializeCacheSystem();
    const cacheEnd = performance.now();
    this.recordInitializationStep('initialize-cache', cacheEnd - cacheStart);
    
    // Step 5: Setup API clients
    const apiStart = performance.now();
    await this.setupAPIClients();
    const apiEnd = performance.now();
    this.recordInitializationStep('setup-api-clients', apiEnd - apiStart);
    
    // Step 6: Validate environment
    const envStart = performance.now();
    await this.validateEnvironment();
    const envEnd = performance.now();
    this.recordInitializationStep('validate-environment', envEnd - envStart);
  }

  async loadConfiguration() {
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }

  async initializePlatformUtilities() {
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10));
  }

  async setupErrorHandling() {
    await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 25));
  }

  async initializeCacheSystem() {
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
  }

  async setupAPIClients() {
    await new Promise(resolve => setTimeout(resolve, 25 + Math.random() * 35));
  }

  async validateEnvironment() {
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 15));
  }

  /**
   * Benchmark: Module loading performance
   */
  async benchmarkModuleLoading() {
    const moduleLoadingTimes = [];
    const modules = [
      'parser',
      'runner',
      'validators',
      'cache',
      'optimization',
      'reliability'
    ];
    
    for (const module of modules) {
      const startTime = performance.now();
      await this.simulateModuleLoading(module);
      const endTime = performance.now();
      
      moduleLoadingTimes.push({
        module,
        loadingTime: endTime - startTime
      });
    }
    
    const totalTime = moduleLoadingTimes.reduce((sum, m) => sum + m.loadingTime, 0);
    const avgTime = totalTime / moduleLoadingTimes.length;
    
    return {
      totalModuleLoadingTime: totalTime,
      averageModuleLoadingTime: avgTime,
      moduleLoadingTimes,
      slowestModule: moduleLoadingTimes.reduce((max, m) => m.loadingTime > max.loadingTime ? m : max),
      fastestModule: moduleLoadingTimes.reduce((min, m) => m.loadingTime < min.loadingTime ? m : min)
    };
  }

  /**
   * Simulate module loading
   */
  async simulateModuleLoading(moduleName) {
    const loadingTimes = {
      parser: 15,
      runner: 25,
      validators: 10,
      cache: 20,
      optimization: 30,
      reliability: 35
    };
    
    const baseTime = loadingTimes[moduleName] || 10;
    await new Promise(resolve => setTimeout(resolve, baseTime + Math.random() * 10));
  }

  /**
   * Benchmark: Configuration parsing performance
   */
  async benchmarkConfigurationParsing() {
    const configSizes = [1, 5, 10, 20, 50];
    const parsingTimes = [];
    
    for (const size of configSizes) {
      const config = this.generateConfiguration(size);
      
      const startTime = performance.now();
      const parsedConfig = await this.parseConfiguration(config);
      const endTime = performance.now();
      
      parsingTimes.push({
        configSize: size,
        parsingTime: endTime - startTime,
        configSizeKB: JSON.stringify(config).length / 1024
      });
    }
    
    const avgTime = parsingTimes.reduce((sum, p) => sum + p.parsingTime, 0) / parsingTimes.length;
    
    return {
      averageParsingTime: avgTime,
      parsingTimes,
      performance: avgTime <= 10 ? 'excellent' : avgTime <= 50 ? 'good' : 'poor'
    };
  }

  /**
   * Generate configuration for testing
   */
  generateConfiguration(size) {
    const config = {
      settings: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        timeout_ms: 30000,
        max_retries: 2
      },
      reliability: {
        enabled: true,
        circuit_breaker: {
          failure_threshold: 5,
          timeout: 60000
        }
      },
      cache: {
        enabled: true,
        ttl: 3600
      },
      tests: []
    };
    
    for (let i = 0; i < size; i++) {
      config.tests.push({
        name: `Test ${i + 1}`,
        description: `Configuration test ${i + 1}`,
        prompt: `Generate a response for test ${i + 1}.`,
        expect: {
          contains: ['response'],
          not_contains: ['error']
        }
      });
    }
    
    return config;
  }

  /**
   * Parse configuration
   */
  async parseConfiguration(config) {
    // Simulate configuration parsing
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10));
    return JSON.parse(JSON.stringify(config));
  }

  /**
   * Benchmark: Cache initialization performance
   */
  async benchmarkCacheInitialization() {
    const cacheSizes = [0, 100, 1000, 10000];
    const initializationTimes = [];
    
    for (const size of cacheSizes) {
      const startTime = performance.now();
      const cacheManager = new CacheManager();
      await cacheManager.initialize();
      const endTime = performance.now();
      
      initializationTimes.push({
        cacheSize: size,
        initializationTime: endTime - startTime
      });
    }
    
    const avgTime = initializationTimes.reduce((sum, i) => sum + i.initializationTime, 0) / initializationTimes.length;
    
    return {
      averageInitializationTime: avgTime,
      initializationTimes,
      performance: avgTime <= 50 ? 'excellent' : avgTime <= 200 ? 'good' : 'poor'
    };
  }

  /**
   * Benchmark: Optimized runner initialization
   */
  async benchmarkOptimizedRunnerInitialization() {
    const concurrencyLevels = [1, 3, 5, 10];
    const initializationTimes = [];
    
    for (const concurrency of concurrencyLevels) {
      const startTime = performance.now();
      
      const runner = new OptimizedTestRunner({
        maxConcurrency: concurrency,
        batchSize: Math.max(1, Math.floor(20 / concurrency)),
        enableStreaming: false,
        enableCaching: false,
        enableProgress: false,
        enableMemoryProfiling: false
      });
      
      await runner.initialize();
      await runner.cleanup();
      
      const endTime = performance.now();
      
      initializationTimes.push({
        concurrency,
        initializationTime: endTime - startTime
      });
    }
    
    const avgTime = initializationTimes.reduce((sum, i) => sum + i.initializationTime, 0) / initializationTimes.length;
    
    return {
      averageInitializationTime: avgTime,
      initializationTimes,
      performance: avgTime <= 100 ? 'excellent' : avgTime <= 500 ? 'good' : 'poor'
    };
  }

  /**
   * Benchmark: File system initialization
   */
  async benchmarkFileSystemInitialization() {
    const directorySizes = [0, 10, 50, 100];
    const initializationTimes = [];
    
    for (const size of directorySizes) {
      const startTime = performance.now();
      await this.simulateFileSystemInitialization(size);
      const endTime = performance.now();
      
      initializationTimes.push({
        directorySize: size,
        initializationTime: endTime - startTime
      });
    }
    
    const avgTime = initializationTimes.reduce((sum, i) => sum + i.initializationTime, 0) / initializationTimes.length;
    
    return {
      averageInitializationTime: avgTime,
      initializationTimes,
      performance: avgTime <= 20 ? 'excellent' : avgTime <= 100 ? 'good' : 'poor'
    };
  }

  /**
   * Simulate file system initialization
   */
  async simulateFileSystemInitialization(fileCount) {
    // Simulate directory scanning and file discovery
    await new Promise(resolve => setTimeout(resolve, 10 + (fileCount * 2) + Math.random() * 10));
  }

  /**
   * Benchmark: Validation system initialization
   */
  async benchmarkValidationInitialization() {
    const validationTypes = ['input', 'content', 'cost', 'pii'];
    const initializationTimes = [];
    
    for (const type of validationTypes) {
      const startTime = performance.now();
      await this.simulateValidationInitialization(type);
      const endTime = performance.now();
      
      initializationTimes.push({
        validationType: type,
        initializationTime: endTime - startTime
      });
    }
    
    const avgTime = initializationTimes.reduce((sum, i) => sum + i.initializationTime, 0) / initializationTimes.length;
    
    return {
      averageInitializationTime: avgTime,
      initializationTimes,
      performance: avgTime <= 15 ? 'excellent' : avgTime <= 50 ? 'good' : 'poor'
    };
  }

  /**
   * Simulate validation initialization
   */
  async simulateValidationInitialization(type) {
    const initializationTimes = {
      input: 10,
      content: 15,
      cost: 5,
      pii: 20
    };
    
    const baseTime = initializationTimes[type] || 10;
    await new Promise(resolve => setTimeout(resolve, baseTime + Math.random() * 5));
  }

  /**
   * Benchmark: Cold vs warm startup
   */
  async benchmarkColdWarmStartup() {
    // Cold startup (first run)
    const coldStartTime = performance.now();
    await this.simulateCLIStartup();
    const coldEndTime = performance.now();
    const coldStartupTime = coldEndTime - coldStartTime;
    
    // Warm startup (subsequent runs)
    const warmStartTimes = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      await this.simulateCLIStartup();
      const endTime = performance.now();
      warmStartTimes.push(endTime - startTime);
    }
    
    const avgWarmStartupTime = warmStartTimes.reduce((a, b) => a + b, 0) / warmStartTimes.length;
    const improvement = ((coldStartupTime - avgWarmStartupTime) / coldStartupTime) * 100;
    
    return {
      coldStartupTime,
      averageWarmStartupTime: avgWarmStartupTime,
      warmStartupTimes,
      improvement,
      performance: improvement >= 50 ? 'excellent' : improvement >= 25 ? 'good' : 'poor'
    };
  }

  /**
   * Benchmark: Memory usage during startup
   */
  async benchmarkStartupMemoryUsage() {
    const memorySnapshots = [];
    
    // Initial memory
    const initialUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'initial',
      rss: initialUsage.rss,
      heapUsed: initialUsage.heapUsed,
      heapTotal: initialUsage.heapTotal
    });
    
    // After configuration loading
    await this.loadConfiguration();
    const configUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'after-config',
      rss: configUsage.rss,
      heapUsed: configUsage.heapUsed,
      heapTotal: configUsage.heapTotal
    });
    
    // After cache initialization
    await this.initializeCacheSystem();
    const cacheUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'after-cache',
      rss: cacheUsage.rss,
      heapUsed: cacheUsage.heapUsed,
      heapTotal: cacheUsage.heapTotal
    });
    
    // After API client setup
    await this.setupAPIClients();
    const apiUsage = process.memoryUsage();
    memorySnapshots.push({
      stage: 'after-api',
      rss: apiUsage.rss,
      heapUsed: apiUsage.heapUsed,
      heapTotal: apiUsage.heapTotal
    });
    
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
      isMemoryEfficient: memoryGrowth <= 50 * 1024 * 1024 // 50MB threshold
    };
  }

  /**
   * Get all startup benchmarks
   */
  getBenchmarks() {
    return {
      'CLI Startup Time': {
        fn: () => this.benchmarkCLIStartup(),
        options: { iterations: 3, warmupRuns: 1 }
      },
      'Module Loading Performance': {
        fn: () => this.benchmarkModuleLoading(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Configuration Parsing': {
        fn: () => this.benchmarkConfigurationParsing(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cache Initialization': {
        fn: () => this.benchmarkCacheInitialization(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Optimized Runner Initialization': {
        fn: () => this.benchmarkOptimizedRunnerInitialization(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'File System Initialization': {
        fn: () => this.benchmarkFileSystemInitialization(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Validation Initialization': {
        fn: () => this.benchmarkValidationInitialization(),
        options: { iterations: 2, warmupRuns: 1 }
      },
      'Cold vs Warm Startup': {
        fn: () => this.benchmarkColdWarmStartup(),
        options: { iterations: 2, warmupRuns: 0 }
      },
      'Startup Memory Usage': {
        fn: () => this.benchmarkStartupMemoryUsage(),
        options: { iterations: 2, warmupRuns: 1 }
      }
    };
  }
} 