/**
 * Cost Calculator for AI model usage
 * Tracks tokens, calculates costs, and manages budget limits
 */

// Current pricing per 1K tokens (as of 2024)
const MODEL_PRICING = {
  // OpenAI Models
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  
  // Anthropic Models
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-2': { input: 0.008, output: 0.024 },
  
  // Local Models (estimated)
  'mistral:7b': { input: 0.0001, output: 0.0001 },
  'llama2:7b': { input: 0.0001, output: 0.0001 },
  'codellama:7b': { input: 0.0001, output: 0.0001 },
  
  // Default fallback
  'default': { input: 0.002, output: 0.004 }
};

// Budget warning thresholds
const BUDGET_WARNING_THRESHOLDS = {
  LOW: 0.1,    // $0.10
  MEDIUM: 0.5,  // $0.50
  HIGH: 1.0     // $1.00
};

/**
 * Simple token counter (words + punctuation)
 * For more accurate counting, consider using tiktoken or similar
 * @param {string} text
 * @returns {number}
 */
function countTokens(text) {
  if (!text) return 0;
  
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is a simplified approach - production should use proper tokenizers
  const charCount = text.length;
  const wordCount = text.trim().split(/\s+/).length;
  
  // Use the higher of character-based or word-based estimation
  return Math.max(Math.ceil(charCount / 4), wordCount);
}

/**
 * Get pricing for a specific model
 * @param {string} modelName
 * @returns {object} { input: number, output: number }
 */
function getModelPricing(modelName) {
  const normalizedName = modelName.toLowerCase();
  
  // Try exact match first
  if (MODEL_PRICING[normalizedName]) {
    return MODEL_PRICING[normalizedName];
  }
  
  // Try partial matches
  for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalizedName.includes(model) || model.includes(normalizedName)) {
      return pricing;
    }
  }
  
  // Return default pricing
  return MODEL_PRICING.default;
}

/**
 * Calculate cost for a single request
 * @param {string} prompt
 * @param {string} response
 * @param {string} modelName
 * @returns {object}
 */
export function calculateRequestCost(prompt, response, modelName = 'gpt-3.5-turbo') {
  const pricing = getModelPricing(modelName);
  const promptTokens = countTokens(prompt);
  const responseTokens = countTokens(response);
  
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (responseTokens / 1000) * pricing.output;
  const totalCost = inputCost + outputCost;
  
  return {
    model: modelName,
    promptTokens,
    responseTokens,
    totalTokens: promptTokens + responseTokens,
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
    pricing
  };
}

/**
 * Cost tracker for managing cumulative costs
 */
export class CostTracker {
  constructor(budgetLimit = null) {
    this.budgetLimit = budgetLimit;
    this.totalCost = 0;
    this.requests = [];
    this.warnings = [];
  }
  
  /**
   * Add a request cost to the tracker
   * @param {object} costData - Result from calculateRequestCost
   * @param {string} testName - Optional test identifier
   */
  addRequest(costData, testName = null) {
    const request = {
      ...costData,
      testName,
      timestamp: new Date(),
      cumulativeCost: this.totalCost + costData.totalCost
    };
    
    this.requests.push(request);
    this.totalCost += costData.totalCost;
    
    // Check budget warnings
    this.checkBudgetWarnings();
    
    return request;
  }
  
  /**
   * Check if approaching budget limits
   */
  checkBudgetWarnings() {
    if (!this.budgetLimit) return;
    
    const percentage = this.totalCost / this.budgetLimit;
    
    if (percentage >= 0.9 && !this.warnings.includes('CRITICAL')) {
      this.warnings.push('CRITICAL');
      console.warn(`⚠️  CRITICAL: Budget limit nearly reached! $${this.totalCost.toFixed(4)} / $${this.budgetLimit}`);
    } else if (percentage >= 0.7 && !this.warnings.includes('HIGH')) {
      this.warnings.push('HIGH');
      console.warn(`⚠️  HIGH: Budget limit 70% reached. $${this.totalCost.toFixed(4)} / $${this.budgetLimit}`);
    } else if (percentage >= 0.5 && !this.warnings.includes('MEDIUM')) {
      this.warnings.push('MEDIUM');
      console.warn(`⚠️  MEDIUM: Budget limit 50% reached. $${this.totalCost.toFixed(4)} / $${this.budgetLimit}`);
    }
  }
  
  /**
   * Get cost summary
   * @returns {object}
   */
  getSummary() {
    const modelBreakdown = {};
    let totalTokens = 0;
    
    for (const request of this.requests) {
      const model = request.model;
      if (!modelBreakdown[model]) {
        modelBreakdown[model] = {
          requests: 0,
          totalCost: 0,
          totalTokens: 0
        };
      }
      
      modelBreakdown[model].requests++;
      modelBreakdown[model].totalCost += request.totalCost;
      modelBreakdown[model].totalTokens += request.totalTokens;
      totalTokens += request.totalTokens;
    }
    
    return {
      totalRequests: this.requests.length,
      totalCost: parseFloat(this.totalCost.toFixed(6)),
      totalTokens,
      budgetLimit: this.budgetLimit,
      budgetRemaining: this.budgetLimit ? this.budgetLimit - this.totalCost : null,
      budgetPercentage: this.budgetLimit ? (this.totalCost / this.budgetLimit) * 100 : null,
      modelBreakdown,
      warnings: this.warnings
    };
  }
  
  /**
   * Reset the tracker
   */
  reset() {
    this.totalCost = 0;
    this.requests = [];
    this.warnings = [];
  }
  
  /**
   * Export cost data for reporting
   * @returns {object}
   */
  exportData() {
    return {
      summary: this.getSummary(),
      requests: this.requests,
      timestamp: new Date()
    };
  }
}

/**
 * Create a cost tracker with budget limit
 * @param {number} budgetLimit - Budget limit in USD
 * @returns {CostTracker}
 */
export function createCostTracker(budgetLimit = null) {
  return new CostTracker(budgetLimit);
}

/**
 * Get current model pricing
 * @returns {object}
 */
export function getAvailableModels() {
  return Object.keys(MODEL_PRICING).filter(key => key !== 'default');
}

/**
 * Estimate cost for a test suite
 * @param {Array} tests - Array of test objects
 * @param {string} modelName - Model to use
 * @returns {object}
 */
export function estimateTestSuiteCost(tests, modelName = 'gpt-3.5-turbo') {
  const pricing = getModelPricing(modelName);
  let totalEstimatedCost = 0;
  let totalEstimatedTokens = 0;
  
  for (const test of tests) {
    const promptTokens = countTokens(test.prompt);
    // Estimate response tokens (typically 1-3x prompt length)
    const estimatedResponseTokens = promptTokens * 2;
    
    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (estimatedResponseTokens / 1000) * pricing.output;
    totalEstimatedCost += inputCost + outputCost;
    totalEstimatedTokens += promptTokens + estimatedResponseTokens;
  }
  
  return {
    model: modelName,
    testCount: tests.length,
    estimatedTotalCost: parseFloat(totalEstimatedCost.toFixed(6)),
    estimatedTotalTokens: totalEstimatedTokens,
    averageCostPerTest: parseFloat((totalEstimatedCost / tests.length).toFixed(6))
  };
}
