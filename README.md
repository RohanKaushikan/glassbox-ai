# Glassbox AI - Enterprise-Grade AI Testing Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-blue.svg)](https://github.com/your-username/glassbox-ai)

> **Enterprise-grade AI testing with reliability, observability, and comprehensive validation**

Glassbox AI is a powerful CLI tool for testing AI systems through structured evaluations. Built with enterprise-grade reliability features, it provides robust fault tolerance, comprehensive monitoring, and intelligent fallback mechanisms for production-ready AI testing.

## 🎯 Problem Statement & Value Proposition

### The Challenge
AI systems are increasingly complex and critical to business operations, but traditional testing approaches fall short:

- **Fragile Testing**: Simple pass/fail tests don't capture AI system nuances
- **Poor Reliability**: Network failures, rate limits, and service outages break test suites
- **Limited Observability**: Lack of insights into AI model performance and behavior
- **Manual Validation**: Time-consuming manual review of AI responses
- **No Fallbacks**: Single points of failure when AI services are unavailable

### The Solution
Glassbox AI provides enterprise-grade AI testing with:

- **🛡️ Reliability**: Circuit breakers, exponential backoff, and fallback mechanisms
- **📊 Observability**: Comprehensive metrics, health checks, and performance monitoring
- **🔍 Smart Validation**: Fuzzy matching, PII detection, and content validation
- **⚡ Performance**: Parallel execution with intelligent queuing and throttling
- **🎯 Accuracy**: Multi-model testing with automatic failover

## 🚀 Quick Start

Get started in under 2 minutes:

```bash
# Install Glassbox AI
npm install -g glassbox-ai

# Initialize sample tests
glassbox init

# Run tests with enterprise reliability features
glassbox test
```

**Expected Output:**
```
🔍 Enterprise-Grade AI Testing with Reliability Features
============================================================
📁 Found 3 test file(s)
✅ Loaded 5 tests from Customer Support Tests
✅ Loaded 3 tests from Code Generation Tests
✅ Loaded 2 tests from Document Summarization Tests

🚀 Starting 10 tests with enterprise reliability features...
📊 Features enabled:
   • Exponential backoff with jitter
   • Circuit breaker pattern
   • Fallback mechanisms
   • Health checks and monitoring
   • Request queuing and throttling
   • Detailed metrics and observability
   • Graceful shutdown procedures

[100.0%] PASS Customer Support - Greeting Response (1250ms)
[100.0%] PASS Customer Support - Technical Support (1890ms)
[100.0%] PASS Code Generation - Python Function (2340ms)
...

🎯 ENTERPRISE RELIABILITY TEST COMPLETION
============================================================
⏱️  Total Duration: 15.2s
📈 Success Rate: 100.0%
🔧 Reliability Status: HEALTHY
🔄 Circuit Breaker Trips: 0
🛡️  Fallback Usage: 0
🔄 Total Retry Attempts: 0

✅ All tests passed successfully!
```

## 📦 Installation

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Ollama** (optional, for local AI models) - [Install Guide](https://ollama.ai/)

### Global Installation (Recommended)

```bash
# Using npm
npm install -g glassbox-ai

# Using yarn
yarn global add glassbox-ai

# Using pnpm
pnpm add -g glassbox-ai
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/your-username/glassbox-ai.git
cd glassbox-ai

# Install dependencies
npm install

# Link for development
npm link
```

### Platform-Specific Instructions

#### macOS
```bash
# Using Homebrew (recommended)
brew install node
npm install -g glassbox-ai

# Using MacPorts
sudo port install nodejs18
npm install -g glassbox-ai
```

#### Linux (Ubuntu/Debian)
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Glassbox AI
npm install -g glassbox-ai
```

#### Linux (CentOS/RHEL/Fedora)
```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Glassbox AI
npm install -g glassbox-ai
```

#### Windows
```bash
# Using Chocolatey
choco install nodejs
npm install -g glassbox-ai

# Using Scoop
scoop install nodejs
npm install -g glassbox-ai

# Manual installation
# 1. Download Node.js from https://nodejs.org/
# 2. Run installer
# 3. Open PowerShell and run:
npm install -g glassbox-ai
```

### Docker Installation

```bash
# Pull the Docker image
docker pull glassbox-ai/cli:latest

# Run with volume mounting
docker run -v $(pwd):/workspace glassbox-ai/cli:latest test
```

## 🎯 Features Overview

### Core Testing Features

#### 1. **Smart Content Validation**
```yaml
# .glassbox/customer-support.yml
name: "Customer Support Tests"
tests:
  - name: "Greeting Response"
    prompt: "Hello, I need help with my order"
    expect:
      contains: ["greeting", "assist", "help"]
      not_contains: ["sorry", "unavailable"]
```

#### 2. **PII Detection & Security**
```yaml
tests:
  - name: "Secure Response"
    prompt: "My credit card is 1234-5678-9012-3456"
    expect:
      block_patterns: ["credit_card", "ssn", "email"]
```

#### 3. **Cost Tracking & Optimization**
```yaml
settings:
  max_cost_usd: 0.10
  max_tokens: 1000
tests:
  - name: "Cost-Effective Response"
    prompt: "Explain quantum computing"
    expect:
      max_tokens: 500
```

### Enterprise Reliability Features

#### 1. **Circuit Breaker Pattern**
```javascript
// Automatic circuit breaker protection
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000
});
```

#### 2. **Exponential Backoff with Jitter**
```javascript
// Intelligent retry mechanisms
const backoff = new ExponentialBackoff({
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.1
});
```

#### 3. **Fallback Mechanisms**
```javascript
// Multi-service redundancy
fallbackManager.registerService('ai_model', primaryFn, [
  openaiFallback,
  localModelFallback
]);
```

#### 4. **Health Checks & Monitoring**
```javascript
// Proactive service monitoring
healthChecker.registerCheck('ai_service', async () => {
  return await aiService.healthCheck();
}, { critical: true });
```

#### 5. **Request Queuing & Throttling**
```javascript
// Controlled request flow
const requestQueue = new RequestQueue({
  maxConcurrency: 10,
  throttleRate: 50, // requests per second
  maxQueueSize: 100
});
```

#### 6. **Detailed Metrics & Observability**
```javascript
// Comprehensive monitoring
metrics.increment('requests_total', 1, { service: 'ai_model' });
metrics.histogram('response_time', duration, { service: 'ai_model' });
metrics.gauge('queue_size', queueLength);
```

#### 7. **Graceful Shutdown**
```javascript
// Clean resource cleanup
gracefulShutdown.registerCleanupTask('stop_ai_service', async () => {
  await aiService.stop();
}, { priority: 1 });
```

## ⚙️ Configuration

### Environment Variables

```bash
# AI Model Configuration
OPENAI_API_KEY=your_openai_api_key
OLLAMA_HOST=http://localhost:11434

# Reliability Configuration
RELIABILITY_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
HEALTH_CHECK_INTERVAL=30000
QUEUE_MAX_CONCURRENCY=10

# Metrics Configuration
METRICS_EXPORT_INTERVAL=60000
```

### Configuration File

Create `.glassbox/config.yml`:

```yaml
# Global Settings
settings:
  max_concurrency: 5
  test_timeout_ms: 30000
  max_retries: 2
  
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
```

### Test File Structure

```yaml
# .glassbox/example-test.yml
name: "Example Test Suite"
description: "Comprehensive AI testing with reliability features"

settings:
  max_cost_usd: 0.10
  max_tokens: 1000
  timeout_ms: 30000

tests:
  - name: "Basic Response Test"
    description: "Test basic AI response capabilities"
    prompt: "What is artificial intelligence?"
    expect:
      contains: ["AI", "artificial", "intelligence"]
      not_contains: ["I don't know", "cannot answer"]
      max_tokens: 200
      block_patterns: ["credit_card", "ssn"]
    
  - name: "Code Generation Test"
    description: "Test code generation capabilities"
    prompt: "Write a Python function to calculate fibonacci numbers"
    expect:
      contains: ["def", "fibonacci", "return"]
      not_contains: ["error", "cannot"]
      max_tokens: 500
```

## 🔧 CLI Commands

### Basic Commands

```bash
# Initialize sample tests
glassbox init

# Run all tests
glassbox test

# Run specific test file
glassbox test --file customer-support.yml

# Run with verbose output
glassbox test --verbose

# Run with custom configuration
glassbox test --config custom-config.yml
```

### Advanced Commands

```bash
# Test reliability features
npm run test-reliability

# Run performance tests
npm run test-performance

# Test caching system
npm run test-cache

# Show version
glassbox version

# Get help
glassbox --help
```

### Output Formats

```bash
# Human-readable output (default)
glassbox test

# JSON output for automation
glassbox test --format json

# Machine-readable output
glassbox test --format machine

# Export results to file
glassbox test --output results.json
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Installation Problems**

**Issue**: `npm install -g glassbox-ai` fails
```bash
# Solution: Check Node.js version
node --version  # Should be 18+

# Solution: Clear npm cache
npm cache clean --force

# Solution: Use sudo (Linux/macOS)
sudo npm install -g glassbox-ai
```

**Issue**: Permission denied on Windows
```bash
# Solution: Run PowerShell as Administrator
# Solution: Use Chocolatey or Scoop for installation
```

#### 2. **AI Model Connection Issues**

**Issue**: Cannot connect to Ollama
```bash
# Check if Ollama is running
ollama list

# Start Ollama if not running
ollama serve

# Pull required model
ollama pull llama2
```

**Issue**: OpenAI API key not working
```bash
# Set environment variable
export OPENAI_API_KEY="your-api-key"

# Or create .env file
echo "OPENAI_API_KEY=your-api-key" > .env
```

#### 3. **Test Execution Problems**

**Issue**: Tests timeout
```yaml
# Increase timeout in test file
settings:
  timeout_ms: 60000  # 60 seconds
```

**Issue**: Circuit breaker trips frequently
```yaml
# Adjust circuit breaker settings
reliability:
  circuit_breaker:
    failure_threshold: 10  # Increase threshold
    timeout: 120000        # Increase timeout
```

**Issue**: Queue backlog
```yaml
# Increase concurrency limits
reliability:
  queue:
    max_concurrency: 20    # Increase concurrency
    throttle_rate: 100     # Increase rate limit
```

#### 4. **Performance Issues**

**Issue**: Slow test execution
```bash
# Enable parallel execution
glassbox test --parallel

# Reduce test complexity
# Use simpler prompts and expectations
```

**Issue**: High memory usage
```bash
# Reduce concurrency
glassbox test --concurrency 2

# Clear cache
npm run test-cache --clear
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=glassbox:* glassbox test

# Enable reliability debugging
DEBUG=reliability:* glassbox test

# Enable verbose output
glassbox test --verbose --debug
```

### Health Checks

```bash
# Check system health
glassbox health

# Test AI model connectivity
glassbox test --health-check

# Validate configuration
glassbox validate-config
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/glassbox-ai.git
cd glassbox-ai

# Install dependencies
npm install

# Link for development
npm link

# Run tests
npm test

# Run reliability tests
npm run test-reliability
```

### Project Structure

```
glassbox-ai/
├── src/
│   ├── commands/          # CLI commands
│   ├── models/           # AI model integrations
│   ├── reliability/      # Enterprise reliability features
│   ├── validators/       # Content validation
│   └── index.js          # Main entry point
├── examples/             # Sample test files
├── docs/                # Documentation
└── tests/               # Test files
```

### Development Guidelines

1. **Code Style**: Follow existing patterns and use ESLint
2. **Testing**: Add tests for new features
3. **Documentation**: Update docs for new features
4. **Reliability**: Ensure new features work with reliability system

### Making Changes

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# Add tests
npm test

# Commit changes
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### Testing Your Changes

```bash
# Run all tests
npm test

# Test reliability features
npm run test-reliability

# Test performance
npm run test-performance

# Lint code
npm run lint

# Build project
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🗺️ Roadmap

### v1.1.0 (Q1 2024)
- [ ] Web-based dashboard for monitoring
- [ ] Distributed tracing support
- [ ] Advanced alerting system
- [ ] Machine learning for failure prediction

### v1.2.0 (Q2 2024)
- [ ] Multi-language support (Python, Go, Rust)
- [ ] Kubernetes integration
- [ ] Advanced metrics aggregation
- [ ] Custom validation plugins

### v1.3.0 (Q3 2024)
- [ ] Real-time collaboration features
- [ ] Advanced test scheduling
- [ ] Integration with CI/CD platforms
- [ ] Mobile app for monitoring

### v2.0.0 (Q4 2024)
- [ ] AI-powered test generation
- [ ] Advanced performance optimization
- [ ] Enterprise SSO integration
- [ ] Advanced analytics and reporting

## 🌟 Community

### Get Help

- **Documentation**: [docs.glassbox.ai](https://docs.glassbox.ai)
- **Issues**: [GitHub Issues](https://github.com/your-username/glassbox-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/glassbox-ai/discussions)
- **Discord**: [Join our Discord](https://discord.gg/glassbox-ai)

### Stay Updated

- **Blog**: [blog.glassbox.ai](https://blog.glassbox.ai)
- **Twitter**: [@glassbox_ai](https://twitter.com/glassbox_ai)
- **Newsletter**: [Subscribe](https://glassbox.ai/newsletter)

### Show Your Support

- ⭐ **Star the repository**
- 🐛 **Report bugs**
- 💡 **Request features**
- 📝 **Contribute documentation**
- 🔧 **Submit pull requests**

## 🙏 Acknowledgments

- **Ollama** for local AI model support
- **OpenAI** for cloud AI model integration
- **Fastest Levenshtein** for fuzzy string matching
- **Commander.js** for CLI framework
- **YAML** for configuration parsing

---

**Made with ❤️ by the Glassbox AI team**

For questions, support, or contributions, please reach out to us at [hello@glassbox.ai](mailto:hello@glassbox.ai). 