import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { platformUtils } from '../utils/platform-utils.js';

/**
 * Comprehensive Performance Benchmark Runner
 * Measures execution time, memory usage, network efficiency, and more
 */
export class BenchmarkRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      outputDir: options.outputDir || './benchmarks/results',
      iterations: options.iterations || 3,
      warmupRuns: options.warmupRuns || 2,
      memorySampling: options.memorySampling || 100, // ms
      networkMonitoring: options.networkMonitoring !== false,
      detailedLogging: options.detailedLogging || false,
      ...options
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      platform: platformUtils.getPlatformInfo(),
      benchmarks: {},
      summary: {}
    };
    
    this.memorySamples = [];
    this.networkStats = {
      requests: 0,
      totalBytes: 0,
      averageLatency: 0,
      latencies: []
    };
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    this.memorySamples = [];
    this.memoryInterval = setInterval(() => {
      const usage = process.memoryUsage();
      this.memorySamples.push({
        timestamp: Date.now(),
        rss: usage.rss,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external
      });
    }, this.options.memorySampling);
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    if (this.memorySamples.length === 0) {
      return null;
    }

    const samples = this.memorySamples;
    const rssValues = samples.map(s => s.rss);
    const heapUsedValues = samples.map(s => s.heapUsed);
    const heapTotalValues = samples.map(s => s.heapTotal);

    return {
      samples: samples.length,
      duration: samples[samples.length - 1].timestamp - samples[0].timestamp,
      rss: {
        min: Math.min(...rssValues),
        max: Math.max(...rssValues),
        average: rssValues.reduce((a, b) => a + b, 0) / rssValues.length,
        peak: Math.max(...rssValues)
      },
      heapUsed: {
        min: Math.min(...heapUsedValues),
        max: Math.max(...heapUsedValues),
        average: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length,
        peak: Math.max(...heapUsedValues)
      },
      heapTotal: {
        min: Math.min(...heapTotalValues),
        max: Math.max(...heapTotalValues),
        average: heapTotalValues.reduce((a, b) => a + b, 0) / heapTotalValues.length,
        peak: Math.max(...heapTotalValues)
      }
    };
  }

  /**
   * Record network request
   */
  recordNetworkRequest(bytes, latency) {
    this.networkStats.requests++;
    this.networkStats.totalBytes += bytes;
    this.networkStats.latencies.push(latency);
    this.networkStats.averageLatency = this.networkStats.latencies.reduce((a, b) => a + b, 0) / this.networkStats.latencies.length;
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    return {
      ...this.networkStats,
      totalMB: this.networkStats.totalBytes / (1024 * 1024),
      averageLatency: this.networkStats.averageLatency,
      minLatency: Math.min(...this.networkStats.latencies),
      maxLatency: Math.max(...this.networkStats.latencies)
    };
  }

  /**
   * Run a benchmark with timing and memory monitoring
   */
  async runBenchmark(name, fn, options = {}) {
    const benchmarkOptions = {
      iterations: this.options.iterations,
      warmupRuns: this.options.warmupRuns,
      ...options
    };

    console.log(`\n🧪 Running benchmark: ${name}`);
    console.log(`   Iterations: ${benchmarkOptions.iterations}`);
    console.log(`   Warmup runs: ${benchmarkOptions.warmupRuns}`);

    const times = [];
    const memoryStats = [];

    // Warmup runs
    for (let i = 0; i < benchmarkOptions.warmupRuns; i++) {
      if (this.options.detailedLogging) {
        console.log(`   Warmup run ${i + 1}/${benchmarkOptions.warmupRuns}`);
      }
      await fn();
    }

    // Actual benchmark runs
    for (let i = 0; i < benchmarkOptions.iterations; i++) {
      if (this.options.detailedLogging) {
        console.log(`   Benchmark run ${i + 1}/${benchmarkOptions.iterations}`);
      }

      // Reset network stats
      this.networkStats = {
        requests: 0,
        totalBytes: 0,
        averageLatency: 0,
        latencies: []
      };

      // Start memory monitoring
      this.startMemoryMonitoring();

      // Run benchmark
      const startTime = performance.now();
      const result = await fn();
      const endTime = performance.now();

      // Stop memory monitoring
      this.stopMemoryMonitoring();

      const duration = endTime - startTime;
      times.push(duration);

      const memoryStats = this.getMemoryStats();
      if (memoryStats) {
        memoryStats.push(memoryStats);
      }

      if (this.options.detailedLogging) {
        console.log(`     Duration: ${duration.toFixed(2)}ms`);
        console.log(`     Memory peak: ${(memoryStats?.rss.peak / 1024 / 1024).toFixed(2)}MB`);
        console.log(`     Network requests: ${this.networkStats.requests}`);
      }
    }

    // Calculate statistics
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const stdDev = Math.sqrt(times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length);

    const benchmarkResult = {
      name,
      iterations: benchmarkOptions.iterations,
      warmupRuns: benchmarkOptions.warmupRuns,
      timing: {
        times,
        average: avgTime,
        min: minTime,
        max: maxTime,
        stdDev,
        total: times.reduce((a, b) => a + b, 0)
      },
      memory: memoryStats.length > 0 ? {
        samples: memoryStats.length,
        average: {
          rss: memoryStats.reduce((sum, stat) => sum + stat.rss.average, 0) / memoryStats.length,
          heapUsed: memoryStats.reduce((sum, stat) => sum + stat.heapUsed.average, 0) / memoryStats.length,
          heapTotal: memoryStats.reduce((sum, stat) => sum + stat.heapTotal.average, 0) / memoryStats.length
        },
        peak: {
          rss: Math.max(...memoryStats.map(stat => stat.rss.peak)),
          heapUsed: Math.max(...memoryStats.map(stat => stat.heap.used.peak)),
          heapTotal: Math.max(...memoryStats.map(stat => stat.heapTotal.peak))
        }
      } : null,
      network: this.getNetworkStats(),
      timestamp: new Date().toISOString()
    };

    this.results.benchmarks[name] = benchmarkResult;
    this.emit('benchmarkComplete', benchmarkResult);

    return benchmarkResult;
  }

  /**
   * Run multiple benchmarks
   */
  async runBenchmarks(benchmarks) {
    console.log('🚀 Starting performance benchmarks...');
    console.log(`Platform: ${this.results.platform.platform} ${this.results.platform.arch}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB total`);

    for (const [name, benchmark] of Object.entries(benchmarks)) {
      try {
        await this.runBenchmark(name, benchmark.fn, benchmark.options);
      } catch (error) {
        console.error(`❌ Benchmark ${name} failed:`, error.message);
        this.results.benchmarks[name] = {
          name,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }

    this.generateSummary();
    await this.saveResults();
  }

  /**
   * Generate benchmark summary
   */
  generateSummary() {
    const benchmarks = Object.values(this.results.benchmarks).filter(b => !b.error);
    
    if (benchmarks.length === 0) {
      return;
    }

    const timingStats = benchmarks.map(b => b.timing.average);
    const memoryStats = benchmarks.filter(b => b.memory).map(b => b.memory.peak.rss);
    const networkStats = benchmarks.filter(b => b.network).map(b => b.network.totalMB);

    this.results.summary = {
      totalBenchmarks: benchmarks.length,
      totalDuration: benchmarks.reduce((sum, b) => sum + b.timing.total, 0),
      averageExecutionTime: timingStats.reduce((a, b) => a + b, 0) / timingStats.length,
      fastestBenchmark: benchmarks.reduce((min, b) => b.timing.average < min.timing.average ? b : min),
      slowestBenchmark: benchmarks.reduce((max, b) => b.timing.average > max.timing.average ? b : max),
      peakMemoryUsage: memoryStats.length > 0 ? Math.max(...memoryStats) : null,
      totalNetworkUsage: networkStats.length > 0 ? networkStats.reduce((a, b) => a + b, 0) : null,
      averageNetworkUsage: networkStats.length > 0 ? networkStats.reduce((a, b) => a + b, 0) / networkStats.length : null
    };
  }

  /**
   * Save benchmark results
   */
  async saveResults() {
    try {
      const outputDir = path.resolve(this.options.outputDir);
      await fs.promises.mkdir(outputDir, { recursive: true });

      const filename = `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(outputDir, filename);

      await fs.promises.writeFile(filepath, JSON.stringify(this.results, null, 2));
      console.log(`\n📊 Benchmark results saved to: ${filepath}`);

      return filepath;
    } catch (error) {
      console.error('❌ Failed to save benchmark results:', error.message);
      return null;
    }
  }

  /**
   * Generate benchmark report
   */
  generateReport() {
    console.log('\n📈 BENCHMARK SUMMARY');
    console.log('='.repeat(50));

    const benchmarks = Object.values(this.results.benchmarks).filter(b => !b.error);
    
    if (benchmarks.length === 0) {
      console.log('No successful benchmarks to report');
      return;
    }

    console.log(`Total benchmarks: ${benchmarks.length}`);
    console.log(`Total execution time: ${(this.results.summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`Average execution time: ${this.results.summary.averageExecutionTime.toFixed(2)}ms`);

    if (this.results.summary.peakMemoryUsage) {
      console.log(`Peak memory usage: ${(this.results.summary.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }

    if (this.results.summary.totalNetworkUsage) {
      console.log(`Total network usage: ${this.results.summary.totalNetworkUsage.toFixed(2)}MB`);
    }

    console.log('\n🏆 TOP PERFORMERS:');
    console.log(`Fastest: ${this.results.summary.fastestBenchmark.name} (${this.results.summary.fastestBenchmark.timing.average.toFixed(2)}ms)`);
    console.log(`Slowest: ${this.results.summary.slowestBenchmark.name} (${this.results.summary.slowestBenchmark.timing.average.toFixed(2)}ms)`);

    console.log('\n📊 DETAILED RESULTS:');
    benchmarks.forEach(benchmark => {
      console.log(`\n${benchmark.name}:`);
      console.log(`  Average time: ${benchmark.timing.average.toFixed(2)}ms`);
      console.log(`  Min time: ${benchmark.timing.min.toFixed(2)}ms`);
      console.log(`  Max time: ${benchmark.timing.max.toFixed(2)}ms`);
      console.log(`  Std dev: ${benchmark.timing.stdDev.toFixed(2)}ms`);
      
      if (benchmark.memory) {
        console.log(`  Peak memory: ${(benchmark.memory.peak.rss / 1024 / 1024).toFixed(2)}MB`);
      }
      
      if (benchmark.network) {
        console.log(`  Network requests: ${benchmark.network.requests}`);
        console.log(`  Network usage: ${benchmark.network.totalMB.toFixed(2)}MB`);
        console.log(`  Average latency: ${benchmark.network.averageLatency.toFixed(2)}ms`);
      }
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopMemoryMonitoring();
    this.removeAllListeners();
  }
} 