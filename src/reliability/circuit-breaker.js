/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by temporarily stopping requests to failing services
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5; // Number of failures before opening
    this.successThreshold = options.successThreshold || 2; // Number of successes before closing
    this.timeout = options.timeout || 60000; // Time to wait before trying again (ms)
    this.monitoringPeriod = options.monitoringPeriod || 60000; // Time window for failure counting (ms)
    
    // Circuit states
    this.CLOSED = 'CLOSED';     // Normal operation
    this.OPEN = 'OPEN';         // Circuit is open, requests fail fast
    this.HALF_OPEN = 'HALF_OPEN'; // Testing if service is back
    
    this.state = this.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.failures = []; // Track recent failures for monitoring period
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {object} options - Additional options
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn, options = {}) {
    const fallback = options.fallback || this.defaultFallback;
    const onStateChange = options.onStateChange || this.defaultOnStateChange;
    
    // Check if circuit is open
    if (this.state === this.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen(onStateChange);
      } else {
        throw new CircuitBreakerError('Circuit breaker is OPEN', this.state);
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.failureCount = 0;
    this.failures = []; // Clear failure history
    
    if (this.state === this.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Handle failed execution
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failureCount++;
    
    // Track failure for monitoring period
    this.failures.push({
      timestamp: now,
      error: error.message
    });
    
    // Clean up old failures outside monitoring period
    this.failures = this.failures.filter(failure => 
      now - failure.timestamp < this.monitoringPeriod
    );
    
    // Update failure count based on monitoring period
    this.failureCount = this.failures.length;
    
    if (this.state === this.CLOSED && this.failureCount >= this.failureThreshold) {
      this.transitionToOpen();
    } else if (this.state === this.HALF_OPEN) {
      this.transitionToOpen();
    }
  }

  /**
   * Check if circuit should attempt to reset
   * @returns {boolean}
   */
  shouldAttemptReset() {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.timeout;
  }

  /**
   * Transition to OPEN state
   * @param {Function} onStateChange - State change callback
   */
  transitionToOpen(onStateChange) {
    if (this.state !== this.OPEN) {
      const previousState = this.state;
      this.state = this.OPEN;
      this.lastStateChange = Date.now();
      this.successCount = 0;
      
      if (onStateChange) {
        onStateChange(this.OPEN, previousState, {
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime
        });
      }
    }
  }

  /**
   * Transition to HALF_OPEN state
   * @param {Function} onStateChange - State change callback
   */
  transitionToHalfOpen(onStateChange) {
    if (this.state !== this.HALF_OPEN) {
      const previousState = this.state;
      this.state = this.HALF_OPEN;
      this.lastStateChange = Date.now();
      this.successCount = 0;
      
      if (onStateChange) {
        onStateChange(this.HALF_OPEN, previousState, {
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime
        });
      }
    }
  }

  /**
   * Transition to CLOSED state
   * @param {Function} onStateChange - State change callback
   */
  transitionToClosed(onStateChange) {
    if (this.state !== this.CLOSED) {
      const previousState = this.state;
      this.state = this.CLOSED;
      this.lastStateChange = Date.now();
      this.failureCount = 0;
      this.successCount = 0;
      this.failures = [];
      
      if (onStateChange) {
        onStateChange(this.CLOSED, previousState, {
          failureCount: this.failureCount,
          successCount: this.successCount
        });
      }
    }
  }

  /**
   * Default fallback function
   * @param {Error} error - The error that occurred
   * @returns {any} Fallback value
   */
  defaultFallback(error) {
    return {
      error: 'Circuit breaker is open',
      originalError: error.message,
      state: this.state
    };
  }

  /**
   * Default state change callback
   * @param {string} newState - New circuit state
   * @param {string} previousState - Previous circuit state
   * @param {object} context - Additional context
   */
  defaultOnStateChange(newState, previousState, context) {
    console.warn(`Circuit breaker state changed: ${previousState} -> ${newState}`, context);
  }

  /**
   * Get current circuit state
   * @returns {object} Circuit state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      failures: this.failures,
      isOpen: this.state === this.OPEN,
      isHalfOpen: this.state === this.HALF_OPEN,
      isClosed: this.state === this.CLOSED
    };
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  reset() {
    this.transitionToClosed();
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen() {
    this.transitionToOpen();
  }

  /**
   * Get health metrics
   * @returns {object} Health metrics
   */
  getHealthMetrics() {
    const now = Date.now();
    const uptime = now - this.lastStateChange;
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      uptime,
      failureRate: this.failures.length > 0 ? 
        this.failures.length / (this.monitoringPeriod / 1000) : 0,
      lastFailure: this.lastFailureTime ? 
        now - this.lastFailureTime : null
    };
  }
}

/**
 * Custom error for circuit breaker
 */
export class CircuitBreakerError extends Error {
  constructor(message, state) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.state = state;
  }
} 