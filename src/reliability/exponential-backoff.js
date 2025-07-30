/**
 * Exponential backoff with jitter for retry mechanisms
 * Implements exponential backoff with jitter to prevent thundering herd problems
 */
export class ExponentialBackoff {
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.maxAttempts = options.maxAttempts || 5;
    this.jitterFactor = options.jitterFactor || 0.1; // 10% jitter
    this.backoffMultiplier = options.backoffMultiplier || 2;
  }

  /**
   * Calculate delay for a specific attempt
   * @param {number} attempt - Current attempt number (1-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    if (attempt <= 0) return 0;
    
    // Exponential backoff: baseDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.jitterFactor * Math.random();
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Execute a function with exponential backoff retry
   * @param {Function} fn - Function to execute
   * @param {object} options - Additional options
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn, options = {}) {
    const maxAttempts = options.maxAttempts || this.maxAttempts;
    const shouldRetry = options.shouldRetry || this.defaultShouldRetry;
    const onRetry = options.onRetry || this.defaultOnRetry;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this error
        if (!shouldRetry(error, attempt)) {
          throw error;
        }
        
        // If this is the last attempt, throw the error
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Calculate delay for this attempt
        const delay = this.calculateDelay(attempt);
        
        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(error, attempt, delay);
        }
        
        // Wait before retrying
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Default retry condition - retry on network errors and rate limits
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number
   * @returns {boolean} Whether to retry
   */
  defaultShouldRetry(error, attempt) {
    // Don't retry on the last attempt
    if (attempt >= this.maxAttempts) return false;
    
    // Retry on network errors
    if (this.isNetworkError(error)) return true;
    
    // Retry on rate limits (with exponential backoff)
    if (this.isRateLimitError(error)) return true;
    
    // Retry on temporary server errors (5xx)
    if (this.isServerError(error)) return true;
    
    // Don't retry on client errors (4xx) except rate limits
    if (this.isClientError(error)) return false;
    
    // Retry on unknown errors (conservative approach)
    return true;
  }

  /**
   * Default retry callback for logging
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number
   * @param {number} delay - Delay before next attempt
   */
  defaultOnRetry(error, attempt, delay) {
    console.warn(`Retry attempt ${attempt}: ${error.message} (waiting ${delay}ms)`);
  }

  /**
   * Check if error is network-related
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isNetworkError(error) {
    const networkErrors = [
      'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
      'ENETUNREACH', 'EHOSTUNREACH', 'ENOBUFS'
    ];
    
    return networkErrors.some(code => 
      error.code === code || 
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection')
    );
  }

  /**
   * Check if error is rate limit related
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isRateLimitError(error) {
    return error.status === 429 || 
           error.message.toLowerCase().includes('rate limit') ||
           error.message.toLowerCase().includes('too many requests');
  }

  /**
   * Check if error is server error (5xx)
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isServerError(error) {
    return error.status >= 500 && error.status < 600;
  }

  /**
   * Check if error is client error (4xx)
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isClientError(error) {
    return error.status >= 400 && error.status < 500;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 