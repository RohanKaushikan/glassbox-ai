import { CacheManager } from './cache-manager.js';

/**
 * Cache integration wrapper for AI clients
 * Automatically handles caching of AI responses
 */
export class CachedAIClient {
  constructor(aiClient, cacheOptions = {}) {
    this.aiClient = aiClient;
    this.cache = new CacheManager(cacheOptions);
    this.initialized = false;
  }

  /**
   * Initialize the cache
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
    }
  }

  /**
   * Generate cache parameters from request
   */
  generateCacheParams(request) {
    const params = {};
    
    // Include relevant parameters that affect the response
    if (request.temperature !== undefined) params.temperature = request.temperature;
    if (request.max_tokens !== undefined) params.max_tokens = request.max_tokens;
    if (request.top_p !== undefined) params.top_p = request.top_p;
    if (request.frequency_penalty !== undefined) params.frequency_penalty = request.frequency_penalty;
    if (request.presence_penalty !== undefined) params.presence_penalty = request.presence_penalty;
    if (request.stop !== undefined) params.stop = request.stop;
    if (request.system_prompt !== undefined) params.system_prompt = request.system_prompt;
    
    return params;
  }

  /**
   * Generate TTL based on request parameters
   */
  generateTTL(request) {
    // Shorter TTL for creative/temperature > 0.7
    if (request.temperature && request.temperature > 0.7) {
      return 2 * 60 * 60 * 1000; // 2 hours
    }
    
    // Longer TTL for factual responses
    if (request.temperature && request.temperature < 0.3) {
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    }
    
    // Default TTL
    return null; // Use cache manager default
  }

  /**
   * Send request with caching
   */
  async sendRequest(request) {
    await this.initialize();
    
    const prompt = request.prompt || request.messages?.map(m => m.content).join('\n') || '';
    const model = request.model || this.aiClient.defaultModel || 'unknown';
    const cacheParams = this.generateCacheParams(request);
    const ttl = this.generateTTL(request);

    // Try to get from cache first
    const cachedResponse = await this.cache.get(prompt, model, cacheParams);
    if (cachedResponse) {
      return {
        ...cachedResponse.response,
        cached: true,
        cacheKey: cachedResponse.key
      };
    }

    // If not in cache, make actual request
    const response = await this.aiClient.sendRequest(request);
    
    // Cache the response
    try {
      await this.cache.set(prompt, model, { response }, cacheParams, ttl);
    } catch (error) {
      console.warn('Failed to cache response:', error.message);
    }

    return {
      ...response,
      cached: false
    };
  }

  /**
   * Invalidate cache for specific prompt/model combination
   */
  async invalidateCache(prompt, model, additionalParams = {}) {
    await this.initialize();
    const key = this.cache.generateCacheKey(prompt, model, additionalParams);
    await this.cache.invalidate(key);
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    await this.initialize();
    await this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    await this.initialize();
    return this.cache.getStats();
  }

  /**
   * List cache entries
   */
  async listCacheEntries() {
    await this.initialize();
    return this.cache.listEntries();
  }

  /**
   * Get cache entry details
   */
  async getCacheEntryDetails(key) {
    await this.initialize();
    return this.cache.getEntryDetails(key);
  }

  /**
   * Proxy other methods to the underlying AI client
   */
  async [Symbol.asyncIterator]() {
    return this.aiClient[Symbol.asyncIterator]?.();
  }
}

// Add proxy for all other methods
const handler = {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    if (prop in target.aiClient) {
      return target.aiClient[prop];
    }
    return undefined;
  }
};

export function createCachedClient(aiClient, cacheOptions = {}) {
  const cachedClient = new CachedAIClient(aiClient, cacheOptions);
  return new Proxy(cachedClient, handler);
} 