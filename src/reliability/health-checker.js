/**
 * Health Checker for service monitoring
 * Provides health checks and service monitoring capabilities
 */
export class HealthChecker {
  constructor(options = {}) {
    this.checks = new Map();
    this.healthStatus = new Map();
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.timeout = options.timeout || 10000; // 10 seconds
    this.retries = options.retries || 2;
    this.intervalId = null;
    this.isRunning = false;
    this.onHealthChange = options.onHealthChange || this.defaultOnHealthChange;
  }

  /**
   * Register a health check
   * @param {string} checkName - Name of the health check
   * @param {Function} checkFn - Health check function
   * @param {object} options - Health check options
   */
  registerCheck(checkName, checkFn, options = {}) {
    this.checks.set(checkName, {
      fn: checkFn,
      options: {
        timeout: this.timeout,
        retries: this.retries,
        critical: false,
        ...options
      }
    });
    
    // Initialize health status
    this.healthStatus.set(checkName, {
      status: 'unknown',
      lastCheck: null,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalChecks: 0,
      totalFailures: 0,
      averageResponseTime: 0
    });
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isRunning) {
      console.warn('Health checker is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting health monitoring...');
    
    // Run initial checks
    this.runAllChecks();
    
    // Set up interval for periodic checks
    this.intervalId = setInterval(() => {
      this.runAllChecks();
    }, this.checkInterval);
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.isRunning) {
      console.warn('Health checker is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('Health monitoring stopped');
  }

  /**
   * Run all registered health checks
   */
  async runAllChecks() {
    const checkPromises = [];
    
    for (const [checkName, check] of this.checks) {
      checkPromises.push(this.runCheck(checkName, check));
    }
    
    await Promise.allSettled(checkPromises);
  }

  /**
   * Run a specific health check
   * @param {string} checkName - Name of the health check
   * @param {object} check - Health check configuration
   */
  async runCheck(checkName, check) {
    const status = this.healthStatus.get(checkName);
    const startTime = Date.now();
    
    try {
      // Run health check with timeout and retries
      const result = await this.executeWithRetries(check.fn, check.options);
      
      const responseTime = Date.now() - startTime;
      const newStatus = 'healthy';
      
      // Update status
      status.status = newStatus;
      status.lastCheck = Date.now();
      status.lastSuccess = Date.now();
      status.consecutiveSuccesses++;
      status.consecutiveFailures = 0;
      status.totalChecks++;
      status.averageResponseTime = this.calculateAverageResponseTime(
        status.averageResponseTime, 
        responseTime, 
        status.totalChecks
      );
      
      this.healthStatus.set(checkName, status);
      
      // Notify if status changed
      if (status.status !== newStatus) {
        this.onHealthChange(checkName, newStatus, status.status, result);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const newStatus = 'unhealthy';
      
      // Update status
      status.status = newStatus;
      status.lastCheck = Date.now();
      status.lastFailure = Date.now();
      status.consecutiveFailures++;
      status.consecutiveSuccesses = 0;
      status.totalChecks++;
      status.totalFailures++;
      status.averageResponseTime = this.calculateAverageResponseTime(
        status.averageResponseTime, 
        responseTime, 
        status.totalChecks
      );
      
      this.healthStatus.set(checkName, status);
      
      // Notify if status changed
      if (status.status !== newStatus) {
        this.onHealthChange(checkName, newStatus, status.status, error);
      }
      
      // Log critical failures
      if (check.options.critical) {
        console.error(`Critical health check failed: ${checkName}`, error);
      }
    }
  }

  /**
   * Execute health check with retries
   * @param {Function} fn - Health check function
   * @param {object} options - Options
   * @returns {Promise<any>} Health check result
   */
  async executeWithRetries(fn, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= options.retries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), options.timeout)
          )
        ]);
      } catch (error) {
        lastError = error;
        
        if (attempt === options.retries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate average response time
   * @param {number} currentAverage - Current average
   * @param {number} newValue - New value
   * @param {number} totalCount - Total count
   * @returns {number} New average
   */
  calculateAverageResponseTime(currentAverage, newValue, totalCount) {
    return (currentAverage * (totalCount - 1) + newValue) / totalCount;
  }

  /**
   * Get health status for a specific check
   * @param {string} checkName - Name of the health check
   * @returns {object} Health status
   */
  getCheckStatus(checkName) {
    return this.healthStatus.get(checkName) || null;
  }

  /**
   * Get overall health status
   * @returns {object} Overall health status
   */
  getOverallHealth() {
    const checks = Array.from(this.healthStatus.values());
    const healthyChecks = checks.filter(check => check.status === 'healthy');
    const unhealthyChecks = checks.filter(check => check.status === 'unhealthy');
    const unknownChecks = checks.filter(check => check.status === 'unknown');
    
    const criticalChecks = Array.from(this.checks.entries())
      .filter(([name, check]) => check.options.critical)
      .map(([name]) => name);
    
    const criticalFailures = criticalChecks.filter(checkName => {
      const status = this.healthStatus.get(checkName);
      return status && status.status === 'unhealthy';
    });
    
    return {
      overall: criticalFailures.length > 0 ? 'unhealthy' : 
               unhealthyChecks.length > 0 ? 'degraded' : 'healthy',
      total: checks.length,
      healthy: healthyChecks.length,
      unhealthy: unhealthyChecks.length,
      unknown: unknownChecks.length,
      criticalFailures: criticalFailures.length,
      lastUpdate: new Date().toISOString(),
      checks: Object.fromEntries(this.healthStatus)
    };
  }

  /**
   * Get health metrics
   * @returns {object} Health metrics
   */
  getMetrics() {
    const checks = Array.from(this.healthStatus.values());
    const now = Date.now();
    
    return {
      uptime: this.isRunning ? now - (this.startTime || now) : 0,
      totalChecks: checks.reduce((sum, check) => sum + check.totalChecks, 0),
      totalFailures: checks.reduce((sum, check) => sum + check.totalFailures, 0),
      failureRate: checks.reduce((sum, check) => sum + check.totalChecks, 0) > 0 ?
        checks.reduce((sum, check) => sum + check.totalFailures, 0) / 
        checks.reduce((sum, check) => sum + check.totalChecks, 0) : 0,
      averageResponseTime: checks.length > 0 ?
        checks.reduce((sum, check) => sum + check.averageResponseTime, 0) / checks.length : 0,
      checksWithFailures: checks.filter(check => check.totalFailures > 0).length,
      checksWithRecentFailures: checks.filter(check => 
        check.lastFailure && (now - check.lastFailure) < 300000 // 5 minutes
      ).length
    };
  }

  /**
   * Default health change callback
   * @param {string} checkName - Name of the health check
   * @param {string} newStatus - New status
   * @param {string} oldStatus - Old status
   * @param {any} result - Check result or error
   */
  defaultOnHealthChange(checkName, newStatus, oldStatus, result) {
    const timestamp = new Date().toISOString();
    const message = newStatus === 'healthy' ? 
      `Health check '${checkName}' is now healthy` :
      `Health check '${checkName}' is now unhealthy: ${result?.message || 'Unknown error'}`;
    
    console.log(`[${timestamp}] ${message}`);
  }

  /**
   * Remove a health check
   * @param {string} checkName - Name of the health check to remove
   */
  removeCheck(checkName) {
    this.checks.delete(checkName);
    this.healthStatus.delete(checkName);
  }

  /**
   * Clear all health checks
   */
  clear() {
    this.checks.clear();
    this.healthStatus.clear();
  }
} 