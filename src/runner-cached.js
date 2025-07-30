import { generateResponse } from './models/ollama-client.js';
import { generateResponse as generateResponseOpenAI } from './models/openai-client.js';
import { validateContent } from './validators/content-validator.js';
import { detectPII } from './validators/pii-detector.js';
import { calculateRequestCost } from './validators/cost-calculator.js';
import { createCachedClient } from './cache/cache-integration.js';
import { CacheConfig } from './cache/cache-config.js';

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
  CACHE: 'CACHE_ERROR',
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
  CACHE: 'CACHE_FAILURE',
  UNKNOWN: 'UNKNOWN_FAILURE'
};

// Cache configuration
let cacheConfig = null;
let cachedClients = {
  ollama: null,
  openai: null
};

/**
 * Initialize cache configuration and clients
 */
async function initializeCache() {
  if (!cacheConfig) {
    cacheConfig = new CacheConfig();
    await cacheConfig.load();
  }
  
  if (!cachedClients.ollama) {
    const ollamaClient = {
      sendRequest: async (request) => {
        return await generateResponse(request.prompt, request);
      },
      defaultModel: 'mistral:7b'
    };
    cachedClients.ollama = createCachedClient(ollamaClient, cacheConfig.getCacheOptions());
  }
  
  if (!cachedClients.openai) {
    const openaiClient = {
      sendRequest: async (request) => {
        return await generateResponseOpenAI(request.prompt, request);
      },
      defaultModel: 'gpt-3.5-turbo'
    };
    cachedClients.openai = createCachedClient(openaiClient, cacheConfig.getCacheOptions());
  }
}

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
 * Try multiple model providers with fallback and caching
 * @param {string} prompt
 * @param {object} modelConfig
 * @returns {Promise<object>}
 */
async function tryMultipleModels(prompt, modelConfig = {}) {
  // Initialize cache if not already done
  await initializeCache();
  
  const models = [
    { name: 'ollama', provider: cachedClients.ollama },
    { name: 'openai', provider: cachedClients.openai }
  ];
  
  let lastError = null;
  
  for (const model of models) {
    try {
      const request = {
        prompt,
        model: modelConfig.model || model.provider.defaultModel,
        temperature: modelConfig.temperature || 0.7,
        max_tokens: modelConfig.max_tokens || 100,
        ...modelConfig
      };
      
      const result = await model.provider.sendRequest(request);
      
      return {
        response: result.content || result.text || result.response || '',
        tokenCount: result.usage?.total_tokens || result.tokenCount || 0,
        modelUsed: request.model,
        fallbackUsed: model.name !== 'ollama', // ollama is primary
        cached: result.cached || false,
        cacheKey: result.cacheKey
      };
      
    } catch (error) {
      lastError = error;
      
      // Log cache-related errors
      if (error.message.includes('cache')) {
        logError(ERROR_TYPES.CACHE, `Cache operation failed: ${error.message}`, {
          model: model.name,
          promptLength: prompt.length
        }, error);
      }
      
      // Continue to next model if available
      continue;
    }
  }
  
  // All models failed
  throw lastError || new Error('All model providers failed');
}

/**
 * Validate response against expectations
 * @param {string} response
 * @param {object} expect
 * @param {object} settings
 * @returns {object}
 */
function validateResponse(response, expect, settings = {}) {
  const results = {
    pass: true,
    details: []
  };
  
  try {
    // Content validation
    if (expect.contains || expect.not_contains) {
      const contentValidation = validateContent(response, expect);
      if (!contentValidation.overall.pass) {
        results.pass = false;
        results.details.push(...contentValidation.overall.details);
      }
    }
    
    // PII detection
    if (settings.safety_checks?.block_pii) {
      const piiResult = detectPII(response);
      if (piiResult.detected) {
        results.pass = false;
        results.details.push(`PII detected: ${piiResult.types.join(', ')}`);
      }
    }
    
    // Email detection
    if (settings.safety_checks?.block_email) {
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
      if (emailRegex.test(response)) {
        results.pass = false;
        results.details.push('Email addresses detected');
      }
    }
    
    // Phone detection
    if (settings.safety_checks?.block_phone) {
      const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
      if (phoneRegex.test(response)) {
        results.pass = false;
        results.details.push('Phone numbers detected');
      }
    }
    
    // SSN detection
    if (settings.safety_checks?.block_ssn) {
      const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/;
      if (ssnRegex.test(response)) {
        results.pass = false;
        results.details.push('SSN detected');
      }
    }
    
  } catch (error) {
    results.pass = false;
    results.details.push(`Validation error: ${error.message}`);
  }
  
  return results;
}

/**
 * Categorize test failure
 * @param {object} result
 * @returns {string}
 */
function categorizeFailure(result) {
  if (result.error) {
    if (result.error.includes('timeout')) return FAILURE_CATEGORIES.TIMEOUT;
    if (result.error.includes('network')) return FAILURE_CATEGORIES.NETWORK;
    if (result.error.includes('model')) return FAILURE_CATEGORIES.MODEL;
    if (result.error.includes('cache')) return FAILURE_CATEGORIES.CACHE;
    return FAILURE_CATEGORIES.UNKNOWN;
  }
  
  if (result.details && result.details.length > 0) {
    const details = result.details.join(' ').toLowerCase();
    if (details.includes('pii')) return FAILURE_CATEGORIES.PII;
    if (details.includes('cost')) return FAILURE_CATEGORIES.COST;
    if (details.includes('content')) return FAILURE_CATEGORIES.CONTENT;
    return FAILURE_CATEGORIES.VALIDATION;
  }
  
  return FAILURE_CATEGORIES.UNKNOWN;
}

/**
 * Execute a single test with caching
 * @param {object} test
 * @param {object} settings
 * @param {string} suiteName
 * @returns {Promise<object>}
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
        
        // Try multiple models with fallback and caching
        const aiResult = await tryMultipleModels(prompt, settings);
        const response = aiResult.response;
        const tokenCount = aiResult.tokenCount;
        
        const validation = validateResponse(response, expect, settings);
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
          cached: aiResult.cached || false,
          cacheKey: aiResult.cacheKey,
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
      } else if (err.message.includes('cache')) {
        errorType = ERROR_TYPES.CACHE;
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
        fallbackUsed: false,
        cached: false
      };
    }
  }
}

/**
 * Aggregate test results with cache statistics
 * @param {Array<object>} results
 * @returns {object}
 */
function aggregateResults(results) {
  const aggregation = {
    summary: {
      total: results.length,
      passed: results.filter(r => r.pass).length,
      failed: results.filter(r => !r.pass).length,
      totalDuration: results.reduce((sum, r) => sum + r.durationMs, 0),
      totalCost: results.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0),
      totalTokens: results.reduce((sum, r) => sum + (r.tokenCount || 0), 0),
      cachedResponses: results.filter(r => r.cached).length,
      cacheHitRate: 0
    },
    performance: {
      averageDuration: 0,
      fastestTest: null,
      slowestTest: null,
      durationDistribution: {
        fast: 0, // < 5s
        medium: 0, // 5-15s
        slow: 0 // > 15s
      }
    },
    models: {
      usage: {},
      fallbackRate: 0
    },
    failures: {
      byCategory: {},
      total: 0
    },
    cache: {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0
    }
  };
  
  // Calculate cache statistics
  const cachedResults = results.filter(r => r.cached);
  const totalResults = results.length;
  aggregation.summary.cacheHitRate = totalResults > 0 ? (cachedResults.length / totalResults) * 100 : 0;
  aggregation.cache.hits = cachedResults.length;
  aggregation.cache.misses = totalResults - cachedResults.length;
  aggregation.cache.hitRate = aggregation.summary.cacheHitRate;
  
  // Calculate performance metrics
  if (results.length > 0) {
    aggregation.performance.averageDuration = aggregation.summary.totalDuration / results.length;
    
    const sortedByDuration = [...results].sort((a, b) => a.durationMs - b.durationMs);
    aggregation.performance.fastestTest = sortedByDuration[0];
    aggregation.performance.slowestTest = sortedByDuration[sortedByDuration.length - 1];
    
    results.forEach(result => {
      if (result.durationMs < 5000) aggregation.performance.durationDistribution.fast++;
      else if (result.durationMs < 15000) aggregation.performance.durationDistribution.medium++;
      else aggregation.performance.durationDistribution.slow++;
    });
  }
  
  // Calculate model usage
  results.forEach(result => {
    const model = result.modelUsed || 'unknown';
    aggregation.models.usage[model] = (aggregation.models.usage[model] || 0) + 1;
  });
  
  // Calculate fallback rate
  const fallbackCount = results.filter(r => r.fallbackUsed).length;
  aggregation.models.fallbackRate = results.length > 0 ? (fallbackCount / results.length) * 100 : 0;
  
  // Calculate failure categories
  results.forEach(result => {
    if (!result.pass) {
      const category = categorizeFailure(result);
      aggregation.failures.byCategory[category] = (aggregation.failures.byCategory[category] || 0) + 1;
      aggregation.failures.total++;
    }
  });
  
  // Calculate success rate
  aggregation.summary.successRate = results.length > 0 ? (aggregation.summary.passed / results.length) * 100 : 0;
  
  return aggregation;
}

/**
 * Run tests with caching support
 * @param {Array<object>} testObjects
 * @returns {Promise<object>}
 */
export async function runTests(testObjects) {
  // Initialize cache
  await initializeCache();
  
  const allTests = [];
  const results = [];
  
  // Extract all tests from test objects
  testObjects.forEach(testObj => {
    const { name: suiteName, tests, settings = {} } = testObj;
    tests.forEach(test => {
      allTests.push({ test, settings, suiteName });
    });
  });
  
  console.log(`Running ${allTests.length} tests with caching enabled...`);
  
  // Execute tests with concurrency control
  const concurrency = Math.min(CONFIG.maxConcurrency, allTests.length);
  const chunks = [];
  
  for (let i = 0; i < allTests.length; i += concurrency) {
    chunks.push(allTests.slice(i, i + concurrency));
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkPromises = chunk.map(({ test, settings, suiteName }) => 
      executeTest(test, settings, suiteName)
    );
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    
    // Show progress
    const progress = Math.min((i + 1) * concurrency, allTests.length);
    console.log(`Progress: ${progress}/${allTests.length} tests completed`);
  }
  
  // Aggregate results
  const aggregation = aggregateResults(results);
  
  // Get cache statistics
  try {
    const ollamaStats = await cachedClients.ollama.getCacheStats();
    const openaiStats = await cachedClients.openai.getCacheStats();
    
    aggregation.cache.totalSize = ollamaStats.totalSize + openaiStats.totalSize;
    aggregation.cache.hits = ollamaStats.hits + openaiStats.hits;
    aggregation.cache.misses = ollamaStats.misses + openaiStats.misses;
    
    const totalRequests = aggregation.cache.hits + aggregation.cache.misses;
    aggregation.cache.hitRate = totalRequests > 0 ? (aggregation.cache.hits / totalRequests) * 100 : 0;
  } catch (error) {
    console.warn('Failed to get cache statistics:', error.message);
  }
  
  return {
    raw: results,
    aggregated: aggregation,
    machineReadable: {
      summary: aggregation.summary,
      performance: aggregation.performance,
      models: aggregation.models,
      failures: aggregation.failures,
      cache: aggregation.cache,
      tests: results
    }
  };
} 