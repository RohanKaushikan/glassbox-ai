/**
 * Request Queue with throttling capabilities
 * Manages request flow and prevents system overload
 */
export class RequestQueue {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 10;
    this.maxQueueSize = options.maxQueueSize || 100;
    this.throttleRate = options.throttleRate || 100; // requests per second
    this.timeout = options.timeout || 30000; // 30 seconds
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
    
    this.queue = [];
    this.running = new Set();
    this.processed = 0;
    this.failed = 0;
    this.startTime = Date.now();
    this.lastRequestTime = 0;
    this.isProcessing = false;
    
    // Throttling
    this.requestCount = 0;
    this.windowStart = Date.now();
    this.windowSize = 1000; // 1 second window
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Request function to execute
   * @param {object} options - Request options
   * @returns {Promise<any>} Request result
   */
  async add(requestFn, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        id: this.generateId(),
        fn: requestFn,
        options: {
          timeout: this.timeout,
          retryAttempts: this.retryAttempts,
          retryDelay: this.retryDelay,
          priority: 0,
          ...options
        },
        resolve,
        reject,
        timestamp: Date.now(),
        attempts: 0
      };

      // Check queue size limit
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Queue is full'));
        return;
      }

      // Add to queue with priority
      this.insertWithPriority(request);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.process();
      }
    });
  }

  /**
   * Insert request with priority
   * @param {object} request - Request object
   */
  insertWithPriority(request) {
    const index = this.queue.findIndex(item => item.options.priority < request.options.priority);
    if (index === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(index, 0, request);
    }
  }

  /**
   * Process the queue
   */
  async process() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.running.size < this.maxConcurrency) {
      const request = this.queue.shift();
      
      if (request) {
        this.running.add(request.id);
        this.executeRequest(request);
      }
    }
    
    this.isProcessing = false;
  }

  /**
   * Execute a single request
   * @param {object} request - Request object
   */
  async executeRequest(request) {
    try {
      // Apply throttling
      await this.applyThrottling();
      
      // Execute with retries
      const result = await this.executeWithRetries(request);
      
      this.processed++;
      request.resolve(result);
      
    } catch (error) {
      this.failed++;
      request.reject(error);
      
    } finally {
      this.running.delete(request.id);
      
      // Continue processing if there are more items
      if (this.queue.length > 0) {
        this.process();
      }
    }
  }

  /**
   * Execute request with retries
   * @param {object} request - Request object
   * @returns {Promise<any>} Request result
   */
  async executeWithRetries(request) {
    let lastError;
    
    for (let attempt = 1; attempt <= request.options.retryAttempts; attempt++) {
      try {
        request.attempts = attempt;
        
        return await Promise.race([
          request.fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), request.options.timeout)
          )
        ]);
        
      } catch (error) {
        lastError = error;
        
        if (attempt === request.options.retryAttempts) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, request.options.retryDelay));
      }
    }
    
    throw lastError;
  }

  /**
   * Apply throttling based on rate limit
   */
  async applyThrottling() {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.windowStart >= this.windowSize) {
      this.requestCount = 0;
      this.windowStart = now;
    }
    
    // Check if we need to throttle
    if (this.requestCount >= this.throttleRate) {
      const waitTime = this.windowSize - (now - this.windowStart);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.windowStart = Date.now();
        this.requestCount = 0;
      }
    }
    
    this.requestCount++;
    this.lastRequestTime = now;
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue status
   * @returns {object} Queue status
   */
  getStatus() {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    return {
      queueLength: this.queue.length,
      running: this.running.size,
      maxConcurrency: this.maxConcurrency,
      maxQueueSize: this.maxQueueSize,
      processed: this.processed,
      failed: this.failed,
      successRate: this.processed > 0 ? 
        ((this.processed - this.failed) / this.processed) * 100 : 0,
      uptime,
      requestsPerSecond: uptime > 0 ? (this.processed / (uptime / 1000)) : 0,
      averageQueueTime: this.getAverageQueueTime(),
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get average queue time
   * @returns {number} Average queue time in milliseconds
   */
  getAverageQueueTime() {
    if (this.queue.length === 0) return 0;
    
    const now = Date.now();
    const totalWaitTime = this.queue.reduce((sum, request) => 
      sum + (now - request.timestamp), 0);
    
    return totalWaitTime / this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear() {
    // Reject all pending requests
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    
    this.queue = [];
    this.running.clear();
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.isProcessing = false;
  }

  /**
   * Resume queue processing
   */
  resume() {
    if (!this.isProcessing && this.queue.length > 0) {
      this.process();
    }
  }

  /**
   * Get queue metrics
   * @returns {object} Queue metrics
   */
  getMetrics() {
    const status = this.getStatus();
    const now = Date.now();
    
    return {
      ...status,
      queueUtilization: (this.queue.length / this.maxQueueSize) * 100,
      concurrencyUtilization: (this.running.size / this.maxConcurrency) * 100,
      throttleUtilization: (this.requestCount / this.throttleRate) * 100,
      lastRequestAge: now - this.lastRequestTime,
      estimatedWaitTime: this.estimateWaitTime()
    };
  }

  /**
   * Estimate wait time for new requests
   * @returns {number} Estimated wait time in milliseconds
   */
  estimateWaitTime() {
    if (this.queue.length === 0 && this.running.size < this.maxConcurrency) {
      return 0;
    }
    
    const queuePosition = this.queue.length;
    const concurrencyWait = Math.ceil(queuePosition / this.maxConcurrency) * 5000; // 5s per batch
    const throttleWait = (this.requestCount / this.throttleRate) * 1000; // 1s per request
    
    return Math.max(concurrencyWait, throttleWait);
  }

  /**
   * Set throttling rate
   * @param {number} rate - Requests per second
   */
  setThrottleRate(rate) {
    this.throttleRate = rate;
  }

  /**
   * Set max concurrency
   * @param {number} concurrency - Maximum concurrent requests
   */
  setMaxConcurrency(concurrency) {
    this.maxConcurrency = concurrency;
  }

  /**
   * Set max queue size
   * @param {number} size - Maximum queue size
   */
  setMaxQueueSize(size) {
    this.maxQueueSize = size;
  }
} 