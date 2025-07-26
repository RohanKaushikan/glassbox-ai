import { generateResponse } from './models/ollama-client.js';
import { generateResponse as generateResponseOpenAI } from './models/openai-client.js';
import { validateContent } from './validators/content-validator.js';
import { detectPII } from './validators/pii-detector.js';
import { calculateRequestCost } from './validators/cost-calculator.js';

// Configuration for parallel execution
const CONFIG = {
  maxConcurrency: 5,
  testTimeoutMs: 30000, // 30 seconds per test
  maxRetries: 2,
  retryDelayMs: 1000,
  networkRetryDelayMs: 2000,
  maxNetworkRetries: 3
};

// Error types for better categorization
const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  MODEL: 'MODEL_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
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
  UNKNOWN: 'UNKNOWN_FAILURE'
};

/**
 * Enhanced error logging with categorization
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
 * Try multiple model providers with fallback
 * @param {string} prompt
 * @param {object} modelConfig
 * @returns {Promise<object>}
 */
async function tryMultipleModels(prompt, modelConfig = {}) {
  const models = [
    { name: 'ollama', provider: generateResponse },
    { name: 'openai', provider: generateResponseOpenAI }
  ];
  
  let lastError = null;
  
  for (const model of models) {
    try {
      const result = await model.provider(prompt);
      return {
        ...result,
        modelUsed: model.name,
        fallbackUsed: model.name !== 'ollama' // ollama is primary
      };
    } catch (error) {
      lastError = error;
      const errorType = isNetworkError(error) ? ERROR_TYPES.NETWORK : 
                       isModelError(error) ? ERROR_TYPES.MODEL : 
                       ERROR_TYPES.UNKNOWN;
      
      logError(errorType, `Failed to use ${model.name} model`, {
        model: model.name,
        promptLength: prompt.length
      }, error);
      
      // Continue to next model if available
      continue;
    }
  }
  
  // All models failed
  throw new Error(`All model providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
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
 * Categorize test failure
 * @param {object} result - Test result
 * @returns {string} Failure category
 */
function categorizeFailure(result) {
  if (result.errorType === ERROR_TYPES.NETWORK) return FAILURE_CATEGORIES.NETWORK;
  if (result.errorType === ERROR_TYPES.MODEL) return FAILURE_CATEGORIES.MODEL;
  if (result.errorType === ERROR_TYPES.TIMEOUT) return FAILURE_CATEGORIES.TIMEOUT;
  if (result.errorType === ERROR_TYPES.VALIDATION) return FAILURE_CATEGORIES.VALIDATION;
  
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
 * Aggregate test results with comprehensive statistics
 * @param {Array<object>} results - Array of test results
 * @returns {object} Aggregated results
 */
function aggregateResults(results) {
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
    suites: {}
  };
  
  let totalFallbacks = 0;
  let totalCost = 0;
  
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
    if (result.fallbackUsed) totalFallbacks++;
    
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
  }
  
  // Calculate derived statistics
  aggregation.summary.successRate = (aggregation.summary.passed / aggregation.summary.total) * 100;
  aggregation.performance.averageDuration = aggregation.summary.totalDuration / aggregation.summary.total;
  aggregation.models.fallbackRate = (totalFallbacks / aggregation.summary.total) * 100;
  aggregation.summary.totalCost = totalCost;
  aggregation.costs.averageCostPerTest = totalCost / aggregation.summary.total;
  
  return aggregation;
}

/**
 * Format results for human consumption
 * @param {object} aggregation - Aggregated results
 * @returns {string} Formatted summary
 */
function formatHumanResults(aggregation) {
  const { summary, failures, performance, models, costs } = aggregation;
  
  let output = '\n=== TEST RESULTS SUMMARY ===\n';
  output += `Total Tests: ${summary.total}\n`;
  output += `Passed: ${summary.passed} (${summary.successRate.toFixed(1)}%)\n`;
  output += `Failed: ${summary.failed}\n`;
  output += `Total Duration: ${(summary.totalDuration / 1000).toFixed(1)}s\n`;
  output += `Average Duration: ${(performance.averageDuration / 1000).toFixed(1)}s\n`;
  output += `Total Cost: $${summary.totalCost.toFixed(6)}\n`;
  output += `Average Cost per Test: $${costs.averageCostPerTest.toFixed(6)}\n`;
  output += `Total Tokens: ${summary.totalTokens.toLocaleString()}\n`;
  output += `Model Fallback Rate: ${models.fallbackRate.toFixed(1)}%\n\n`;
  
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
  
  return output;
}

/**
 * Format results for machine consumption (JSON)
 * @param {object} aggregation - Aggregated results
 * @param {Array<object>} rawResults - Raw test results
 * @returns {object} Machine-readable results
 */
function formatMachineResults(aggregation, rawResults) {
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      format: 'machine-readable'
    },
    aggregation,
    rawResults,
    export: {
      summary: aggregation.summary,
      failures: aggregation.failures,
      performance: aggregation.performance,
      models: aggregation.models,
      costs: aggregation.costs,
      suites: aggregation.suites
    }
  };
}

/**
 * Execute a single test with comprehensive error handling
 * @param {object} test - Test object
 * @param {object} settings - Test settings
 * @param {string} suiteName - Name of the test suite
 * @returns {Promise<object>} Test result
 */
async function executeTest(test, settings, suiteName) {
  const { name, description, prompt, expect } = test;
  let lastError = null;
  let networkRetries = 0;
  
  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), CONFIG.testTimeoutMs);
      });
      
      // Execute test with timeout and model fallback
      const testPromise = (async () => {
        const start = Date.now();
        
        // Try multiple models with fallback
        const aiResult = await tryMultipleModels(prompt);
        const response = aiResult.response;
        const tokenCount = aiResult.tokenCount;
        
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
          modelUsed: aiResult.modelUsed,
          fallbackUsed: aiResult.fallbackUsed || false,
          networkRetries
        };
      })();
      
      return await Promise.race([testPromise, timeoutPromise]);
      
    } catch (err) {
      lastError = err;
      
      // Categorize error
      let errorType = ERROR_TYPES.UNKNOWN;
      if (err.message.includes('timeout')) {
        errorType = ERROR_TYPES.TIMEOUT;
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
        fallbackUsed: false
      };
    }
  }
}

/**
 * Process tests in parallel with enhanced error handling
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
  
  // Flatten all tests into a single array with metadata
  for (const testFile of testObjects) {
    const { name: suiteName, settings, tests } = testFile;
    for (const test of tests) {
      allTests.push({ test, settings, suiteName });
      totalTests++;
    }
  }
  
  console.log(`Starting ${totalTests} tests with max ${CONFIG.maxConcurrency} concurrent executions...`);
  console.log('Error handling: Network retries, model fallbacks, and graceful degradation enabled.');
  
  // Process tests in batches
  for (let i = 0; i < allTests.length; i += CONFIG.maxConcurrency) {
    const batch = allTests.slice(i, i + CONFIG.maxConcurrency);
    const batchPromises = batch.map(async ({ test, settings, suiteName }) => {
      try {
        const result = await executeTest(test, settings, suiteName);
        completedTests++;
        
        // Track error statistics
        if (!result.pass) failedTests++;
        if (result.errorType === ERROR_TYPES.NETWORK) networkErrors++;
        if (result.errorType === ERROR_TYPES.MODEL) modelErrors++;
        
        // Real-time progress update with error context
        const progress = ((completedTests / totalTests) * 100).toFixed(1);
        const status = result.pass ? 'PASS' : 'FAIL';
        const errorInfo = result.errorType ? ` [${result.errorType}]` : '';
        const fallbackInfo = result.fallbackUsed ? ' [FALLBACK]' : '';
        const retryInfo = result.retried ? ' [RETRIED]' : '';
        
        console.log(`[${progress}%] ${status} ${result.suite} - ${result.test} (${result.durationMs}ms)${errorInfo}${fallbackInfo}${retryInfo}`);
        
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
          fallbackUsed: false
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
          fallbackUsed: false
        });
      }
    }
  }
  
  // Final error summary
  console.log('\n=== Error Summary ===');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Completed: ${completedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Network errors: ${networkErrors}`);
  console.log(`Model errors: ${modelErrors}`);
  console.log(`Success rate: ${((completedTests - failedTests) / totalTests * 100).toFixed(1)}%`);
  
  // Aggregate and format results
  const aggregation = aggregateResults(results);
  const humanResults = formatHumanResults(aggregation);
  const machineResults = formatMachineResults(aggregation, results);
  
  console.log(humanResults);
  
  return {
    raw: results,
    aggregated: aggregation,
    humanReadable: humanResults,
    machineReadable: machineResults
  };
}

/**
 * Runs all tests in the provided test objects.
 * @param {Array<Object>} testObjects
 * @returns {Promise<object>} Comprehensive test results
 */
export async function runTests(testObjects) {
  return await runTestsParallel(testObjects);
}
