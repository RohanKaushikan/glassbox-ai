# Enhanced Error Handling System

The Glassbox CLI includes a comprehensive error handling system that provides robust handling for network issues, API problems, service outages, and graceful degradation.

## 🎯 Features

### 1. Network Timeouts and Connection Failures
- **Automatic retry with exponential backoff**
- **Connection timeout detection** (ECONNABORTED, ECONNREFUSED)
- **Network connectivity validation**
- **Graceful handling of intermittent network issues**

### 2. API Rate Limiting with Exponential Backoff
- **Rate limit detection** (HTTP 429)
- **Exponential backoff with jitter** to prevent thundering herd
- **Configurable retry delays** for different error types
- **Smart retry logic** based on error classification

### 3. Invalid API Keys and Authentication Errors
- **Authentication failure detection** (HTTP 401, 403)
- **API key validation** before requests
- **Clear error messages** with setup instructions
- **Credential validation** for all providers

### 4. Model Unavailability and Service Outages
- **Service health monitoring**
- **Model availability checking**
- **Service outage detection** (HTTP 5xx)
- **Fallback mechanisms** when services are down

### 5. Malformed Responses from AI Services
- **Response structure validation**
- **JSON parsing error handling**
- **Unexpected response format detection**
- **Detailed error logging** for debugging

### 6. Quota Exceeded and Billing Issues
- **Quota limit detection** (HTTP 402)
- **Billing error handling**
- **Usage tracking and monitoring**
- **Clear billing status messages**

### 7. Graceful Degradation
- **Partial service availability handling**
- **Fallback to alternative providers**
- **Degraded functionality modes**
- **User-friendly degradation messages**

### 8. Detailed Logging for Debugging
- **Structured error logging** to `.glassbox/error.log`
- **Error categorization** by type and severity
- **Context preservation** for debugging
- **Error statistics** and monitoring

## 🛠️ Usage

### Health Check Command
```bash
# Check all AI services
glassbox health

# Check specific provider
glassbox health --provider openai

# Detailed health information
glassbox health --verbose
```

### Diagnostics Command
```bash
# Run all diagnostics
glassbox diagnose

# Check specific aspects
glassbox diagnose --check-api
glassbox diagnose --check-network
glassbox diagnose --check-models
```

### Error Logging
```bash
# View error statistics
glassbox health --verbose

# Check error log file
cat .glassbox/error.log
```

## 🔧 Error Types and Handling

### Network Errors
```javascript
// Network timeout
if (code === 'ECONNABORTED' || message.includes('timeout')) {
  // Retry with exponential backoff
  // Log as NETWORK_TIMEOUT
}

// Connection failure
if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
  // Retry with backoff
  // Log as CONNECTION_FAILURE
}
```

### API Errors
```javascript
// Rate limiting
if (status === 429) {
  // Wait longer before retry
  // Log as API_RATE_LIMIT
}

// Authentication
if (status === 401 || status === 403) {
  // Don't retry, show setup help
  // Log as AUTHENTICATION_ERROR
}

// Quota exceeded
if (status === 402) {
  // Don't retry, show billing help
  // Log as QUOTA_EXCEEDED
}
```

### Service Errors
```javascript
// Service outage
if (status >= 500) {
  // Retry with backoff
  // Log as SERVICE_OUTAGE
}

// Model unavailable
if (status === 404 && message.includes('model')) {
  // Don't retry, suggest alternatives
  // Log as MODEL_UNAVAILABLE
}
```

## 📊 Error Statistics

The system tracks error statistics for monitoring:

```javascript
{
  totalErrors: 15,
  errorTypes: {
    NETWORK_TIMEOUT: 5,
    API_RATE_LIMIT: 3,
    AUTHENTICATION_ERROR: 2,
    SERVICE_OUTAGE: 2,
    QUOTA_EXCEEDED: 1,
    MALFORMED_RESPONSE: 2
  },
  recentErrors: [
    {
      timestamp: "2024-01-15T10:30:00.000Z",
      message: "Request timed out",
      type: "NETWORK_TIMEOUT"
    }
  ]
}
```

## 🔄 Retry Configuration

### Exponential Backoff
```javascript
const RETRY_CONFIG = {
  DEFAULT_MAX_RETRIES: 3,
  EXPONENTIAL_BACKOFF_BASE: 2,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  RATE_LIMIT_DELAY_MS: 60000,
  TIMEOUT_MS: 30000
};
```

### Retry Logic
1. **Initial attempt** with full timeout
2. **Exponential backoff** with jitter
3. **Rate limit handling** with longer delays
4. **Maximum retry limit** to prevent infinite loops

## 📝 Logging System

### Log Levels
- **DEBUG**: Detailed debugging information
- **INFO**: General operational information
- **WARN**: Warning conditions
- **ERROR**: Error conditions
- **CRITICAL**: Critical errors requiring immediate attention

### Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "ERROR",
  "message": "OpenAI API request failed",
  "context": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "operation": "generate_response"
  },
  "stack": "Error stack trace..."
}
```

## 🏥 Health Monitoring

### Service Health Checks
```bash
# OpenAI health check
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

# Ollama health check
curl http://localhost:11434/api/tags
```

### Health Status
```javascript
{
  healthy: true,
  status: 200,
  available: true,
  models: ["gpt-3.5-turbo", "gpt-4"]
}
```

## 🔍 Diagnostics

### API Configuration Check
- ✅ API keys present
- ✅ API keys valid
- ✅ Permissions correct

### Network Connectivity Check
- ✅ OpenAI API reachable
- ✅ Anthropic API reachable
- ✅ Ollama service reachable

### Model Availability Check
- ✅ Models available
- ✅ Model permissions
- ✅ Model compatibility

## 🚨 Error Severity Levels

### LOW
- **Impact**: Minimal functionality impact
- **Action**: Log and continue
- **Examples**: Debug messages, info logs

### MEDIUM
- **Impact**: Some functionality degraded
- **Action**: Retry with backoff
- **Examples**: Network timeouts, rate limits

### HIGH
- **Impact**: Significant functionality impact
- **Action**: Retry with longer backoff
- **Examples**: Service outages, connection failures

### CRITICAL
- **Impact**: System unusable
- **Action**: Immediate attention required
- **Examples**: Quota exceeded, authentication failures

## 🔧 Configuration

### Environment Variables
```bash
# API Keys
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# Ollama Configuration
export OLLAMA_URL="http://localhost:11434"
export OLLAMA_MODEL="mistral:7b"

# Error Handling
export GLASSBOX_LOG_LEVEL="INFO"
export GLASSBOX_MAX_RETRIES="3"
```

### CLI Options
```bash
# Verbose error output
glassbox test --verbose

# Custom timeout
glassbox test --timeout 60000

# Custom retry count
glassbox test --retry 5
```

## 📈 Monitoring and Alerts

### Error Rate Monitoring
- Track error rates by type
- Monitor service health
- Alert on critical errors

### Performance Metrics
- Response time tracking
- Success rate monitoring
- Retry frequency analysis

### Usage Tracking
- API call counts
- Token usage monitoring
- Cost tracking

## 🛡️ Security Features

### Error Information Sanitization
- Remove sensitive data from logs
- Sanitize API keys in error messages
- Protect user privacy

### Secure Logging
- Log file permissions
- Encrypted log storage
- Audit trail maintenance

## 🔄 Graceful Degradation Examples

### Partial Service Availability
```javascript
// If OpenAI is down, try Ollama
if (openaiHealth.healthy === false && ollamaHealth.healthy === true) {
  logger.warn('OpenAI unavailable, falling back to Ollama');
  return await ollamaClient.generateResponse(prompt);
}
```

### Model Fallback
```javascript
// If preferred model unavailable, try alternatives
if (!modelAvailable) {
  const alternatives = ['gpt-3.5-turbo', 'gpt-4', 'mistral:7b'];
  for (const model of alternatives) {
    if (await isModelAvailable(model)) {
      return await generateResponse(prompt, { model });
    }
  }
}
```

## 📚 Troubleshooting Guide

### Common Issues

1. **Network Timeouts**
   - Check internet connection
   - Verify firewall settings
   - Try different network

2. **Rate Limiting**
   - Reduce request frequency
   - Upgrade API plan
   - Implement backoff

3. **Authentication Errors**
   - Verify API keys
   - Check key permissions
   - Regenerate keys if needed

4. **Service Outages**
   - Check service status
   - Use alternative providers
   - Wait for service restoration

### Debug Commands
```bash
# Check service health
glassbox health --verbose

# Run diagnostics
glassbox diagnose

# View error logs
tail -f .glassbox/error.log

# Test connectivity
curl -I https://api.openai.com/v1/models
```

The enhanced error handling system provides robust, production-ready error management with comprehensive logging, monitoring, and graceful degradation capabilities. 