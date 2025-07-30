import axios from 'axios';
import { 
  exponentialBackoff, 
  classifyError, 
  handleErrorWithGracefulDegradation,
  logger,
  RETRY_CONFIG,
  ERROR_TYPES
} from '../error-handler.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

if (!OPENAI_API_KEY) {
  logger.error('Missing OPENAI_API_KEY in environment variables.');
}

// Simple token counter (splits on whitespace)
function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Enhanced OpenAI API client with comprehensive error handling
 */
class OpenAIClient {
  constructor() {
    this.baseURL = OPENAI_URL;
    this.apiKey = OPENAI_API_KEY;
    this.defaultModel = MODEL;
    this.timeout = RETRY_CONFIG.TIMEOUT_MS;
  }

  /**
   * Make a request to OpenAI API with enhanced error handling
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
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Glassbox-CLI/1.0'
      },
      timeout: this.timeout,
      data: {
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature
      }
    };

    try {
      // Use exponential backoff for retries
      const response = await exponentialBackoff(async () => {
        const res = await axios(requestConfig);
        
        // Validate response structure
        if (!res.data || !res.data.choices || !res.data.choices[0] || !res.data.choices[0].message) {
          throw new Error('Invalid response structure from OpenAI API');
        }
        
        return res;
      }, retryConfig.maxRetries || RETRY_CONFIG.DEFAULT_MAX_RETRIES);

      const responseText = response.data.choices[0].message.content;
      const tokenCount = countTokens(responseText);
      
      // Log successful request
      logger.info('OpenAI API request successful', {
        model,
        promptLength: prompt.length,
        responseLength: responseText.length,
        tokenCount
      });

      return { 
        response: responseText, 
        tokenCount,
        model,
        usage: response.data.usage
      };

    } catch (error) {
      // Handle error with graceful degradation
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: 'openai',
        model,
        promptLength: prompt.length,
        operation: 'generate_response'
      });

      // Log detailed error information
      logger.error('OpenAI API request failed', {
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
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 5000
      });
      
      return {
        healthy: response.status === 200,
        status: response.status,
        available: response.data?.data?.length > 0
      };
    } catch (error) {
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: 'openai',
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
   * Validate API key and permissions
   */
  async validateCredentials() {
    try {
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 5000
      });
      
      return {
        valid: response.status === 200,
        models: response.data?.data?.map(m => m.id) || [],
        organization: response.headers['openai-organization']
      };
    } catch (error) {
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: 'openai',
        operation: 'validate_credentials'
      });
      
      return {
        valid: false,
        error: errorResult.error.type,
        message: errorResult.error.message
      };
    }
  }
}

// Create singleton instance
const openaiClient = new OpenAIClient();

/**
 * Legacy function for backward compatibility
 * @param {string} prompt
 * @returns {Promise<{response: string, tokenCount: number}>}
 */
export async function generateResponse(prompt) {
  try {
    const result = await openaiClient.makeRequest(prompt);
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
  return await openaiClient.makeRequest(prompt, options);
}

/**
 * Check OpenAI service health
 * @returns {Promise<object>}
 */
export async function checkOpenAIHealth() {
  return await openaiClient.checkHealth();
}

/**
 * Validate OpenAI credentials
 * @returns {Promise<object>}
 */
export async function validateOpenAICredentials() {
  return await openaiClient.validateCredentials();
}
