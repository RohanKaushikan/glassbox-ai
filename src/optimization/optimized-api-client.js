import { globalConnectionPool } from './connection-pool.js';
import { 
  exponentialBackoff, 
  handleErrorWithGracefulDegradation,
  logger,
  RETRY_CONFIG
} from '../error-handler.js';

/**
 * Optimized API Client with connection pooling and streaming support
 */
export class OptimizedAPIClient {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.baseURL = options.baseURL;
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel;
    this.timeout = options.timeout || RETRY_CONFIG.TIMEOUT_MS;
    this.maxConcurrentRequests = options.maxConcurrentRequests || 5;
    
    this.activeRequests = 0;
    this.requestQueue = [];
    this.connection = null;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Initialize connection
   */
  async initialize() {
    if (!this.connection) {
      this.connection = globalConnectionPool.getConnection(this.baseURL, {
        timeout: this.timeout,
        headers: this.getDefaultHeaders()
      });
    }
  }

  /**
   * Get default headers for the provider
   */
  getDefaultHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Glassbox-CLI/1.0'
    };

    if (this.apiKey) {
      if (this.provider === 'openai') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.provider === 'anthropic') {
        headers['x-api-key'] = this.apiKey;
      }
    }

    return headers;
  }

  /**
   * Make a request with connection pooling and rate limiting
   */
  async makeRequest(prompt, options = {}) {
    await this.initialize();
    
    // Rate limiting
    if (this.activeRequests >= this.maxConcurrentRequests) {
      await this.waitForSlot();
    }

    this.activeRequests++;
    const startTime = Date.now();

    try {
      const requestConfig = this.buildRequestConfig(prompt, options);
      const response = await this.executeRequest(requestConfig);
      
      const duration = Date.now() - startTime;
      this.updateStats(duration, true);
      
      return this.parseResponse(response, options);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateStats(duration, false);
      
      const errorResult = handleErrorWithGracefulDegradation(error, {
        provider: this.provider,
        model: options.model || this.defaultModel,
        promptLength: prompt.length,
        operation: 'generate_response'
      });
      
      throw errorResult.error;
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Build request configuration based on provider
   */
  buildRequestConfig(prompt, options = {}) {
    const {
      model = this.defaultModel,
      maxTokens = 1000,
      temperature = 0.7,
      stream = false
    } = options;

    if (this.provider === 'openai') {
      return {
        method: 'POST',
        url: '/v1/chat/completions',
        data: {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
          stream
        },
        responseType: stream ? 'stream' : 'json'
      };
    } else if (this.provider === 'ollama') {
      return {
        method: 'POST',
        url: '/api/generate',
        data: {
          model,
          prompt,
          stream,
          options: {
            num_predict: maxTokens,
            temperature
          }
        },
        responseType: stream ? 'stream' : 'json'
      };
    } else if (this.provider === 'anthropic') {
      return {
        method: 'POST',
        url: '/v1/messages',
        data: {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }],
          stream
        },
        responseType: stream ? 'stream' : 'json'
      };
    }

    throw new Error(`Unsupported provider: ${this.provider}`);
  }

  /**
   * Execute request with retry logic
   */
  async executeRequest(requestConfig) {
    return await exponentialBackoff(async () => {
      return await this.connection.request(requestConfig);
    }, RETRY_CONFIG.DEFAULT_MAX_RETRIES);
  }

  /**
   * Parse response based on provider
   */
  parseResponse(response, options = {}) {
    if (options.stream) {
      return this.parseStreamResponse(response);
    }

    if (this.provider === 'openai') {
      return {
        response: response.data.choices[0].message.content,
        tokenCount: this.countTokens(response.data.choices[0].message.content),
        model: response.data.model,
        usage: response.data.usage
      };
    } else if (this.provider === 'ollama') {
      return {
        response: response.data.response,
        tokenCount: this.countTokens(response.data.response),
        model: response.data.model,
        usage: {
          prompt_tokens: this.countTokens(response.data.prompt),
          completion_tokens: this.countTokens(response.data.response),
          total_tokens: this.countTokens(response.data.prompt) + this.countTokens(response.data.response)
        }
      };
    } else if (this.provider === 'anthropic') {
      return {
        response: response.data.content[0].text,
        tokenCount: this.countTokens(response.data.content[0].text),
        model: response.data.model,
        usage: response.data.usage
      };
    }

    throw new Error(`Unsupported provider: ${this.provider}`);
  }

  /**
   * Parse streaming response
   */
  parseStreamResponse(response) {
    return new Promise((resolve, reject) => {
      let fullResponse = '';
      let tokenCount = 0;

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              resolve({
                response: fullResponse,
                tokenCount,
                streamed: true
              });
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (this.provider === 'openai' && parsed.choices?.[0]?.delta?.content) {
                fullResponse += parsed.choices[0].delta.content;
                tokenCount++;
              } else if (this.provider === 'ollama' && parsed.response) {
                fullResponse += parsed.response;
                tokenCount++;
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      });

      response.data.on('error', reject);
      response.data.on('end', () => {
        resolve({
          response: fullResponse,
          tokenCount,
          streamed: true
        });
      });
    });
  }

  /**
   * Count tokens (simple implementation)
   */
  countTokens(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Wait for available request slot
   */
  async waitForSlot() {
    return new Promise((resolve) => {
      this.requestQueue.push(resolve);
    });
  }

  /**
   * Process queued requests
   */
  processQueue() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const resolve = this.requestQueue.shift();
      resolve();
    }
  }

  /**
   * Update statistics
   */
  updateStats(duration, success) {
    this.stats.totalRequests++;
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + duration) / 
      this.stats.totalRequests;
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
  }

  /**
   * Get client statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      provider: this.provider
    };
  }

  /**
   * Batch multiple requests efficiently
   */
  async batchRequests(requests, options = {}) {
    const batchSize = options.batchSize || 5;
    const results = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => 
        this.makeRequest(request.prompt, request.options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
} 