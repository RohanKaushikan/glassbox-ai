import { generateResponse } from './models/ollama-client.js';
import { generateResponse as generateResponseOpenAI } from './models/openai-client.js';
import { validateContent } from './validators/content-validator.js';
import { detectPII } from './validators/pii-detector.js';
import { calculateRequestCost } from './validators/cost-calculator.js';
import { ReliabilityManager } from './reliability/reliability-manager.js';

// Enhanced configuration with reliability features
const CONFIG = {
  maxConcurrency: 5,
  testTimeoutMs: 30000, // 30 seconds per test
  maxRetries: 2,
  retryDelayMs: 1000,
  networkRetryDelayMs: 2000,
  maxNetworkRetries: 3,
  
  // Reliability configuration
  reliability: {
    enabled: true,
    autoStart: true,
    backoff: {
      baseDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 5,
      jitterFactor: 0.1
    },
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      monitoringPeriod: 60000
    },
    health: {
      checkInterval: 30000,
      timeout: 10000,
      retries: 2
    },
    queue: {
      maxConcurrency: 10,
      maxQueueSize: 100,
      throttleRate: 50, // requests per second
      timeout: 30000,
      retryAttempts: 3
    },
    metrics: {
      enabled: true,
      exportInterval: 60000
    },
    shutdown: {
      shutdownTimeout: 30000,
      forceKillTimeout: 5000
    }
  }
};

// Error types for better categorization
const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  MODEL: 'MODEL_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  CIRCUIT_BREAKER: 'CIRCUIT_BREAKER_ERROR',
  FALLBACK: 'FALLBACK_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

// Failure categories for grouping
const FAILURE_CATEGORIES = {
  CONTENT: 'CONTENT_FAILURE',
  PII: 'PII_FAILURE', 
  COST: 'COST_FAILURE',
  NETWORK: 'NETWORK_FAILURE',
  MODEL: 'MODEL_FAILURE',
  TIMEOUT: 'TIMEOUT_FAILURE',
  VALIDATION: 'VALIDATION_FAILURE',
  CIRCUIT_BREAKER: 'CIRCUIT_BREAKER_FAILURE',
  FALLBACK: 'FALLBACK_FAILURE',
  UNKNOWN: 'UNKNOWN_FAILURE'
};

/**
 * Enhanced error logging with reliability context
 * @param {string} errorType
 * @param {string} message
 * @param {object} context
 * @param {Error} originalError
 */
function logError(errorType, message, context = {}, originalError = null) {
  const timestamp = new Date().toISOString();
  const errorLog = {
    timestamp,
    type: errorType,
    message,
    context,
    originalError: originalError ? {
      name: originalError.name,
      message: originalError.message,
      stack: originalError.stack
    } : null
  };
  
  console.error(`[${timestamp}] ${errorType}: ${message}`, errorLog);
}

/**
 * Determine if error is network-related
 * @param {Error} error
 * @returns {boolean}
 */
function isNetworkError(error) {
  const networkErrorKeywords = [
    'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
    'network', 'connection', 'timeout', 'unreachable'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return networkErrorKeywords.some(keyword => errorMessage.includes(keyword.toLowerCase()));
}

/**
 * Determine if error is model-related
 * @param {Error} error
 * @returns {boolean}
 */
function isModelError(error) {
  const modelErrorKeywords = [
    'model', 'inference', 'generation', 'api', 'rate limit', 'quota'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return modelErrorKeywords.some(keyword => errorMessage.includes(keyword.toLowerCase()));
}

/**
 * Initialize reliability manager with AI model services
 * @returns {ReliabilityManager} Configured reliability manager
 */
function initializeReliabilityManager() {
  const reliabilityManager = new ReliabilityManager(CONFIG.reliability);
  
  // Register Ollama as primary service
  reliabilityManager.registerService('ollama', generateResponse, [], {
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000
    },
    health: {
      critical: true,
      timeout: 10000
    },
    queue: {
      priority: 1,
      timeout: 30000
    }
  });
  
  // Register OpenAI as fallback service
  reliabilityManager.registerService('openai', generateResponseOpenAI, [], {
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000
    },
    health: {
      critical: false,
      timeout: 10000
    },
    queue: {
      priority: 0,
      timeout: 30000
    }
  });
  
  // Register model selection service with fallbacks
  reliabilityManager.registerService('ai_model', 
    // Primary: Try Ollama first
    async (prompt) => {
      return await reliabilityManager.executeWithReliability('ollama', [prompt]);
    },
    // Fallbacks: Try OpenAI if Ollama fails
    [
      async (prompt) => {
        return await reliabilityManager.executeWithReliability('openai', [prompt]);
      }
    ],
    {
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000
      },
      health: {
        critical: true,
        timeout: 15000
      },
      queue: {
        priority: 1,
        timeout: 60000
      }
    }
  );
  
  return reliabilityManager;
}

/**
 * Validates the AI response against the test's expect criteria.
 * @param {string} response
 * @param {object} expect
 * @returns {object} { pass: boolean, details: string[] }
 */
function validateResponse(response, expect, settings = {}) {
    const details = [];
    let pass = true;

    try {
        // Use smart content validation instead of exact matching
        if (expect.contains) {
        const contentResult = validateContent(response, expect.contains, {
            threshold: 0.7, // 70% similarity required
            fuzzyMatching: true
        });
        
        if (contentResult.score < 0.7) {
            pass = false;
            details.push(`Content similarity too low: ${(contentResult.score * 100).toFixed(1)}% (need 70%)`);
            // Add details about which phrases weren't found
            contentResult.missingPhrases?.forEach(phrase => {
            details.push(`Low similarity for: "${phrase}"`);
            });
        }
        }
        
        if (expect.not_contains) {
        for (const phrase of expect.not_contains) {
            if (response.toLowerCase().includes(phrase.toLowerCase())) {
            pass = false;
            details.push(`Should not contain: "${phrase}"`);
            }
        }
        }
        
        // Use PII detector if block_patterns specified
        if (expect.block_patterns && expect.block_patterns.length > 0) {
        const piiResult = detectPII(response);
        if (piiResult.found.length > 0) {
            pass = false;
            details.push(`PII detected: ${piiResult.found.join(', ')}`);
        }
        }
        
    } catch (error) {
        logError(ERROR_TYPES.VALIDATION, 'Error during response validation', {
        responseLength: response?.length || 0,
        expectKeys: Object.keys(expect || {})
        }, error);
        pass = false;
        details.push('Validation error occurred');
    }

    return { pass, details };
}

/**
 * Categorize test failure with reliability context
 * @param {object} result - Test result
 * @returns {string} Failure category
 */
function categorizeFailure(result) {
  if (result.errorType === ERROR_TYPES.NETWORK) return FAILURE_CATEGORIES.NETWORK;
  if (result.errorType === ERROR_TYPES.MODEL) return FAILURE_CATEGORIES.MODEL;
  if (result.errorType === ERROR_TYPES.TIMEOUT) return FAILURE_CATEGORIES.TIMEOUT;
  if (result.errorType === ERROR_TYPES.VALIDATION) return FAILURE_CATEGORIES.VALIDATION;
  if (result.errorType === ERROR_TYPES.CIRCUIT_BREAKER) return FAILURE_CATEGORIES.CIRCUIT_BREAKER;
  if (result.errorType === ERROR_TYPES.FALLBACK) return FAILURE_CATEGORIES.FALLBACK;
  
  // Content-based failures
  if (result.details && result.details.length > 0) {
    const details = result.details.join(' ').toLowerCase();
    if (details.includes('missing') || details.includes('should not contain')) {
      return FAILURE_CATEGORIES.CONTENT;
    }
  }
  
  return FAILURE_CATEGORIES.UNKNOWN;
}

/**
 * Aggregate test results with reliability metrics
 * @param {Array<object>} results - Array of test results
 * @param {ReliabilityManager} reliabilityManager - Reliability manager instance
 * @returns {object} Aggregated results
 */
function aggregateResults(results, reliabilityManager) {
  const aggregation = {
    summary: {
      total: results.length,
      passed: 0,
      failed: 0,
      successRate: 0,
      totalDuration: 0,
      totalCost: 0,
      totalTokens: 0
    },
    failures: {
      byCategory: {},
      bySuite: {},
      byErrorType: {}
    },
    performance: {
      averageDuration: 0,
      slowestTest: null,
      fastestTest: null,
      durationDistribution: {
        fast: 0,    // < 5s
        medium: 0,  // 5-15s
        slow: 0     // > 15s
      }
    },
    models: {
      usage: {},
      fallbackRate: 0
    },
    costs: {
      byModel: {},
      averageCostPerTest: 0
    },
    suites: {},
    reliability: {
      circuitBreakerTrips: 0,
      fallbackUsage: 0,
      retryAttempts: 0,
      healthStatus: 'unknown'
    }
  };
  
  let totalFallbacks = 0;
  let totalCost = 0;
  let circuitBreakerTrips = 0;
  let fallbackUsage = 0;
  let retryAttempts = 0;
  
  for (const result of results) {
    // Basic counts
    if (result.pass) {
      aggregation.summary.passed++;
    } else {
      aggregation.summary.failed++;
      
      // Categorize failure
      const failureCategory = categorizeFailure(result);
      aggregation.failures.byCategory[failureCategory] = 
        (aggregation.failures.byCategory[failureCategory] || 0) + 1;
      
      // Group by suite
      aggregation.failures.bySuite[result.suite] = 
        (aggregation.failures.bySuite[result.suite] || 0) + 1;
      
      // Group by error type
      if (result.errorType) {
        aggregation.failures.byErrorType[result.errorType] = 
          (aggregation.failures.byErrorType[result.errorType] || 0) + 1;
      }
    }
    
    // Duration tracking
    aggregation.summary.totalDuration += result.durationMs || 0;
    if (!aggregation.performance.slowestTest || result.durationMs > aggregation.performance.slowestTest.durationMs) {
      aggregation.performance.slowestTest = result;
    }
    if (!aggregation.performance.fastestTest || result.durationMs < aggregation.performance.fastestTest.durationMs) {
      aggregation.performance.fastestTest = result;
    }
    
    // Duration distribution
    if (result.durationMs < 5000) aggregation.performance.durationDistribution.fast++;
    else if (result.durationMs < 15000) aggregation.performance.durationDistribution.medium++;
    else aggregation.performance.durationDistribution.slow++;
    
    // Model usage tracking
    const modelUsed = result.modelUsed || 'unknown';
    aggregation.models.usage[modelUsed] = (aggregation.models.usage[modelUsed] || 0) + 1;
    if (result.fallbackUsed) {
      totalFallbacks++;
      fallbackUsage++;
    }
    
    // Cost tracking
    if (result.cost) {
      totalCost += parseFloat(result.cost);
      const model = result.modelUsed || 'unknown';
      aggregation.costs.byModel[model] = (aggregation.costs.byModel[model] || 0) + parseFloat(result.cost);
    }
    
    // Token tracking
    aggregation.summary.totalTokens += result.tokenCount || 0;
    
    // Suite tracking
    if (!aggregation.suites[result.suite]) {
      aggregation.suites[result.suite] = { passed: 0, failed: 0, total: 0 };
    }
    aggregation.suites[result.suite].total++;
    if (result.pass) {
      aggregation.suites[result.suite].passed++;
    } else {
      aggregation.suites[result.suite].failed++;
    }
    
    // Reliability tracking
    if (result.circuitBreakerTripped) circuitBreakerTrips++;
    if (result.retryAttempts) retryAttempts += result.retryAttempts;
  }
  
  // Calculate derived statistics
  aggregation.summary.successRate = (aggregation.summary.passed / aggregation.summary.total) * 100;
  aggregation.performance.averageDuration = aggregation.summary.totalDuration / aggregation.summary.total;
  aggregation.models.fallbackRate = (totalFallbacks / aggregation.summary.total) * 100;
  aggregation.summary.totalCost = totalCost;
  aggregation.costs.averageCostPerTest = totalCost / aggregation.summary.total;
  
  // Reliability metrics
  aggregation.reliability.circuitBreakerTrips = circuitBreakerTrips;
  aggregation.reliability.fallbackUsage = fallbackUsage;
  aggregation.reliability.retryAttempts = retryAttempts;
  
  // Get system health if reliability manager is available
  if (reliabilityManager) {
    try {
      const systemHealth = reliabilityManager.getSystemHealth();
      aggregation.reliability.healthStatus = systemHealth.overall.overall;
    } catch (error) {
      aggregation.reliability.healthStatus = 'unknown';
    }
  }
  
  return aggregation;
}

/**
 * Format results for human consumption with reliability insights
 * @param {object} aggregation - Aggregated results
 * @param {ReliabilityManager} reliabilityManager - Reliability manager instance
 * @returns {string} Formatted summary
 */
function formatHumanResults(aggregation, reliabilityManager) {
  const { summary, failures, performance, models, costs, reliability } = aggregation;
  
  let output = '\n=== ENTERPRISE RELIABILITY TEST RESULTS ===\n';
  output += `Total Tests: ${summary.total}\n`;
  output += `Passed: ${summary.passed} (${summary.successRate.toFixed(1)}%)\n`;
  output += `Failed: ${summary.failed}\n`;
  output += `Total Duration: ${(summary.totalDuration / 1000).toFixed(1)}s\n`;
  output += `Average Duration: ${(performance.averageDuration / 1000).toFixed(1)}s\n`;
  output += `Total Cost: $${summary.totalCost.toFixed(6)}\n`;
  output += `Average Cost per Test: $${costs.averageCostPerTest.toFixed(6)}\n`;
  output += `Total Tokens: ${summary.totalTokens.toLocaleString()}\n`;
  output += `Model Fallback Rate: ${models.fallbackRate.toFixed(1)}%\n\n`;
  
  // Reliability insights
  output += '=== RELIABILITY INSIGHTS ===\n';
  output += `System Health: ${reliability.healthStatus.toUpperCase()}\n`;
  output += `Circuit Breaker Trips: ${reliability.circuitBreakerTrips}\n`;
  output += `Fallback Usage: ${reliability.fallbackUsage}\n`;
  output += `Total Retry Attempts: ${reliability.retryAttempts}\n\n`;
  
  // Failure breakdown
  if (summary.failed > 0) {
    output += '=== FAILURE BREAKDOWN ===\n';
    for (const [category, count] of Object.entries(failures.byCategory)) {
      const percentage = (count / summary.failed * 100).toFixed(1);
      output += `${category}: ${count} (${percentage}%)\n`;
    }
    output += '\n';
  }
  
  // Model usage
  output += '=== MODEL USAGE ===\n';
  for (const [model, count] of Object.entries(models.usage)) {
    const percentage = (count / summary.total * 100).toFixed(1);
    output += `${model}: ${count} tests (${percentage}%)\n`;
  }
  output += '\n';
  
  // Performance insights
  output += '=== PERFORMANCE INSIGHTS ===\n';
  output += `Fast tests (<5s): ${performance.durationDistribution.fast}\n`;
  output += `Medium tests (5-15s): ${performance.durationDistribution.medium}\n`;
  output += `Slow tests (>15s): ${performance.durationDistribution.slow}\n`;
  if (performance.slowestTest) {
    output += `Slowest test: ${performance.slowestTest.suite} - ${performance.slowestTest.test} (${performance.slowestTest.durationMs}ms)\n`;
  }
  if (performance.fastestTest) {
    output += `Fastest test: ${performance.fastestTest.suite} - ${performance.fastestTest.test} (${performance.fastestTest.durationMs}ms)\n`;
  }
  
  // System health details if available
  if (reliabilityManager) {
    try {
      const systemHealth = reliabilityManager.getSystemHealth();
      output += '\n=== SYSTEM HEALTH ===\n';
      output += `Overall Status: ${systemHealth.overall.overall.toUpperCase()}\n`;
      output += `Healthy Services: ${systemHealth.overall.healthy}\n`;
      output += `Unhealthy Services: ${systemHealth.overall.unhealthy}\n`;
      output += `Critical Failures: ${systemHealth.overall.criticalFailures}\n`;
    } catch (error) {
      output += '\n=== SYSTEM HEALTH ===\n';
      output += 'Health information unavailable\n';
    }
  }
  
  return output;
}

/**
 * Execute a single test with enterprise reliability features
 * @param {object} test - Test object
 * @param {object} settings - Test settings
 * @param {string} suiteName - Name of the test suite
 * @param {ReliabilityManager} reliabilityManager - Reliability manager instance
 * @returns {Promise<object>} Test result
 */
async function executeTest(test, settings, suiteName, reliabilityManager) {
  const { name, description, prompt, expect } = test;
  let lastError = null;
  let networkRetries = 0;
  let circuitBreakerTripped = false;
  let fallbackUsed = false;
  let retryAttempts = 0;
  let modelUsed = 'unknown';
  
  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), CONFIG.testTimeoutMs);
      });
      
      // Execute test with reliability features
      const testPromise = (async () => {
        const start = Date.now();
        
        let aiResult;
        
        if (reliabilityManager && reliabilityManager.enabled) {
          // Use reliability manager for AI model execution
          try {
            aiResult = await reliabilityManager.executeWithReliability('ai_model', [prompt]);
            modelUsed = 'ai_model';
          } catch (error) {
            // If reliability manager fails, fall back to direct execution
            console.warn('Reliability manager failed, falling back to direct execution');
            aiResult = await generateResponse(prompt);
            modelUsed = 'ollama_direct';
          }
        } else {
          // Direct execution without reliability features
          aiResult = await generateResponse(prompt);
          modelUsed = 'ollama_direct';
        }
        
        const response = aiResult.response || aiResult;
        const tokenCount = aiResult.tokenCount || 0;
        
        const validation = validateResponse(response, expect);
        const end = Date.now();
        const durationMs = end - start;
        
        const cost = settings && settings.max_cost_usd && tokenCount
          ? (settings.max_cost_usd * (tokenCount / settings.max_tokens)).toFixed(6)
          : null;
        
        return {
          suite: suiteName,
          test: name,
          description,
          prompt,
          response,
          pass: validation.pass,
          details: validation.details,
          tokenCount,
          cost,
          durationMs,
          error: null,
          attempt: attempt + 1,
          retried: attempt > 0,
          modelUsed,
          fallbackUsed,
          networkRetries,
          circuitBreakerTripped,
          retryAttempts: attempt
        };
      })();
      
      return await Promise.race([testPromise, timeoutPromise]);
      
    } catch (err) {
      lastError = err;
      retryAttempts = attempt;
      
      // Categorize error
      let errorType = ERROR_TYPES.UNKNOWN;
      if (err.message.includes('timeout')) {
        errorType = ERROR_TYPES.TIMEOUT;
      } else if (err.message.includes('Circuit breaker')) {
        errorType = ERROR_TYPES.CIRCUIT_BREAKER;
        circuitBreakerTripped = true;
      } else if (isNetworkError(err)) {
        errorType = ERROR_TYPES.NETWORK;
        networkRetries++;
      } else if (isModelError(err)) {
        errorType = ERROR_TYPES.MODEL;
      }
      
      // Log detailed error information
      logError(errorType, `Test execution failed: ${err.message}`, {
        test: name,
        suite: suiteName,
        attempt: attempt + 1,
        networkRetries,
        circuitBreakerTripped,
        promptLength: prompt?.length || 0
      }, err);
      
      // Handle network errors with longer delays
      if (errorType === ERROR_TYPES.NETWORK && networkRetries < CONFIG.maxNetworkRetries) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.networkRetryDelayMs));
        continue;
      }
      
      // Regular retry logic
      if (attempt < CONFIG.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelayMs));
        continue;
      }
      
      // Final attempt failed - return error result
      return {
        suite: suiteName,
        test: name,
        description,
        prompt,
        response: '',
        pass: false,
        details: [err.message],
        tokenCount: 0,
        cost: null,
        durationMs: 0,
        error: err.message,
        errorType,
        attempt: attempt + 1,
        retried: attempt > 0,
        networkRetries,
        modelUsed: 'none',
        fallbackUsed,
        circuitBreakerTripped,
        retryAttempts: attempt
      };
    }
  }
}

/**
 * Process tests in parallel with enterprise reliability features
 * @param {Array<object>} testObjects - Array of test suite objects
 * @returns {Promise<object>} Aggregated test results
 */
async function runTestsParallel(testObjects) {
  const allTests = [];
  const results = [];
  let completedTests = 0;
  let totalTests = 0;
  let failedTests = 0;
  let networkErrors = 0;
  let modelErrors = 0;
  let circuitBreakerErrors = 0;
  
  // Initialize reliability manager
  const reliabilityManager = initializeReliabilityManager();
  
  // Flatten all tests into a single array with metadata
  for (const testFile of testObjects) {
    const { name: suiteName, settings, tests } = testFile;
    for (const test of tests) {
      allTests.push({ test, settings, suiteName });
      totalTests++;
    }
  }
  
  console.log(`Starting ${totalTests} tests with enterprise reliability features...`);
  console.log('Features enabled: Circuit breakers, exponential backoff, health checks, metrics, fallbacks');
  
  // Process tests in batches
  for (let i = 0; i < allTests.length; i += CONFIG.maxConcurrency) {
    const batch = allTests.slice(i, i + CONFIG.maxConcurrency);
    const batchPromises = batch.map(async ({ test, settings, suiteName }) => {
      try {
        const result = await executeTest(test, settings, suiteName, reliabilityManager);
        completedTests++;
        
        // Track error statistics
        if (!result.pass) failedTests++;
        if (result.errorType === ERROR_TYPES.NETWORK) networkErrors++;
        if (result.errorType === ERROR_TYPES.MODEL) modelErrors++;
        if (result.errorType === ERROR_TYPES.CIRCUIT_BREAKER) circuitBreakerErrors++;
        
        // Real-time progress update with reliability context
        const progress = ((completedTests / totalTests) * 100).toFixed(1);
        const status = result.pass ? 'PASS' : 'FAIL';
        const errorInfo = result.errorType ? ` [${result.errorType}]` : '';
        const fallbackInfo = result.fallbackUsed ? ' [FALLBACK]' : '';
        const retryInfo = result.retried ? ' [RETRIED]' : '';
        const circuitInfo = result.circuitBreakerTripped ? ' [CIRCUIT]' : '';
        
        console.log(`[${progress}%] ${status} ${result.suite} - ${result.test} (${result.durationMs}ms)${errorInfo}${fallbackInfo}${retryInfo}${circuitInfo}`);
        
        return result;
      } catch (unexpectedError) {
        // Handle completely unexpected errors
        logError(ERROR_TYPES.UNKNOWN, 'Unexpected error in test execution', {
          test: test.name,
          suite: suiteName
        }, unexpectedError);
        
        completedTests++;
        failedTests++;
        
        return {
          suite: suiteName,
          test: test.name,
          description: 'Test execution failed unexpectedly',
          prompt: test.prompt || '',
          response: '',
          pass: false,
          details: [unexpectedError.message || 'Unknown error'],
          tokenCount: 0,
          cost: null,
          durationMs: 0,
          error: unexpectedError.message || 'Unknown error',
          errorType: ERROR_TYPES.UNKNOWN,
          attempt: 1,
          retried: false,
          networkRetries: 0,
          modelUsed: 'none',
          fallbackUsed: false,
          circuitBreakerTripped: false,
          retryAttempts: 0
        };
      }
    });
    
    // Wait for current batch to complete
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Collect results (both fulfilled and rejected)
    for (const batchResult of batchResults) {
      if (batchResult.status === 'fulfilled') {
        results.push(batchResult.value);
      } else {
        // Handle batch-level errors
        logError(ERROR_TYPES.UNKNOWN, 'Batch execution error', {
          batchIndex: i / CONFIG.maxConcurrency
        }, batchResult.reason);
        
        completedTests++;
        failedTests++;
        
        results.push({
          suite: 'Unknown',
          test: 'Unknown',
          description: 'Batch execution failed',
          prompt: '',
          response: '',
          pass: false,
          details: [batchResult.reason.message || 'Batch error'],
          tokenCount: 0,
          cost: null,
          durationMs: 0,
          error: batchResult.reason.message || 'Batch error',
          errorType: ERROR_TYPES.UNKNOWN,
          attempt: 1,
          retried: false,
          networkRetries: 0,
          modelUsed: 'none',
          fallbackUsed: false,
          circuitBreakerTripped: false,
          retryAttempts: 0
        });
      }
    }
  }
  
  // Final error summary with reliability insights
  console.log('\n=== ENTERPRISE RELIABILITY SUMMARY ===');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Completed: ${completedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Network errors: ${networkErrors}`);
  console.log(`Model errors: ${modelErrors}`);
  console.log(`Circuit breaker trips: ${circuitBreakerErrors}`);
  console.log(`Success rate: ${((completedTests - failedTests) / totalTests * 100).toFixed(1)}%`);
  
  // Get system health and metrics
  try {
    const systemHealth = reliabilityManager.getSystemHealth();
    const systemMetrics = reliabilityManager.getSystemMetrics();
    
    console.log('\n=== SYSTEM RELIABILITY STATUS ===');
    console.log(`Overall Health: ${systemHealth.overall.overall.toUpperCase()}`);
    console.log(`Circuit Breakers: ${systemHealth.services.length} services monitored`);
    console.log(`Queue Status: ${systemHealth.queue.queueLength} pending, ${systemHealth.queue.running} running`);
    console.log(`Metrics Collected: ${systemMetrics.metrics.summary.totalCounters} counters, ${systemMetrics.metrics.summary.totalHistograms} histograms`);
  } catch (error) {
    console.log('\n=== SYSTEM RELIABILITY STATUS ===');
    console.log('Reliability metrics unavailable');
  }
  
  // Aggregate and format results
  const aggregation = aggregateResults(results, reliabilityManager);
  const humanResults = formatHumanResults(aggregation, reliabilityManager);
  
  console.log(humanResults);
  
  // Stop reliability manager
  reliabilityManager.stop();
  
  return {
    raw: results,
    aggregated: aggregation,
    humanReadable: humanResults,
    reliabilityManager
  };
}

/**
 * Runs all tests with enterprise reliability features.
 * @param {Array<Object>} testObjects
 * @returns {Promise<object>} Comprehensive test results with reliability insights
 */
export async function runTests(testObjects) {
  return await runTestsParallel(testObjects);
} 