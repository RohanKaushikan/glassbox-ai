#!/usr/bin/env node

import { OptimizedTestRunner } from './src/optimization/optimized-runner.js';
import { globalMemoryProfiler } from './src/optimization/memory-profiler.js';
import { globalProgressManager } from './src/optimization/progress-manager.js';
import { globalConnectionPool } from './src/optimization/connection-pool.js';
import chalk from 'chalk';

/**
 * Performance test script to demonstrate optimizations
 */
async function testPerformance() {
  console.log(chalk.bold.blue('🚀 Glassbox Performance Test Suite\n'));

  // Create sample test data
  const testObjects = createSampleTests();

  // Test configurations
  const configurations = [
    {
      name: 'Standard Runner',
      options: {
        enableCaching: true,
        enableProgress: false,
        enableMemoryProfiling: false,
        enableStreaming: false
      }
    },
    {
      name: 'Optimized Runner (Basic)',
      options: {
        maxConcurrency: 5,
        batchSize: 10,
        enableCaching: true,
        enableProgress: true,
        enableMemoryProfiling: false,
        enableStreaming: false
      }
    },
    {
      name: 'Optimized Runner (Advanced)',
      options: {
        maxConcurrency: 10,
        batchSize: 20,
        enableCaching: true,
        enableProgress: true,
        enableMemoryProfiling: true,
        enableStreaming: true
      }
    }
  ];

  const results = [];

  for (const config of configurations) {
    console.log(chalk.cyan(`\n📊 Testing: ${config.name}`));
    console.log(chalk.gray('─'.repeat(50)));

    // Clear previous stats
    globalMemoryProfiler.clear();
    globalProgressManager.clear();

    // Start memory profiling
    globalMemoryProfiler.start();

    const startTime = Date.now();
    
    try {
      const runner = new OptimizedTestRunner(config.options);
      const result = await runner.runTests(testObjects);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Get statistics
      const memoryStats = globalMemoryProfiler.getMemoryReport();
      const progressStats = globalProgressManager.getStats();
      const runnerStats = runner.getStats();
      
      const performanceResult = {
        config: config.name,
        duration,
        testCount: result.raw.length,
        successRate: result.aggregated.summary.successRate,
        averageResponseTime: result.aggregated.performance.averageDuration,
        cacheHitRate: result.aggregated.cache.hitRate,
        memoryUsage: memoryStats.current.heapUsed,
        memoryTrend: memoryStats.trend,
        activeConnections: globalConnectionPool.getStats().activeConnections
      };
      
      results.push(performanceResult);
      
      // Display results
      console.log(chalk.green(`✅ Completed in ${formatTime(duration)}`));
      console.log(chalk.gray(`   Tests: ${performanceResult.testCount}`));
      console.log(chalk.gray(`   Success Rate: ${performanceResult.successRate.toFixed(1)}%`));
      console.log(chalk.gray(`   Avg Response Time: ${formatTime(performanceResult.averageResponseTime)}`));
      console.log(chalk.gray(`   Cache Hit Rate: ${performanceResult.cacheHitRate.toFixed(1)}%`));
      console.log(chalk.gray(`   Memory Usage: ${formatBytes(performanceResult.memoryUsage)}`));
      console.log(chalk.gray(`   Active Connections: ${performanceResult.activeConnections}`));
      
      // Cleanup
      await runner.cleanup();
      globalMemoryProfiler.stop();
      
    } catch (error) {
      console.log(chalk.red(`❌ Failed: ${error.message}`));
    }
  }

  // Compare results
  console.log(chalk.bold.blue('\n📈 Performance Comparison'));
  console.log(chalk.gray('─'.repeat(80)));
  
  const baseline = results[0];
  console.log(chalk.cyan('Configuration') + '          ' + 
              chalk.cyan('Duration') + '    ' + 
              chalk.cyan('Speedup') + '    ' + 
              chalk.cyan('Memory') + '      ' + 
              chalk.cyan('Cache Hit'));
  
  for (const result of results) {
    const speedup = baseline.duration / result.duration;
    const speedupColor = speedup > 1 ? chalk.green : chalk.red;
    
    console.log(
      result.config.padEnd(20) + ' ' +
      formatTime(result.duration).padEnd(12) + ' ' +
      speedupColor(speedup.toFixed(2) + 'x').padEnd(10) + ' ' +
      formatBytes(result.memoryUsage).padEnd(12) + ' ' +
      result.cacheHitRate.toFixed(1) + '%'
    );
  }

  // Recommendations
  console.log(chalk.bold.blue('\n💡 Recommendations'));
  console.log(chalk.gray('─'.repeat(30)));
  
  const bestResult = results.reduce((best, current) => 
    current.duration < best.duration ? current : best
  );
  
  console.log(chalk.green(`• Best performance: ${bestResult.config}`));
  
  if (results[2].duration < results[1].duration) {
    console.log(chalk.yellow('• Advanced optimizations provide additional benefits'));
  }
  
  if (results[1].cacheHitRate > 50) {
    console.log(chalk.blue('• High cache hit rate indicates good caching strategy'));
  }
  
  if (results[2].memoryTrend > 0.1) {
    console.log(chalk.red('• Memory growth detected - consider memory optimization'));
  }
}

/**
 * Create sample test data
 */
function createSampleTests() {
  return [
    {
      name: 'Performance Test Suite',
      tests: [
        {
          name: 'Simple Math',
          description: 'Test basic arithmetic',
          prompt: 'What is 2 + 2?',
          expect: {
            contains: ['4']
          }
        },
        {
          name: 'Greeting',
          description: 'Test greeting response',
          prompt: 'Say hello',
          expect: {
            contains: ['hello', 'hi']
          }
        },
        {
          name: 'Factual Response',
          description: 'Test factual information',
          prompt: 'What is the capital of France?',
          expect: {
            contains: ['Paris']
          }
        },
        {
          name: 'Creative Writing',
          description: 'Test creative response',
          prompt: 'Write a short poem about coding',
          expect: {
            contains: ['code', 'program']
          }
        },
        {
          name: 'Long Response',
          description: 'Test longer response generation',
          prompt: 'Explain the benefits of automated testing in software development',
          expect: {
            contains: ['test', 'quality', 'automation']
          }
        }
      ],
      settings: {
        max_tokens: 100,
        temperature: 0.7
      }
    }
  ];
}

/**
 * Format time in human readable format
 */
function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Run the performance test
testPerformance().catch(console.error); 