# Performance Benchmarks

Comprehensive performance benchmarking suite for the Glassbox CLI tool that measures various aspects of system performance, efficiency, and responsiveness.

## Overview

The performance benchmark suite provides detailed measurements across six key areas:

1. **Test Execution Performance** - Measures execution time for different suite sizes
2. **Memory Usage** - Monitors memory consumption during large test runs
3. **Network Efficiency** - Analyzes bandwidth usage and API call efficiency
4. **VS Code Extension Responsiveness** - Tests extension performance and UI responsiveness
5. **Startup Time** - Measures initialization overhead and startup performance
6. **Cache Performance** - Evaluates cache hit rates and storage efficiency

## Quick Start

### Run All Benchmarks

```bash
# Run complete benchmark suite
node src/benchmarks/index.js all

# Run with verbose logging
node src/benchmarks/index.js all --verbose

# Run with garbage collection enabled
node src/benchmarks/index.js all --gc
```

### Run Specific Categories

```bash
# Run only test execution benchmarks
node src/benchmarks/index.js category testExecution

# Run only memory benchmarks
node src/benchmarks/index.js category memory

# Run only network benchmarks
node src/benchmarks/index.js category network
```

### Run Individual Benchmarks

```bash
# Run specific benchmark
node src/benchmarks/index.js benchmark testExecution "Small Suite (5 tests)"

# Run VS Code extension responsiveness
node src/benchmarks/index.js benchmark vscode "Extension Command Responsiveness"
```

### List Available Benchmarks

```bash
# List all categories
node src/benchmarks/index.js list

# List benchmarks in a category
node src/benchmarks/index.js list testExecution
```

## Benchmark Categories

### 1. Test Execution Benchmarks

Measures execution time and performance for different test suite sizes and configurations.

**Available Benchmarks:**
- `Small Suite (5 tests)` - Tests with 5 test cases
- `Medium Suite (25 tests)` - Tests with 25 test cases
- `Large Suite (100 tests)` - Tests with 100 test cases
- `Extra Large Suite (500 tests)` - Tests with 500 test cases
- `Cached Execution` - Compares cached vs non-cached performance
- `Optimized Runner` - Tests optimized runner performance
- `Parallel vs Sequential` - Compares parallel and sequential execution
- `Model Performance Comparison` - Tests different AI models

**Metrics Measured:**
- Execution time (average, min, max, standard deviation)
- Success rate
- Memory usage
- Network requests and bandwidth

### 2. Memory Benchmarks

Monitors memory usage patterns, detects memory leaks, and measures memory efficiency.

**Available Benchmarks:**
- `Large Test Memory Usage` - Memory usage during large test runs
- `Optimized Runner Memory` - Memory usage with optimized runner
- `Cached Memory Usage` - Memory impact of caching
- `Memory Leak Detection` - Detects potential memory leaks
- `Concurrency Memory Usage` - Memory usage with different concurrency levels
- `Streaming Memory Usage` - Memory usage with streaming responses
- `Response Size Memory Usage` - Memory usage with different response sizes

**Metrics Measured:**
- RSS (Resident Set Size)
- Heap usage (used, total, external)
- Memory growth patterns
- Memory leak detection
- Garbage collection impact

### 3. Network Benchmarks

Analyzes network performance, latency, throughput, and connection efficiency.

**Available Benchmarks:**
- `Network Latency` - Measures API call latency
- `Network Throughput` - Tests data transfer rates
- `Connection Pooling` - Tests connection reuse efficiency
- `Batch Size Efficiency` - Tests different batch sizes
- `Cached Network Efficiency` - Network efficiency with caching
- `Network Error Handling` - Tests error handling and retries
- `Streaming Efficiency` - Compares streaming vs non-streaming
- `Model Network Performance` - Network performance with different models

**Metrics Measured:**
- Request latency (average, min, max, p95, p99)
- Network throughput (MB/s)
- Request count and error rates
- Data transfer efficiency
- Connection pooling effectiveness

### 4. VS Code Extension Benchmarks

Tests VS Code extension performance, command responsiveness, and UI updates.

**Available Benchmarks:**
- `Extension Command Responsiveness` - Tests command execution speed
- `UI Update Responsiveness` - Measures UI update performance
- `Extension Startup Time` - Tests extension activation time
- `File Validation Performance` - Tests file validation speed
- `Extension Memory Usage` - Monitors extension memory usage

**Metrics Measured:**
- Command execution time
- UI update latency
- Extension startup time
- File validation performance
- Memory usage patterns

### 5. Startup Benchmarks

Measures startup time, initialization overhead, and system boot performance.

**Available Benchmarks:**
- `CLI Startup Time` - Tests CLI initialization
- `Module Loading Performance` - Tests module loading speed
- `Configuration Parsing` - Tests config parsing performance
- `Cache Initialization` - Tests cache setup time
- `Optimized Runner Initialization` - Tests runner setup
- `File System Initialization` - Tests file system setup
- `Validation Initialization` - Tests validation system setup
- `Cold vs Warm Startup` - Compares cold and warm startup times
- `Startup Memory Usage` - Monitors memory during startup

**Metrics Measured:**
- Startup time (average, min, max)
- Module loading times
- Initialization step timing
- Memory usage during startup
- Cold vs warm startup performance

### 6. Cache Benchmarks

Evaluates cache performance, hit rates, storage efficiency, and cache management.

**Available Benchmarks:**
- `Cache Hit Rate Performance` - Tests cache hit rates
- `Cache Storage Efficiency` - Tests storage optimization
- `Cache Invalidation Performance` - Tests cache clearing speed
- `Cache TTL Performance` - Tests time-to-live functionality
- `Cache Memory Usage` - Monitors cache memory usage
- `Cache Key Distribution` - Tests key distribution efficiency
- `Cache Compression Efficiency` - Tests compression ratios
- `Cache Concurrent Access` - Tests concurrent access patterns
- `Cache Persistence Performance` - Tests cache persistence

**Metrics Measured:**
- Cache hit rates
- Storage efficiency
- Compression ratios
- Invalidation performance
- Memory usage patterns
- Concurrent access performance

## Output and Reports

### JSON Reports

Benchmark results are saved as JSON files in the `benchmarks/results/` directory:

```
benchmarks/results/
├── benchmark-2024-01-15T10-30-00-000Z.json
├── comprehensive-report.json
└── performance-report.html
```

### HTML Reports

Automatically generated HTML reports provide visual representation of benchmark results:

- **Summary Dashboard** - Overview of all benchmark categories
- **Category Performance** - Detailed breakdown by category
- **Recommendations** - Performance improvement suggestions
- **Interactive Charts** - Visual performance metrics

### Report Structure

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "platform": {
    "platform": "darwin",
    "arch": "x64",
    "nodeVersion": "v18.17.0"
  },
  "summary": {
    "totalBenchmarks": 48,
    "successfulBenchmarks": 45,
    "failedBenchmarks": 3,
    "averageExecutionTime": 1250.5,
    "peakMemoryUsage": 256000000,
    "totalNetworkUsage": 15.2,
    "cacheHitRate": 78.5
  },
  "categories": {
    "testExecution": { /* benchmark results */ },
    "memory": { /* benchmark results */ },
    "network": { /* benchmark results */ },
    "vscode": { /* benchmark results */ },
    "startup": { /* benchmark results */ },
    "cache": { /* benchmark results */ }
  },
  "recommendations": [
    {
      "category": "memory",
      "benchmark": "Large Test Memory Usage",
      "type": "warning",
      "message": "High memory usage detected. Consider optimizing memory allocation."
    }
  ]
}
```

## Configuration Options

### Benchmark Runner Options

```javascript
const suite = new PerformanceBenchmarkSuite({
  outputDir: './benchmarks/results',     // Output directory
  detailedLogging: false,                // Enable verbose logging
  enableGarbageCollection: false,        // Enable GC during benchmarks
  iterations: 3,                         // Number of benchmark iterations
  warmupRuns: 2,                        // Number of warmup runs
  memorySampling: 100                   // Memory sampling interval (ms)
});
```

### Environment Variables

```bash
# Enable garbage collection
export NODE_OPTIONS="--expose-gc"

# Set memory limits
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable detailed logging
export DEBUG="glassbox:benchmarks"
```

## Performance Recommendations

The benchmark suite automatically generates recommendations based on performance thresholds:

### Memory Recommendations
- **High Memory Usage** (>500MB): Consider optimizing memory allocation
- **Memory Leaks**: Review object lifecycle management
- **Poor Memory Recovery**: Check garbage collection patterns

### Network Recommendations
- **High Latency** (>1s): Consider connection pooling or caching
- **Low Throughput**: Optimize batch sizes or use streaming
- **High Error Rates**: Implement better retry strategies

### Cache Recommendations
- **Low Hit Rate** (<60%): Adjust cache strategy or TTL
- **High Storage Usage**: Consider compression or cleanup
- **Slow Invalidation**: Optimize cache clearing mechanisms

### Performance Recommendations
- **Slow Execution** (>5s): Consider parallelization or optimization
- **Slow Startup** (>500ms): Optimize initialization sequence
- **Poor UI Responsiveness** (>33ms): Optimize UI update patterns

## Best Practices

### Running Benchmarks

1. **Consistent Environment**: Run benchmarks in the same environment for comparable results
2. **Idle System**: Ensure system is idle to avoid interference
3. **Multiple Runs**: Run benchmarks multiple times to account for variance
4. **Garbage Collection**: Enable GC for accurate memory measurements
5. **Network Stability**: Ensure stable network connection for network benchmarks

### Interpreting Results

1. **Baseline Comparison**: Compare against previous benchmark runs
2. **Threshold Analysis**: Use performance thresholds to identify issues
3. **Trend Analysis**: Look for performance trends over time
4. **Recommendation Review**: Pay attention to generated recommendations
5. **Category Correlation**: Consider relationships between different benchmark categories

### Performance Optimization

1. **Memory Optimization**: Monitor memory usage patterns and optimize allocations
2. **Network Optimization**: Use connection pooling and caching strategies
3. **Cache Optimization**: Adjust cache strategies based on hit rates
4. **Startup Optimization**: Optimize initialization sequences
5. **UI Optimization**: Ensure responsive UI updates

## Troubleshooting

### Common Issues

**Benchmark Failures:**
```bash
# Check for missing dependencies
npm install

# Verify API configuration
export OPENAI_API_KEY="your-api-key"

# Check file permissions
chmod +x src/benchmarks/index.js
```

**Memory Issues:**
```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Enable garbage collection
export NODE_OPTIONS="--expose-gc"
```

**Network Issues:**
```bash
# Check network connectivity
ping api.openai.com

# Verify API keys
echo $OPENAI_API_KEY
```

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Run with verbose logging
node src/benchmarks/index.js all --verbose

# Check specific benchmark
node src/benchmarks/index.js benchmark testExecution "Small Suite (5 tests)" --verbose
```

## Integration

### CI/CD Integration

Add benchmarks to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run Performance Benchmarks
  run: |
    node src/benchmarks/index.js all
    # Upload results as artifacts
    cp -r benchmarks/results/ ${{ github.workspace }}/benchmark-results/
```

### Automated Monitoring

Set up automated performance monitoring:

```javascript
// Automated benchmark runner
import { PerformanceBenchmarkSuite } from './src/benchmarks/index.js';

const suite = new PerformanceBenchmarkSuite();
const results = await suite.runAllBenchmarks();

// Check performance thresholds
if (results.summary.averageExecutionTime > 5000) {
  console.error('Performance degradation detected');
  process.exit(1);
}
```

## Contributing

### Adding New Benchmarks

1. Create benchmark class in appropriate category
2. Implement benchmark methods
3. Add to benchmark suite
4. Update documentation

### Benchmark Guidelines

- **Consistent Naming**: Use descriptive benchmark names
- **Proper Metrics**: Include relevant performance metrics
- **Error Handling**: Implement proper error handling
- **Resource Cleanup**: Clean up resources after benchmarks
- **Documentation**: Document benchmark purpose and metrics

## License

This benchmark suite is part of the Glassbox CLI tool and follows the same license terms. 