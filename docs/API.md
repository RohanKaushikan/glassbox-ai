# Glassbox AI API Documentation

> **Complete API reference for Glassbox AI enterprise testing framework**

This document provides comprehensive API documentation for Glassbox AI, including CLI commands, YAML test specifications, configuration options, programmatic usage, and plugin architecture.

## 📚 Table of Contents

1. [CLI Command Reference](#cli-command-reference)
2. [YAML Test Format Specification](#yaml-test-format-specification)
3. [Configuration File Format](#configuration-file-format)
4. [VS Code Extension API](#vs-code-extension-api)
5. [Programmatic Usage](#programmatic-usage)
6. [Plugin Architecture](#plugin-architecture)
7. [Error Codes & Troubleshooting](#error-codes--troubleshooting)

## 🖥️ CLI Command Reference

### Global Options

```bash
glassbox [command] [options]

Global Options:
  -V, --version          Output the version number
  -h, --help            Display help for command
  --config <path>       Path to configuration file (default: .glassbox/config.yml)
  --verbose             Enable verbose output
  --debug               Enable debug logging
  --format <format>     Output format: human, json, machine (default: human)
  --output <path>       Output file path for results
  --parallel            Enable parallel test execution
  --concurrency <num>   Number of concurrent tests (default: 5)
  --timeout <ms>        Global timeout in milliseconds (default: 30000)
  --max-cost <usd>      Maximum cost per test in USD (default: 0.10)
  --max-tokens <num>    Maximum tokens per response (default: 1000)
```

### Core Commands

#### `glassbox init`

Initialize a new Glassbox AI project.

```bash
glassbox init [options]

Options:
  --template <name>     Template to use: basic, advanced, enterprise (default: basic)
  --force              Overwrite existing files
  --skip-examples      Skip creating example test files
  --config-only        Only create configuration files
```

**Examples:**
```bash
# Initialize with basic template
glassbox init

# Initialize with enterprise template
glassbox init --template enterprise

# Initialize without examples
glassbox init --skip-examples
```

#### `glassbox test`

Run AI tests using YAML test files.

```bash
glassbox test [options] [files...]

Options:
  --file <path>         Specific test file to run
  --suite <name>        Test suite name to run
  --filter <pattern>    Filter tests by name pattern
  --exclude <pattern>   Exclude tests by name pattern
  --reliability         Enable enterprise reliability features
  --metrics             Enable detailed metrics collection
  --health-check        Run health checks before tests
  --dry-run             Show what would be tested without running
  --retry <num>         Number of retry attempts (default: 2)
  --retry-delay <ms>    Delay between retries in milliseconds (default: 1000)
  --circuit-breaker     Enable circuit breaker pattern
  --fallback            Enable fallback mechanisms
  --queue               Enable request queuing
  --throttle <rate>     Request throttle rate per second (default: 50)
  --export-metrics      Export metrics to file
  --export-format <fmt> Metrics export format: json, csv, prometheus (default: json)
```

**Examples:**
```bash
# Run all tests in current directory
glassbox test

# Run specific test file
glassbox test --file customer-support.yml

# Run with reliability features
glassbox test --reliability --metrics

# Run with custom configuration
glassbox test --config custom-config.yml --parallel --concurrency 10

# Run with filtering
glassbox test --filter "greeting" --exclude "payment"

# Export results
glassbox test --output results.json --format json
```

#### `glassbox validate`

Validate test files and configuration.

```bash
glassbox validate [options] [files...]

Options:
  --file <path>         Specific file to validate
  --config              Validate configuration files
  --schema              Show YAML schema
  --fix                 Attempt to fix validation errors
  --strict              Enable strict validation mode
```

**Examples:**
```bash
# Validate all test files
glassbox validate

# Validate specific file
glassbox validate --file test.yml

# Validate configuration
glassbox validate --config

# Show schema
glassbox validate --schema
```

#### `glassbox report`

Generate test reports and analytics.

```bash
glassbox report [options]

Options:
  --format <fmt>        Report format: html, json, csv, markdown (default: html)
  --output <path>       Output file path
  --template <path>     Custom report template
  --metrics             Include detailed metrics
  --reliability         Include reliability metrics
  --performance         Include performance metrics
  --cost-analysis       Include cost analysis
  --trends              Include trend analysis
  --since <date>        Include data since date (ISO format)
  --until <date>        Include data until date (ISO format)
```

**Examples:**
```bash
# Generate HTML report
glassbox report --format html --output report.html

# Generate JSON report with metrics
glassbox report --format json --metrics --output metrics.json

# Generate cost analysis
glassbox report --cost-analysis --output cost-report.csv
```

#### `glassbox health`

Check system health and connectivity.

```bash
glassbox health [options]

Options:
  --ai-models           Check AI model connectivity
  --reliability         Check reliability components
  --metrics             Check metrics collection
  --queue               Check request queue status
  --circuit-breaker     Check circuit breaker status
  --detailed            Show detailed health information
  --timeout <ms>        Health check timeout (default: 10000)
```

**Examples:**
```bash
# Check overall health
glassbox health

# Check AI models
glassbox health --ai-models

# Detailed health check
glassbox health --detailed
```

#### `glassbox cache`

Manage test cache and results.

```bash
glassbox cache [options]

Options:
  --clear               Clear all cache
  --list                List cached items
  --size                Show cache size
  --cleanup             Clean up old cache entries
  --export <path>       Export cache to file
  --import <path>       Import cache from file
  --ttl <seconds>       Set cache TTL in seconds
```

**Examples:**
```bash
# Clear cache
glassbox cache --clear

# List cached items
glassbox cache --list

# Export cache
glassbox cache --export cache.json
```

#### `glassbox plugins`

Manage custom plugins and validators.

```bash
glassbox plugins [options]

Options:
  --list                List installed plugins
  --install <name>      Install plugin
  --uninstall <name>    Uninstall plugin
  --update <name>       Update plugin
  --info <name>         Show plugin information
  --validate <name>     Validate plugin
  --registry <url>      Plugin registry URL
```

**Examples:**
```bash
# List plugins
glassbox plugins --list

# Install plugin
glassbox plugins --install custom-validator

# Show plugin info
glassbox plugins --info custom-validator
```

## 📝 YAML Test Format Specification

### Basic Structure

```yaml
name: "Test Suite Name"
description: "Optional description of the test suite"

settings:
  max_cost_usd: 0.10
  max_tokens: 1000
  timeout_ms: 30000
  reliability:
    enabled: true
    auto_start: true

tests:
  - name: "Test Name"
    description: "Optional test description"
    prompt: "The prompt to send to the AI model"
    expect:
      contains: ["required", "words"]
      not_contains: ["forbidden", "words"]
      max_tokens: 200
      block_patterns: ["pii", "sensitive"]
```

### Complete Schema

```yaml
# Test Suite Configuration
name: string                    # Required: Test suite name
description: string             # Optional: Test suite description
version: string                 # Optional: Test suite version
author: string                  # Optional: Test suite author
tags: [string]                  # Optional: Test suite tags

# Global Settings
settings:
  max_cost_usd: number          # Maximum cost per test in USD
  max_tokens: number            # Maximum tokens per response
  timeout_ms: number            # Test timeout in milliseconds
  similarity_threshold: number  # Fuzzy matching threshold (0-1)
  reliability:
    enabled: boolean            # Enable reliability features
    auto_start: boolean         # Auto-start reliability components
    circuit_breaker:
      failure_threshold: number # Circuit breaker failure threshold
      success_threshold: number # Circuit breaker success threshold
      timeout: number           # Circuit breaker timeout
    backoff:
      base_delay: number        # Base delay for exponential backoff
      max_delay: number         # Maximum delay for backoff
      max_attempts: number      # Maximum retry attempts
      jitter_factor: number     # Jitter factor (0-1)
    queue:
      max_concurrency: number   # Maximum concurrent requests
      max_queue_size: number    # Maximum queue size
      throttle_rate: number     # Requests per second
    health:
      check_interval: number    # Health check interval
      timeout: number           # Health check timeout
      retries: number           # Health check retries
    metrics:
      enabled: boolean          # Enable metrics collection
      export_interval: number   # Metrics export interval
    shutdown:
      shutdown_timeout: number  # Shutdown timeout
      force_kill_timeout: number # Force kill timeout

# AI Model Configuration
models:
  primary: string               # Primary model name
  fallbacks: [string]           # Fallback model names
  ollama:
    host: string                # Ollama host URL
    model: string               # Ollama model name
    timeout: number             # Ollama timeout
  openai:
    api_key: string             # OpenAI API key
    model: string               # OpenAI model name
    timeout: number             # OpenAI timeout

# Validation Configuration
validation:
  fuzzy_matching: boolean       # Enable fuzzy string matching
  similarity_threshold: number  # Similarity threshold (0-1)
  pii_detection: boolean        # Enable PII detection
  cost_tracking: boolean        # Enable cost tracking
  block_patterns: [string]      # Global blocked patterns

# Test Definitions
tests:
  - name: string                # Required: Test name
    description: string         # Optional: Test description
    tags: [string]              # Optional: Test tags
    priority: number            # Optional: Test priority (1-5)
    prompt: string              # Required: Test prompt
    context: string             # Optional: Additional context
    variables:                  # Optional: Test variables
      key: value
    expect:
      contains: [string]        # Required words/phrases
      not_contains: [string]    # Forbidden words/phrases
      exact_match: string       # Exact response match
      regex_match: string       # Regex pattern match
      max_tokens: number        # Maximum response tokens
      min_tokens: number        # Minimum response tokens
      max_cost_usd: number      # Maximum test cost
      max_response_time_ms: number # Maximum response time
      similarity_threshold: number # Response similarity threshold
      block_patterns: [string]  # Blocked patterns for this test
      allow_patterns: [string]  # Allowed patterns for this test
      model_consistency: boolean # Check model consistency
      fallback_used: boolean    # Check if fallback was used
      circuit_breaker_trips: number # Maximum circuit breaker trips
      retry_attempts: number    # Maximum retry attempts
      queue_time_ms: number     # Maximum queue time
      health_status: string     # Expected health status
      metrics:
        response_time_p95: number # 95th percentile response time
        success_rate: number    # Expected success rate
        error_rate: number      # Maximum error rate
        cost_per_token: number  # Maximum cost per token
```

### Advanced Features

#### Variables and Templating

```yaml
tests:
  - name: "Dynamic Test"
    prompt: "Hello {{name}}, how can I help you with {{issue}}?"
    variables:
      name: "John"
      issue: "order status"
    expect:
      contains: ["hello", "help", "order"]
```

#### Conditional Tests

```yaml
tests:
  - name: "Conditional Test"
    prompt: "What is the weather?"
    condition:
      environment: "production"
      model: "gpt-4"
    expect:
      contains: ["weather", "temperature"]
```

#### Test Dependencies

```yaml
tests:
  - name: "Setup Test"
    prompt: "Initialize session"
    expect:
      contains: ["session", "initialized"]

  - name: "Dependent Test"
    prompt: "Get user data"
    depends_on: "Setup Test"
    expect:
      contains: ["user", "data"]
```

## ⚙️ Configuration File Format

### Global Configuration (`.glassbox/config.yml`)

```yaml
# Global Settings
settings:
  max_concurrency: 5
  test_timeout_ms: 30000
  max_retries: 2
  default_format: "human"
  log_level: "info"
  cache_enabled: true
  cache_ttl: 3600

# Reliability Configuration
reliability:
  enabled: true
  auto_start: true
  
  backoff:
    base_delay: 1000
    max_delay: 30000
    max_attempts: 5
    jitter_factor: 0.1
  
  circuit_breaker:
    failure_threshold: 5
    success_threshold: 2
    timeout: 60000
    monitoring_period: 60000
  
  health:
    check_interval: 30000
    timeout: 10000
    retries: 2
  
  queue:
    max_concurrency: 10
    max_queue_size: 100
    throttle_rate: 50
    timeout: 30000
    retry_attempts: 3
  
  metrics:
    enabled: true
    export_interval: 60000
  
  shutdown:
    shutdown_timeout: 30000
    force_kill_timeout: 5000

# AI Model Configuration
models:
  primary: "ollama"
  fallbacks: ["openai", "local"]
  
  ollama:
    host: "http://localhost:11434"
    model: "llama2"
    timeout: 30000
  
  openai:
    api_key: "${OPENAI_API_KEY}"
    model: "gpt-3.5-turbo"
    timeout: 30000

# Validation Configuration
validation:
  fuzzy_matching: true
  similarity_threshold: 0.7
  pii_detection: true
  cost_tracking: true

# Plugin Configuration
plugins:
  enabled: true
  registry: "https://registry.glassbox.ai"
  auto_update: true
  
  custom_validators:
    - name: "custom-validator"
      path: "./plugins/custom-validator.js"
      config:
        threshold: 0.8

# Logging Configuration
logging:
  level: "info"
  format: "json"
  output: "file"
  file: ".glassbox/logs/glassbox.log"
  max_size: "10MB"
  max_files: 5

# Metrics Configuration
metrics:
  enabled: true
  export_interval: 60000
  storage: "file"
  file: ".glassbox/metrics/metrics.json"
  retention_days: 30

# Security Configuration
security:
  pii_detection: true
  block_patterns:
    - "credit_card"
    - "ssn"
    - "email"
  allow_patterns: []
  encryption: false
  audit_log: true
```

### Environment Variables

```bash
# AI Model Configuration
OPENAI_API_KEY=your_openai_api_key
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2

# Reliability Configuration
RELIABILITY_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
HEALTH_CHECK_INTERVAL=30000
QUEUE_MAX_CONCURRENCY=10

# Metrics Configuration
METRICS_EXPORT_INTERVAL=60000
METRICS_STORAGE=file

# Security Configuration
PII_DETECTION_ENABLED=true
AUDIT_LOG_ENABLED=true

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
```

## 🔌 VS Code Extension API

### Extension Configuration

```json
{
  "glassbox.enabled": true,
  "glassbox.configPath": ".glassbox/config.yml",
  "glassbox.defaultModel": "ollama",
  "glassbox.autoValidate": true,
  "glassbox.showMetrics": true,
  "glassbox.reliabilityEnabled": true,
  "glassbox.debugMode": false
}
```

### Commands

#### `glassbox.runTest`
Run a specific test or test suite.

```typescript
interface RunTestOptions {
  file?: string;
  suite?: string;
  reliability?: boolean;
  metrics?: boolean;
  format?: 'human' | 'json' | 'machine';
  output?: string;
}

vscode.commands.executeCommand('glassbox.runTest', options);
```

#### `glassbox.validateFile`
Validate a YAML test file.

```typescript
interface ValidateOptions {
  file: string;
  fix?: boolean;
  strict?: boolean;
}

vscode.commands.executeCommand('glassbox.validateFile', options);
```

#### `glassbox.showReport`
Generate and display test report.

```typescript
interface ReportOptions {
  format?: 'html' | 'json' | 'csv';
  metrics?: boolean;
  reliability?: boolean;
  output?: string;
}

vscode.commands.executeCommand('glassbox.showReport', options);
```

#### `glassbox.checkHealth`
Check system health status.

```typescript
interface HealthOptions {
  detailed?: boolean;
  aiModels?: boolean;
  reliability?: boolean;
}

vscode.commands.executeCommand('glassbox.checkHealth', options);
```

### Language Server Protocol

#### YAML Schema Support

```json
{
  "yaml.schemas": {
    ".glassbox/schema.json": "**/*.yml",
    ".glassbox/schema.json": "**/*.yaml"
  }
}
```

#### IntelliSense Features

- Auto-completion for test properties
- Validation of YAML structure
- Error highlighting
- Quick fixes for common issues
- Hover information for properties

### Extension Events

```typescript
// Test execution events
vscode.window.onDidChangeActiveTextEditor((editor) => {
  if (editor?.document.fileName.endsWith('.yml')) {
    // Auto-validate YAML files
    vscode.commands.executeCommand('glassbox.validateFile', {
      file: editor.document.fileName
    });
  }
});

// Test results events
vscode.workspace.onDidSaveTextDocument((document) => {
  if (document.fileName.includes('test')) {
    // Auto-run tests on save
    vscode.commands.executeCommand('glassbox.runTest', {
      file: document.fileName
    });
  }
});
```

## 💻 Programmatic Usage

### Basic Usage

```javascript
import { GlassboxAI } from 'glassbox-ai';

// Initialize Glassbox AI
const glassbox = new GlassboxAI({
  configPath: '.glassbox/config.yml',
  reliability: {
    enabled: true,
    autoStart: true
  }
});

// Run tests programmatically
async function runTests() {
  try {
    const results = await glassbox.runTests({
      files: ['tests/customer-support.yml'],
      options: {
        reliability: true,
        metrics: true,
        format: 'json'
      }
    });
    
    console.log('Test results:', results);
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Validate test files
async function validateTests() {
  const validation = await glassbox.validateTests({
    files: ['tests/*.yml'],
    strict: true
  });
  
  console.log('Validation results:', validation);
}
```

### Advanced Usage

```javascript
import { GlassboxAI, ReliabilityManager, MetricsCollector } from 'glassbox-ai';

// Initialize with custom components
const glassbox = new GlassboxAI({
  reliability: {
    enabled: true,
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000
    },
    backoff: {
      baseDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 5
    }
  },
  metrics: {
    enabled: true,
    exportInterval: 60000
  }
});

// Custom test execution
async function customTestExecution() {
  const testSuite = {
    name: "Custom Test Suite",
    tests: [
      {
        name: "Custom Test",
        prompt: "What is artificial intelligence?",
        expect: {
          contains: ["AI", "artificial", "intelligence"],
          maxTokens: 200
        }
      }
    ]
  };
  
  const results = await glassbox.runTestSuite(testSuite, {
    reliability: true,
    metrics: true
  });
  
  return results;
}

// Direct component usage
async function directComponentUsage() {
  const reliabilityManager = new ReliabilityManager({
    failureThreshold: 5,
    successThreshold: 2
  });
  
  const metricsCollector = new MetricsCollector({
    enabled: true,
    exportInterval: 60000
  });
  
  // Register services
  reliabilityManager.registerService('ai_model', async (prompt) => {
    // Custom AI model implementation
    return await callAIModel(prompt);
  });
  
  // Execute with reliability
  const result = await reliabilityManager.executeWithReliability('ai_model', [
    "What is machine learning?"
  ]);
  
  return result;
}
```

### Event Handling

```javascript
// Listen to test events
glassbox.on('test:start', (test) => {
  console.log(`Starting test: ${test.name}`);
});

glassbox.on('test:complete', (test, result) => {
  console.log(`Completed test: ${test.name}`, result);
});

glassbox.on('test:error', (test, error) => {
  console.error(`Test failed: ${test.name}`, error);
});

glassbox.on('reliability:circuit_open', (service) => {
  console.log(`Circuit breaker opened for service: ${service}`);
});

glassbox.on('metrics:export', (metrics) => {
  console.log('Metrics exported:', metrics);
});
```

### Plugin Integration

```javascript
// Custom validator plugin
class CustomValidator {
  constructor(config) {
    this.config = config;
  }
  
  async validate(response, expectations) {
    // Custom validation logic
    const isValid = await this.customValidationLogic(response, expectations);
    return {
      valid: isValid,
      score: isValid ? 1.0 : 0.0,
      details: {
        customMetric: this.calculateCustomMetric(response)
      }
    };
  }
  
  async customValidationLogic(response, expectations) {
    // Implement custom validation
    return true;
  }
  
  calculateCustomMetric(response) {
    // Calculate custom metric
    return 0.95;
  }
}

// Register custom validator
glassbox.registerValidator('custom', CustomValidator);

// Use custom validator in tests
const testWithCustomValidator = {
  name: "Custom Validator Test",
  prompt: "Explain AI",
  expect: {
    contains: ["AI", "artificial", "intelligence"],
    validators: ["custom"]
  }
};
```

## 🔧 Plugin Architecture

### Plugin Structure

```
plugins/
├── custom-validator/
│   ├── package.json
│   ├── index.js
│   ├── validator.js
│   ├── config.yml
│   └── README.md
├── custom-metrics/
│   ├── package.json
│   ├── index.js
│   ├── metrics.js
│   └── config.yml
└── custom-reporter/
    ├── package.json
    ├── index.js
    ├── reporter.js
    └── config.yml
```

### Validator Plugin

```javascript
// plugins/custom-validator/index.js
export class CustomValidator {
  constructor(config = {}) {
    this.config = {
      threshold: 0.8,
      ...config
    };
  }
  
  async validate(response, expectations) {
    // Custom validation logic
    const score = this.calculateScore(response, expectations);
    const valid = score >= this.config.threshold;
    
    return {
      valid,
      score,
      details: {
        customMetric: this.calculateCustomMetric(response),
        threshold: this.config.threshold
      }
    };
  }
  
  calculateScore(response, expectations) {
    // Implement custom scoring logic
    return 0.9;
  }
  
  calculateCustomMetric(response) {
    // Calculate custom metric
    return {
      length: response.length,
      complexity: this.calculateComplexity(response)
    };
  }
  
  calculateComplexity(response) {
    // Calculate response complexity
    return response.split(' ').length;
  }
}
```

### Metrics Plugin

```javascript
// plugins/custom-metrics/index.js
export class CustomMetrics {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      ...config
    };
  }
  
  async collectMetrics(test, result) {
    return {
      customMetric: this.calculateCustomMetric(test, result),
      responseQuality: this.calculateResponseQuality(result.response),
      testComplexity: this.calculateTestComplexity(test)
    };
  }
  
  calculateCustomMetric(test, result) {
    // Calculate custom metric
    return {
      promptLength: test.prompt.length,
      responseLength: result.response.length,
      ratio: result.response.length / test.prompt.length
    };
  }
  
  calculateResponseQuality(response) {
    // Calculate response quality
    return {
      readability: this.calculateReadability(response),
      coherence: this.calculateCoherence(response)
    };
  }
  
  calculateTestComplexity(test) {
    // Calculate test complexity
    return {
      promptComplexity: this.calculatePromptComplexity(test.prompt),
      expectationComplexity: this.calculateExpectationComplexity(test.expect)
    };
  }
}
```

### Reporter Plugin

```javascript
// plugins/custom-reporter/index.js
export class CustomReporter {
  constructor(config = {}) {
    this.config = {
      format: 'html',
      template: 'default',
      ...config
    };
  }
  
  async generateReport(results, options = {}) {
    const report = {
      summary: this.generateSummary(results),
      details: this.generateDetails(results),
      metrics: this.generateMetrics(results),
      recommendations: this.generateRecommendations(results)
    };
    
    return this.formatReport(report, options);
  }
  
  generateSummary(results) {
    return {
      totalTests: results.length,
      passedTests: results.filter(r => r.valid).length,
      failedTests: results.filter(r => !r.valid).length,
      successRate: this.calculateSuccessRate(results)
    };
  }
  
  generateDetails(results) {
    return results.map(result => ({
      name: result.test.name,
      status: result.valid ? 'PASS' : 'FAIL',
      score: result.score,
      duration: result.duration,
      cost: result.cost
    }));
  }
  
  generateMetrics(results) {
    return {
      averageScore: this.calculateAverageScore(results),
      averageDuration: this.calculateAverageDuration(results),
      totalCost: this.calculateTotalCost(results)
    };
  }
  
  generateRecommendations(results) {
    return [
      {
        type: 'performance',
        message: 'Consider optimizing prompts for better performance',
        priority: 'medium'
      },
      {
        type: 'cost',
        message: 'Review token usage to reduce costs',
        priority: 'high'
      }
    ];
  }
}
```

### Plugin Configuration

```yaml
# plugins/custom-validator/config.yml
name: "custom-validator"
version: "1.0.0"
description: "Custom validator for specialized testing"
author: "Your Name"
license: "MIT"

validator:
  class: "CustomValidator"
  config:
    threshold: 0.8
    customOption: "value"

dependencies:
  - "fastest-levenshtein"
  - "lodash"

hooks:
  preValidate:
    - "validateInput"
  postValidate:
    - "logResults"

# plugins/custom-metrics/config.yml
name: "custom-metrics"
version: "1.0.0"
description: "Custom metrics collection"
author: "Your Name"
license: "MIT"

metrics:
  class: "CustomMetrics"
  config:
    enabled: true
    exportInterval: 60000

# plugins/custom-reporter/config.yml
name: "custom-reporter"
version: "1.0.0"
description: "Custom report generation"
author: "Your Name"
license: "MIT"

reporter:
  class: "CustomReporter"
  config:
    format: "html"
    template: "custom"
```

## 🚨 Error Codes & Troubleshooting

### Error Code Reference

#### AI Model Errors (1000-1999)

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| 1001 | `MODEL_CONNECTION_FAILED` | Failed to connect to AI model | Check model service status and network connectivity |
| 1002 | `MODEL_TIMEOUT` | AI model request timed out | Increase timeout or check model performance |
| 1003 | `MODEL_RATE_LIMIT` | Rate limit exceeded | Implement backoff or reduce request frequency |
| 1004 | `MODEL_AUTHENTICATION_FAILED` | Authentication failed | Check API keys and credentials |
| 1005 | `MODEL_QUOTA_EXCEEDED` | API quota exceeded | Check usage limits and billing |
| 1006 | `MODEL_INVALID_REQUEST` | Invalid request to model | Check request format and parameters |
| 1007 | `MODEL_SERVICE_UNAVAILABLE` | Model service unavailable | Check service status and try again later |

#### Validation Errors (2000-2999)

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| 2001 | `VALIDATION_FAILED` | Test validation failed | Check test expectations and response |
| 2002 | `SIMILARITY_THRESHOLD_NOT_MET` | Similarity threshold not met | Adjust threshold or improve prompt |
| 2003 | `BLOCKED_PATTERN_DETECTED` | Blocked pattern detected in response | Review content and adjust blocking rules |
| 2004 | `REQUIRED_CONTENT_MISSING` | Required content not found | Check prompt and expected keywords |
| 2005 | `FORBIDDEN_CONTENT_DETECTED` | Forbidden content found | Review response and adjust expectations |
| 2006 | `TOKEN_LIMIT_EXCEEDED` | Token limit exceeded | Reduce prompt length or increase limit |
| 2007 | `COST_LIMIT_EXCEEDED` | Cost limit exceeded | Optimize prompt or increase budget |

#### Reliability Errors (3000-3999)

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| 3001 | `CIRCUIT_BREAKER_OPEN` | Circuit breaker is open | Wait for circuit to close or check service health |
| 3002 | `FALLBACK_FAILED` | All fallback services failed | Check all service endpoints |
| 3003 | `HEALTH_CHECK_FAILED` | Health check failed | Check service status and configuration |
| 3004 | `QUEUE_FULL` | Request queue is full | Reduce concurrency or increase queue size |
| 3005 | `THROTTLE_LIMIT_EXCEEDED` | Throttle limit exceeded | Reduce request rate or increase throttle limit |
| 3006 | `RETRY_LIMIT_EXCEEDED` | Retry limit exceeded | Check underlying issue or increase retry limit |
| 3007 | `GRACEFUL_SHUTDOWN_FAILED` | Graceful shutdown failed | Check cleanup procedures |

#### Configuration Errors (4000-4999)

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| 4001 | `INVALID_CONFIG` | Invalid configuration | Check configuration file format |
| 4002 | `MISSING_REQUIRED_CONFIG` | Missing required configuration | Add required configuration options |
| 4003 | `INVALID_YAML_FORMAT` | Invalid YAML format | Check YAML syntax and structure |
| 4004 | `PLUGIN_LOAD_FAILED` | Plugin failed to load | Check plugin installation and dependencies |
| 4005 | `VALIDATOR_NOT_FOUND` | Validator not found | Check validator registration and path |
| 4006 | `METRICS_EXPORT_FAILED` | Metrics export failed | Check export configuration and permissions |
| 4007 | `CACHE_OPERATION_FAILED` | Cache operation failed | Check cache configuration and permissions |

#### System Errors (5000-5999)

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| 5001 | `FILE_NOT_FOUND` | File not found | Check file path and permissions |
| 5002 | `PERMISSION_DENIED` | Permission denied | Check file and directory permissions |
| 5003 | `DISK_SPACE_FULL` | Disk space full | Free up disk space |
| 5004 | `MEMORY_LIMIT_EXCEEDED` | Memory limit exceeded | Reduce concurrency or increase memory |
| 5005 | `NETWORK_ERROR` | Network error | Check network connectivity |
| 5006 | `TIMEOUT_ERROR` | Operation timed out | Increase timeout or check performance |
| 5007 | `UNKNOWN_ERROR` | Unknown error occurred | Check logs for details |

### Troubleshooting Guide

#### Common Issues

**1. AI Model Connection Issues**

```bash
# Check model connectivity
glassbox health --ai-models

# Test specific model
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "llama2", "prompt": "test"}'
```

**2. Configuration Issues**

```bash
# Validate configuration
glassbox validate --config

# Check configuration syntax
yamllint .glassbox/config.yml
```

**3. Performance Issues**

```bash
# Check system resources
glassbox health --detailed

# Monitor metrics
glassbox report --metrics --format json
```

**4. Plugin Issues**

```bash
# List installed plugins
glassbox plugins --list

# Validate plugin
glassbox plugins --validate custom-validator

# Check plugin logs
tail -f .glassbox/logs/plugins.log
```

#### Debug Mode

```bash
# Enable debug logging
DEBUG=glassbox:* glassbox test

# Enable reliability debugging
DEBUG=reliability:* glassbox test

# Enable verbose output
glassbox test --verbose --debug
```

#### Log Analysis

```bash
# View recent logs
tail -f .glassbox/logs/glassbox.log

# Search for errors
grep "ERROR" .glassbox/logs/glassbox.log

# Analyze performance
grep "duration" .glassbox/logs/glassbox.log | awk '{print $NF}' | sort -n
```

#### Performance Optimization

```bash
# Check test performance
glassbox test --metrics --output performance.json

# Analyze cost usage
glassbox report --cost-analysis --output cost-report.csv

# Optimize configuration
glassbox optimize --config .glassbox/config.yml
```

---

**For additional support, visit our [documentation](https://docs.glassbox.ai) or join our [Discord community](https://discord.gg/glassbox-ai).** 