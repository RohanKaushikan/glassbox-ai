// Export all optimization modules
export { ConnectionPool, globalConnectionPool } from './connection-pool.js';
export { OptimizedAPIClient } from './optimized-api-client.js';
export { OptimizedParser } from './optimized-parser.js';
export { ProgressManager, globalProgressManager } from './progress-manager.js';
export { MemoryProfiler, globalMemoryProfiler } from './memory-profiler.js';
export { OptimizedTestRunner } from './optimized-runner.js';

// Re-export commonly used utilities
export { default as chalk } from 'chalk';
export { default as ora } from 'ora'; 