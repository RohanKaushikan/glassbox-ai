# Glassbox AI Response Caching System

The Glassbox caching system provides intelligent caching of AI responses to improve performance, reduce costs, and enhance user privacy. This system automatically caches AI responses based on prompt content and model parameters, with automatic invalidation and cleanup.

## Features

### 1. Smart Caching
- **Content-based caching**: Responses are cached based on prompt content and model parameters
- **Model-aware**: Different models have different cache entries
- **Parameter sensitivity**: Changes in temperature, max_tokens, etc. create new cache entries
- **Privacy protection**: Prompts are hashed using SHA-256 for privacy

### 2. TTL (Time-to-Live) Management
- **Default TTL**: 24 hours for most responses
- **Model-specific TTL**: Different models have different expiration times
- **Dynamic TTL**: Creative responses (high temperature) have shorter TTL
- **Factual responses**: Lower temperature responses have longer TTL

### 3. Compression and Storage
- **Automatic compression**: Responses are compressed using gzip
- **Local filesystem storage**: Cache stored in `.glassbox-cache/` directory
- **Size management**: Automatic cleanup when cache exceeds limits
- **Corruption handling**: Automatic detection and cleanup of corrupted entries

### 4. Cache Management
- **Statistics**: Detailed cache hit/miss statistics
- **Management commands**: CLI commands for cache operations
- **Automatic cleanup**: Expired entries are automatically removed
- **Size limits**: Configurable maximum cache size (default: 100MB)

## Usage

### Basic Caching

Caching is enabled by default. Simply run tests normally:

```bash
# Caching enabled (default)
glassbox test

# Explicitly enable caching
glassbox test --cache

# Disable caching
glassbox test --no-cache
```

### Cache Management Commands

#### View Cache Statistics
```bash
glassbox cache stats
```
Shows:
- Hit/miss rates
- Total cache size
- Number of entries
- Usage percentage
- Last cleanup time

#### List Cache Entries
```bash
# List all entries
glassbox cache list

# Limit number of entries shown
glassbox cache list --limit 10

# Show response content preview
glassbox cache list --show-content
```

#### Clear Cache
```bash
# Clear with confirmation
glassbox cache clear

# Force clear without confirmation
glassbox cache clear --force
```

#### Cleanup Expired Entries
```bash
glassbox cache cleanup
```
Removes expired entries and enforces size limits.

#### View Entry Details
```bash
glassbox cache details <cache-key>
```
Shows detailed information about a specific cache entry.

#### Invalidate Specific Entry
```bash
glassbox cache invalidate <cache-key>
```
Removes a specific cache entry.

## Configuration

### Cache Configuration File

Create `.glassbox-cache-config.json` in your project root:

```json
{
  "enabled": true,
  "cacheDir": ".glassbox-cache",
  "defaultTTL": 86400000,
  "maxCacheSize": 104857600,
  "compressionThreshold": 1024,
  "cleanupInterval": 3600000,
  "privacy": {
    "hashPrompts": true,
    "excludeSensitiveFields": ["api_key", "password", "token", "secret"]
  },
  "models": {
    "gpt-4": 43200000,
    "gpt-3.5-turbo": 86400000,
    "claude-3": 43200000,
    "llama2": 604800000
  }
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable caching |
| `cacheDir` | `.glassbox-cache` | Cache directory path |
| `defaultTTL` | `86400000` | Default TTL in milliseconds (24 hours) |
| `maxCacheSize` | `104857600` | Maximum cache size in bytes (100MB) |
| `compressionThreshold` | `1024` | Minimum size for compression (1KB) |
| `cleanupInterval` | `3600000` | Cleanup interval in milliseconds (1 hour) |

### Model-Specific TTL

Different models have different TTL values:

- **GPT-4**: 12 hours
- **GPT-3.5-turbo**: 24 hours
- **Claude-3**: 12 hours
- **Llama2**: 7 days

### Privacy Settings

- **Hash prompts**: All prompts are hashed using SHA-256
- **Exclude sensitive fields**: API keys and tokens are excluded from cache keys
- **Local storage**: Cache is stored locally, not transmitted

## Cache Key Generation

Cache keys are generated based on:
- Prompt content (trimmed)
- Model name
- Temperature
- Max tokens
- Top P
- Frequency penalty
- Presence penalty
- Stop sequences
- System prompt

All parameters are included in the cache key to ensure different responses for different configurations.

## Performance Benefits

### Speed Improvements
- **Cached responses**: Return instantly (sub-second)
- **Reduced API calls**: Lower latency and costs
- **Parallel execution**: Multiple tests can use cached responses simultaneously

### Cost Reduction
- **Fewer API calls**: Cached responses don't incur API costs
- **Token savings**: No token consumption for cached responses
- **Budget efficiency**: More tests can be run within budget limits

### Example Performance Gains

| Scenario | Without Cache | With Cache | Improvement |
|----------|---------------|------------|-------------|
| First run | 30s | 30s | 0% |
| Second run | 30s | 5s | 83% |
| Third run | 30s | 5s | 83% |

## Cache Statistics

The system tracks detailed statistics:

- **Hits**: Number of successful cache retrievals
- **Misses**: Number of cache misses
- **Hit rate**: Percentage of requests served from cache
- **Writes**: Number of new cache entries created
- **Invalidations**: Number of entries removed
- **Errors**: Number of cache operation errors
- **Total size**: Current cache size in bytes

## Error Handling

### Cache Corruption
- Automatic detection of corrupted cache files
- Automatic cleanup of corrupted entries
- Graceful degradation if cache is unavailable

### Disk Space Issues
- Automatic cleanup when disk space is low
- Size limit enforcement
- Warning messages for space issues

### Network Issues
- Cache continues to work during network outages
- Offline mode support for cached responses
- Automatic retry for cache operations

## Security and Privacy

### Data Protection
- **Local storage**: Cache is stored locally only
- **Hashed prompts**: Original prompts are not stored in plain text
- **No sensitive data**: API keys and tokens are excluded
- **Automatic cleanup**: Expired entries are automatically removed

### Privacy Features
- **SHA-256 hashing**: All prompts are hashed for privacy
- **No plain text storage**: Original prompts are not stored
- **Configurable exclusions**: Sensitive fields can be excluded
- **Local only**: Cache never leaves your machine

## Troubleshooting

### Common Issues

#### Cache Not Working
```bash
# Check if cache is enabled
glassbox cache stats

# Verify cache directory exists
ls -la .glassbox-cache/

# Check cache configuration
cat .glassbox-cache-config.json
```

#### High Disk Usage
```bash
# Check cache size
glassbox cache stats

# Clean up expired entries
glassbox cache cleanup

# Clear all cache if needed
glassbox cache clear
```

#### Cache Corruption
```bash
# Clear corrupted cache
glassbox cache clear

# Check for errors
glassbox cache stats
```

### Debug Mode

Enable verbose logging to debug cache issues:

```bash
glassbox test --verbose --cache
```

## Integration with Test Results

Cached responses are marked in test results:

```json
{
  "suite": "example",
  "test": "test-name",
  "cached": true,
  "cacheKey": "abc123...",
  "durationMs": 50,
  "modelUsed": "gpt-3.5-turbo"
}
```

## Best Practices

### When to Use Caching
- **Development**: Use caching during development to speed up iterations
- **Regression testing**: Cache helps with consistent test results
- **Cost optimization**: Reduce API costs for repeated tests
- **Offline development**: Work without internet using cached responses

### When to Disable Caching
- **Production testing**: Disable for final production tests
- **Model comparison**: Disable when comparing different models
- **Fresh responses**: When you need fresh responses every time
- **Debugging**: Disable when debugging model issues

### Cache Management
- **Regular cleanup**: Run `glassbox cache cleanup` periodically
- **Monitor size**: Check cache statistics regularly
- **Clear when needed**: Clear cache when switching models or configurations
- **Backup important**: Consider backing up cache for important test suites

## Advanced Configuration

### Custom Cache Directory
```bash
glassbox cache stats --cache-dir /custom/cache/path
```

### Model-Specific Settings
```json
{
  "models": {
    "gpt-4": {
      "ttl": 43200000,
      "maxSize": 52428800
    },
    "llama2": {
      "ttl": 604800000,
      "maxSize": 104857600
    }
  }
}
```

### Compression Settings
```json
{
  "compressionThreshold": 2048,
  "compressionLevel": 6
}
```

## Monitoring and Analytics

### Cache Performance Metrics
- **Hit rate**: Percentage of requests served from cache
- **Response time**: Average response time with/without cache
- **Cost savings**: Estimated cost savings from caching
- **Storage efficiency**: Compression ratios and storage usage

### Integration with CI/CD
```yaml
# GitHub Actions example
- name: Run tests with cache
  run: |
    glassbox test --cache
    glassbox cache stats
```

## Future Enhancements

### Planned Features
- **Distributed caching**: Share cache across team members
- **Cloud storage**: Optional cloud cache storage
- **Advanced analytics**: Detailed cache performance analytics
- **Smart invalidation**: Automatic invalidation based on model updates
- **Cache warming**: Pre-populate cache with common requests

### API Integration
```javascript
// Programmatic cache access
import { CacheManager } from './src/cache/cache-manager.js';

const cache = new CacheManager();
await cache.initialize();

// Get cached response
const response = await cache.get(prompt, model, params);

// Set cache entry
await cache.set(prompt, model, response, params, ttl);
```

## Support and Feedback

For issues, questions, or feature requests related to the caching system:

1. Check the troubleshooting section above
2. Review cache statistics and logs
3. Report issues with detailed information
4. Provide feedback on cache performance

The caching system is designed to be transparent and efficient, providing significant performance and cost benefits while maintaining data privacy and security. 