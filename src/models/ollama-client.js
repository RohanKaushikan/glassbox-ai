import axios from 'axios';
import { 
  exponentialBackoff, 
  classifyError, 
  handleErrorWithGracefulDegradation,
  logger,
  RETRY_CONFIG,
  ERROR_TYPES
} from '../error-handler.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:7b';

// Simple token counter (splits on whitespace)
function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Enhanced Ollama API client with comprehensive error handling
 */
class OllamaClient {
  constructor() {
    this.baseURL = OLLAMA_URL;
    this.defaultModel = OLLAMA_MODEL;
    this.timeout = RETRY_CONFIG.TIMEOUT_MS;
  }

  /**
   * Make a request to Ollama API with enhanced error handling
   */
  async makeRequest(prompt, options = {}) {
    const {
      model = this.defaultModel,
      maxTokens = 1000,
      temperature = 0.7,
      retryConfig = {}
    } = options;

    const requestConfig = {
      method: 'POST',
      url: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Glassbox-CLI/1.0'
      },
      timeout: this.timeout,
      data: {
        model,
        prompt,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature
        }
      }
    };

    try {
      // Use exponential backoff for retries
      const response = await exponentialBackoff(async () => {
        const res = await axios(requestConfig);
        
        // Validate response structure
        if (!res.data || res.data.response === undefined) {
          throw new Error('Invalid response structure from Ollama API');
        }
        
        return res;
      }, retryConfig.maxRetries || RETRY_CONFIG.DEFAULT_MAX_RETRIES);

      const responseText = response.data.response;
      const tokenCount = countTokens(responseText);
      
      // Log successful request
      logger.info('Ollama API request successful', {
        model,
        promptLength: prompt.length,
        responseLength: responseText.length,
        tokenCount
      });

      return { 
        response: responseText, 
        tokenCount,
        model,
        usage: {
          prompt_tokens: countTokens(prompt),
          completion_tokens: tokenCount,
          total_tokens: countTokens(prompt) + tokenCount
        }
      };

    } catch (error) {
      // Handle error with graceful degradation
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: 'ollama',
        model,
        promptLength: prompt.length,
        operation: 'generate_response'
      });

      // Log detailed error information
      logger.error('Ollama API request failed', {
        error: errorResult.error.type,
        severity: errorResult.error.severity,
        retryable: errorResult.error.retryable,
        context: errorResult.error.context
      });

      // Throw the classified error for upstream handling
      throw errorResult.error;
    }
  }

  /**
   * Check if the service is healthy
   */
  async checkHealth() {
    try {
      const response = await axios.get('http://localhost:11434/api/tags', {
        timeout: 5000
      });
      
      return {
        healthy: response.status === 200,
        status: response.status,
        available: response.data?.models?.length > 0
      };
    } catch (error) {
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: 'ollama',
        operation: 'health_check'
      });
      
      return {
        healthy: false,
        error: errorResult.error.type,
        message: errorResult.error.message
      };
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    try {
      const response = await axios.get('http://localhost:11434/api/tags', {
        timeout: 5000
      });
      
      return {
        models: response.data?.models?.map(m => m.name) || [],
        count: response.data?.models?.length || 0
      };
    } catch (error) {
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: 'ollama',
        operation: 'get_models'
      });
      
      return {
        models: [],
        count: 0,
        error: errorResult.error.type,
        message: errorResult.error.message
      };
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName) {
    try {
      const models = await this.getAvailableModels();
      return {
        available: models.models.includes(modelName),
        models: models.models
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Pull a model if not available
   */
  async pullModel(modelName) {
    try {
      logger.info(`Pulling model: ${modelName}`);
      
      const response = await axios.post('http://localhost:11434/api/pull', {
        name: modelName
      }, {
        timeout: 300000, // 5 minutes for model download
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        model: modelName,
        status: response.data?.status || 'completed'
      };
    } catch (error) {
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: 'ollama',
        operation: 'pull_model',
        model: modelName
      });
      
      return {
        success: false,
        model: modelName,
        error: errorResult.error.type,
        message: errorResult.error.message
      };
    }
  }
}

// Create singleton instance
const ollamaClient = new OllamaClient();

/**
 * Legacy function for backward compatibility
 * @param {string} prompt
 * @returns {Promise<{response: string, tokenCount: number}>}
 */
export async function generateResponse(prompt) {
  try {
    const result = await ollamaClient.makeRequest(prompt);
    return {
      response: result.response,
      tokenCount: result.tokenCount
    };
  } catch (error) {
    // Re-throw the error for backward compatibility
    throw error;
  }
}

/**
 * Enhanced response generation with options
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<{response: string, tokenCount: number, model: string, usage: object}>}
 */
export async function generateResponseWithOptions(prompt, options = {}) {
  return await ollamaClient.makeRequest(prompt, options);
}

/**
 * Check Ollama service health
 * @returns {Promise<object>}
 */
export async function checkOllamaHealth() {
  return await ollamaClient.checkHealth();
}

/**
 * Get available Ollama models
 * @returns {Promise<object>}
 */
export async function getOllamaModels() {
  return await ollamaClient.getAvailableModels();
}

/**
 * Check if model is available
 * @param {string} modelName
 * @returns {Promise<object>}
 */
export async function isOllamaModelAvailable(modelName) {
  return await ollamaClient.isModelAvailable(modelName);
}

/**
 * Pull Ollama model
 * @param {string} modelName
 * @returns {Promise<object>}
 */
export async function pullOllamaModel(modelName) {
  return await ollamaClient.pullModel(modelName);
}
