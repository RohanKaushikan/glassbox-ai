#!/usr/bin/env node

import { BenchmarkRunner } from './benchmark-runner.js';
import { TestExecutionBenchmarks } from './test-execution-benchmarks.js';
import { MemoryBenchmarks } from './memory-benchmarks.js';
import { NetworkBenchmarks } from './network-benchmarks.js';
import { VSCodeBenchmarks } from './vscode-benchmarks.js';
import { StartupBenchmarks } from './startup-benchmarks.js';
import { CacheBenchmarks } from './cache-benchmarks.js';
import { platformUtils } from '../utils/platform-utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive Performance Benchmark Suite
 * Orchestrates all benchmark categories and provides unified reporting
 */
export class PerformanceBenchmarkSuite {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './benchmarks/results',
      detailedLogging: options.detailedLogging || false,
      enableGarbageCollection: options.enableGarbageCollection || false,
      ...options
    };
    
    this.runner = new BenchmarkRunner({
      outputDir: this.options.outputDir,
      detailedLogging: this.options.detailedLogging,
      iterations: 3,
      warmupRuns: 2
    });
    
    this.benchmarkSuites = {
      testExecution: new TestExecutionBenchmarks(),
      memory: new MemoryBenchmarks(),
      network: new NetworkBenchmarks(),
      vscode: new VSCodeBenchmarks(),
      startup: new StartupBenchmarks(),
      cache: new CacheBenchmarks()
    };
  }

  /**
   * Run all benchmark categories
   */
  async runAllBenchmarks() {
    console.log('🚀 Starting comprehensive performance benchmark suite...');
    console.log(`Platform: ${platformUtils.getPlatformInfo().platform} ${platformUtils.getPlatformInfo().arch}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Output directory: ${this.options.outputDir}`);
    
    const allBenchmarks = {};
    
    for (const [category, suite] of Object.entries(this.benchmarkSuites)) {
      console.log(`\n📊 Running ${category} benchmarks...`);
      
      try {
        const benchmarks = suite.getBenchmarks();
        await this.runner.runBenchmarks(benchmarks);
        
        allBenchmarks[category] = this.runner.results.benchmarks;
      } catch (error) {
        console.error(`❌ Error running ${category} benchmarks:`, error.message);
        allBenchmarks[category] = { error: error.message };
      }
    }
    
    // Generate comprehensive report
    await this.generateComprehensiveReport(allBenchmarks);
    
    return allBenchmarks;
  }

  /**
   * Run specific benchmark category
   */
  async runBenchmarkCategory(category) {
    if (!this.benchmarkSuites[category]) {
      throw new Error(`Unknown benchmark category: ${category}`);
    }
    
    console.log(`📊 Running ${category} benchmarks...`);
    
    const suite = this.benchmarkSuites[category];
    const benchmarks = suite.getBenchmarks();
    
    await this.runner.runBenchmarks(benchmarks);
    this.runner.generateReport();
    
    return this.runner.results.benchmarks;
  }

  /**
   * Run specific benchmark
   */
  async runSpecificBenchmark(category, benchmarkName) {
    if (!this.benchmarkSuites[category]) {
      throw new Error(`Unknown benchmark category: ${category}`);
    }
    
    const suite = this.benchmarkSuites[category];
    const benchmarks = suite.getBenchmarks();
    
    if (!benchmarks[benchmarkName]) {
      throw new Error(`Unknown benchmark: ${benchmarkName}`);
    }
    
    console.log(`📊 Running ${category}/${benchmarkName}...`);
    
    const result = await this.runner.runBenchmark(benchmarkName, benchmarks[benchmarkName].fn, benchmarks[benchmarkName].options);
    
    return result;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateComprehensiveReport(allBenchmarks) {
    const report = {
      timestamp: new Date().toISOString(),
      platform: platformUtils.getPlatformInfo(),
      summary: this.generateSummary(allBenchmarks),
      categories: allBenchmarks,
      recommendations: this.generateRecommendations(allBenchmarks)
    };
    
    // Save comprehensive report
    const reportPath = path.join(this.options.outputDir, 'comprehensive-report.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    await this.generateHTMLReport(report);
    
    console.log(`\n📊 Comprehensive report saved to: ${reportPath}`);
    
    return report;
  }

  /**
   * Generate performance summary
   */
  generateSummary(allBenchmarks) {
    const summary = {
      totalBenchmarks: 0,
      successfulBenchmarks: 0,
      failedBenchmarks: 0,
      averageExecutionTime: 0,
      peakMemoryUsage: 0,
      totalNetworkUsage: 0,
      cacheHitRate: 0,
      categories: {}
    };
    
    let totalExecutionTime = 0;
    let totalMemoryUsage = 0;
    let totalNetworkUsage = 0;
    let totalCacheHits = 0;
    let totalCacheRequests = 0;
    
    for (const [category, benchmarks] of Object.entries(allBenchmarks)) {
      if (benchmarks.error) {
        summary.categories[category] = { status: 'failed', error: benchmarks.error };
        continue;
      }
      
      const categoryStats = {
        benchmarks: Object.keys(benchmarks).length,
        averageExecutionTime: 0,
        peakMemoryUsage: 0,
        networkUsage: 0,
        cacheHitRate: 0
      };
      
      let categoryExecutionTime = 0;
      let categoryMemoryUsage = 0;
      let categoryNetworkUsage = 0;
      let categoryCacheHits = 0;
      let categoryCacheRequests = 0;
      
      for (const [benchmarkName, benchmark] of Object.entries(benchmarks)) {
        if (benchmark.error) {
          summary.failedBenchmarks++;
          continue;
        }
        
        summary.successfulBenchmarks++;
        categoryExecutionTime += benchmark.timing?.average || 0;
        categoryMemoryUsage = Math.max(categoryMemoryUsage, benchmark.memory?.peak?.rss || 0);
        categoryNetworkUsage += benchmark.network?.totalMB || 0;
        
        if (benchmark.cacheStats) {
          categoryCacheHits += benchmark.cacheStats.hits || 0;
          categoryCacheRequests += (benchmark.cacheStats.hits || 0) + (benchmark.cacheStats.misses || 0);
        }
      }
      
      categoryStats.averageExecutionTime = categoryExecutionTime / Object.keys(benchmarks).length;
      categoryStats.peakMemoryUsage = categoryMemoryUsage;
      categoryStats.networkUsage = categoryNetworkUsage;
      categoryStats.cacheHitRate = categoryCacheRequests > 0 ? (categoryCacheHits / categoryCacheRequests) * 100 : 0;
      
      summary.categories[category] = { status: 'success', ...categoryStats };
      
      totalExecutionTime += categoryExecutionTime;
      totalMemoryUsage = Math.max(totalMemoryUsage, categoryMemoryUsage);
      totalNetworkUsage += categoryNetworkUsage;
      totalCacheHits += categoryCacheHits;
      totalCacheRequests += categoryCacheRequests;
    }
    
    summary.totalBenchmarks = summary.successfulBenchmarks + summary.failedBenchmarks;
    summary.averageExecutionTime = totalExecutionTime / summary.successfulBenchmarks;
    summary.peakMemoryUsage = totalMemoryUsage;
    summary.totalNetworkUsage = totalNetworkUsage;
    summary.cacheHitRate = totalCacheRequests > 0 ? (totalCacheHits / totalCacheRequests) * 100 : 0;
    
    return summary;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(allBenchmarks) {
    const recommendations = [];
    
    for (const [category, benchmarks] of Object.entries(allBenchmarks)) {
      if (benchmarks.error) {
        recommendations.push({
          category,
          type: 'error',
          message: `Fix ${category} benchmark errors: ${benchmarks.error}`
        });
        continue;
      }
      
      for (const [benchmarkName, benchmark] of Object.entries(benchmarks)) {
        if (benchmark.error) continue;
        
        // Memory recommendations
        if (benchmark.memory?.peak?.rss > 500 * 1024 * 1024) { // 500MB
          recommendations.push({
            category,
            benchmark: benchmarkName,
            type: 'warning',
            message: 'High memory usage detected. Consider optimizing memory allocation.'
          });
        }
        
        // Network recommendations
        if (benchmark.network?.averageLatency > 1000) { // 1 second
          recommendations.push({
            category,
            benchmark: benchmarkName,
            type: 'warning',
            message: 'High network latency detected. Consider connection pooling or caching.'
          });
        }
        
        // Cache recommendations
        if (benchmark.cacheStats?.hitRate < 60) {
          recommendations.push({
            category,
            benchmark: benchmarkName,
            type: 'info',
            message: 'Low cache hit rate. Consider adjusting cache strategy.'
          });
        }
        
        // Performance recommendations
        if (benchmark.timing?.average > 5000) { // 5 seconds
          recommendations.push({
            category,
            benchmark: benchmarkName,
            type: 'warning',
            message: 'Slow execution time. Consider optimization.'
          });
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(report) {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Glassbox Performance Benchmark Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
        .metric h3 { margin: 0 0 10px; color: #333; }
        .metric .value { font-size: 2em; font-weight: bold; color: #667eea; }
        .category { margin-bottom: 30px; }
        .category h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-top: 30px; }
        .recommendation { margin-bottom: 15px; padding: 10px; background: white; border-radius: 4px; }
        .recommendation.warning { border-left: 4px solid #ffc107; }
        .recommendation.info { border-left: 4px solid #17a2b8; }
        .recommendation.error { border-left: 4px solid #dc3545; }
        .timestamp { text-align: center; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Glassbox Performance Report</h1>
            <p>Comprehensive performance benchmark results</p>
        </div>
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <h3>Total Benchmarks</h3>
                    <div class="value">${report.summary.totalBenchmarks}</div>
                </div>
                <div class="metric">
                    <h3>Success Rate</h3>
                    <div class="value">${((report.summary.successfulBenchmarks / report.summary.totalBenchmarks) * 100).toFixed(1)}%</div>
                </div>
                <div class="metric">
                    <h3>Avg Execution Time</h3>
                    <div class="value">${(report.summary.averageExecutionTime / 1000).toFixed(2)}s</div>
                </div>
                <div class="metric">
                    <h3>Peak Memory</h3>
                    <div class="value">${(report.summary.peakMemoryUsage / 1024 / 1024).toFixed(1)}MB</div>
                </div>
            </div>
            
            <div class="category">
                <h2>📊 Category Performance</h2>
                ${Object.entries(report.summary.categories).map(([category, stats]) => `
                    <div class="metric">
                        <h3>${category}</h3>
                        <p>Status: ${stats.status}</p>
                        ${stats.status === 'success' ? `
                            <p>Benchmarks: ${stats.benchmarks}</p>
                            <p>Avg Time: ${(stats.averageExecutionTime / 1000).toFixed(2)}s</p>
                            <p>Memory: ${(stats.peakMemoryUsage / 1024 / 1024).toFixed(1)}MB</p>
                        ` : `<p>Error: ${stats.error}</p>`}
                    </div>
                `).join('')}
            </div>
            
            ${report.recommendations.length > 0 ? `
                <div class="recommendations">
                    <h2>💡 Recommendations</h2>
                    ${report.recommendations.map(rec => `
                        <div class="recommendation ${rec.type}">
                            <strong>${rec.category}${rec.benchmark ? '/' + rec.benchmark : ''}:</strong> ${rec.message}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="timestamp">
                Generated on ${new Date(report.timestamp).toLocaleString()}
            </div>
        </div>
    </div>
</body>
</html>`;
    
    const htmlPath = path.join(this.options.outputDir, 'performance-report.html');
    await fs.promises.writeFile(htmlPath, htmlTemplate);
    
    console.log(`📊 HTML report saved to: ${htmlPath}`);
  }

  /**
   * List available benchmark categories
   */
  listBenchmarkCategories() {
    return Object.keys(this.benchmarkSuites);
  }

  /**
   * List available benchmarks in a category
   */
  listBenchmarksInCategory(category) {
    if (!this.benchmarkSuites[category]) {
      throw new Error(`Unknown benchmark category: ${category}`);
    }
    
    return Object.keys(this.benchmarkSuites[category].getBenchmarks());
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.runner.cleanup();
  }
}

/**
 * CLI interface for running benchmarks
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const suite = new PerformanceBenchmarkSuite({
    outputDir: './benchmarks/results',
    detailedLogging: args.includes('--verbose'),
    enableGarbageCollection: args.includes('--gc')
  });
  
  try {
    switch (command) {
      case 'all':
        await suite.runAllBenchmarks();
        break;
      case 'category':
        const category = args[1];
        if (!category) {
          console.error('Please specify a category');
          console.log('Available categories:', suite.listBenchmarkCategories().join(', '));
          process.exit(1);
        }
        await suite.runBenchmarkCategory(category);
        break;
      case 'benchmark':
        const benchmarkCategory = args[1];
        const benchmarkName = args[2];
        if (!benchmarkCategory || !benchmarkName) {
          console.error('Please specify category and benchmark name');
          process.exit(1);
        }
        await suite.runSpecificBenchmark(benchmarkCategory, benchmarkName);
        break;
      case 'list':
        const listCategory = args[1];
        if (listCategory) {
          console.log(`Benchmarks in ${listCategory}:`, suite.listBenchmarksInCategory(listCategory).join(', '));
        } else {
          console.log('Available categories:', suite.listBenchmarkCategories().join(', '));
        }
        break;
      default:
        console.log('Usage:');
        console.log('  node benchmarks/index.js all                    # Run all benchmarks');
        console.log('  node benchmarks/index.js category <category>    # Run category benchmarks');
        console.log('  node benchmarks/index.js benchmark <cat> <name> # Run specific benchmark');
        console.log('  node benchmarks/index.js list [category]        # List available benchmarks');
        console.log('');
        console.log('Options:');
        console.log('  --verbose  Enable detailed logging');
        console.log('  --gc       Enable garbage collection');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Benchmark error:', error.message);
    process.exit(1);
  } finally {
    suite.cleanup();
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

export { PerformanceBenchmarkSuite }; 