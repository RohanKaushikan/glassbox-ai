/**
 * Fallback Manager for handling service failures
 * Provides multiple fallback mechanisms when primary services fail
 */
export class FallbackManager {
  constructor(options = {}) {
    this.fallbacks = new Map();
    this.primaryServices = new Map();
    this.fallbackStrategies = new Map();
    this.defaultStrategy = options.defaultStrategy || 'sequential';
    this.maxFallbackDepth = options.maxFallbackDepth || 3;
  }

  /**
   * Register a primary service with its fallbacks
   * @param {string} serviceName - Name of the service
   * @param {Function} primaryFn - Primary service function
   * @param {Array<Function>} fallbacks - Array of fallback functions
   * @param {object} options - Additional options
   */
  registerService(serviceName, primaryFn, fallbacks = [], options = {}) {
    this.primaryServices.set(serviceName, {
      fn: primaryFn,
      options: options
    });
    
    this.fallbacks.set(serviceName, fallbacks);
    this.fallbackStrategies.set(serviceName, options.strategy || this.defaultStrategy);
  }

  /**
   * Execute a service with fallback mechanisms
   * @param {string} serviceName - Name of the service to execute
   * @param {Array} args - Arguments to pass to the service
   * @param {object} options - Additional options
   * @returns {Promise<any>} Result from primary or fallback service
   */
  async execute(serviceName, args = [], options = {}) {
    const primaryService = this.primaryServices.get(serviceName);
    const fallbackList = this.fallbacks.get(serviceName) || [];
    const strategy = this.fallbackStrategies.get(serviceName) || this.defaultStrategy;
    
    if (!primaryService) {
      throw new Error(`Service '${serviceName}' not registered`);
    }

    const executionOptions = {
      ...primaryService.options,
      ...options
    };

    switch (strategy) {
      case 'sequential':
        return await this.executeSequential(serviceName, primaryService.fn, fallbackList, args, executionOptions);
      case 'parallel':
        return await this.executeParallel(serviceName, primaryService.fn, fallbackList, args, executionOptions);
      case 'fastest':
        return await this.executeFastest(serviceName, primaryService.fn, fallbackList, args, executionOptions);
      default:
        return await this.executeSequential(serviceName, primaryService.fn, fallbackList, args, executionOptions);
    }
  }

  /**
   * Execute services sequentially (primary first, then fallbacks)
   * @param {string} serviceName - Service name
   * @param {Function} primaryFn - Primary function
   * @param {Array<Function>} fallbacks - Fallback functions
   * @param {Array} args - Arguments
   * @param {object} options - Options
   * @returns {Promise<any>}
   */
  async executeSequential(serviceName, primaryFn, fallbacks, args, options) {
    const allServices = [primaryFn, ...fallbacks];
    let lastError = null;
    let serviceUsed = 'primary';

    for (let i = 0; i < allServices.length; i++) {
      const service = allServices[i];
      const isPrimary = i === 0;
      
      try {
        const result = await service(...args);
        
        if (!isPrimary) {
          console.warn(`Fallback used for ${serviceName}: ${serviceUsed}`);
        }
        
        return {
          result,
          serviceUsed: isPrimary ? 'primary' : `fallback_${i}`,
          fallbackUsed: !isPrimary,
          error: null
        };
      } catch (error) {
        lastError = error;
        serviceUsed = isPrimary ? 'primary' : `fallback_${i}`;
        
        console.warn(`Service ${serviceName} failed (${serviceUsed}): ${error.message}`);
        
        // Continue to next fallback
        continue;
      }
    }

    // All services failed
    throw new Error(`All services for '${serviceName}' failed. Last error: ${lastError?.message}`);
  }

  /**
   * Execute services in parallel and return the first successful result
   * @param {string} serviceName - Service name
   * @param {Function} primaryFn - Primary function
   * @param {Array<Function>} fallbacks - Fallback functions
   * @param {Array} args - Arguments
   * @param {object} options - Options
   * @returns {Promise<any>}
   */
  async executeParallel(serviceName, primaryFn, fallbacks, args, options) {
    const allServices = [primaryFn, ...fallbacks];
    const timeout = options.timeout || 30000;
    
    const promises = allServices.map(async (service, index) => {
      const isPrimary = index === 0;
      const serviceName = isPrimary ? 'primary' : `fallback_${index}`;
      
      try {
        const result = await Promise.race([
          service(...args),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
        
        return {
          result,
          serviceUsed: serviceName,
          fallbackUsed: !isPrimary,
          error: null
        };
      } catch (error) {
        return {
          result: null,
          serviceUsed: serviceName,
          fallbackUsed: !isPrimary,
          error: error
        };
      }
    });

    const results = await Promise.all(promises);
    const successfulResult = results.find(r => r.error === null);
    
    if (successfulResult) {
      if (successfulResult.fallbackUsed) {
        console.warn(`Fallback used for ${serviceName}: ${successfulResult.serviceUsed}`);
      }
      return successfulResult;
    }

    // All services failed
    const errors = results.map(r => r.error.message).join(', ');
    throw new Error(`All services for '${serviceName}' failed: ${errors}`);
  }

  /**
   * Execute services and return the fastest successful result
   * @param {string} serviceName - Service name
   * @param {Function} primaryFn - Primary function
   * @param {Array<Function>} fallbacks - Fallback functions
   * @param {Array} args - Arguments
   * @param {object} options - Options
   * @returns {Promise<any>}
   */
  async executeFastest(serviceName, primaryFn, fallbacks, args, options) {
    const allServices = [primaryFn, ...fallbacks];
    const timeout = options.timeout || 30000;
    
    const promises = allServices.map(async (service, index) => {
      const isPrimary = index === 0;
      const serviceName = isPrimary ? 'primary' : `fallback_${index}`;
      const startTime = Date.now();
      
      try {
        const result = await Promise.race([
          service(...args),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
        
        const duration = Date.now() - startTime;
        
        return {
          result,
          serviceUsed: serviceName,
          fallbackUsed: !isPrimary,
          duration,
          error: null
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        
        return {
          result: null,
          serviceUsed: serviceName,
          fallbackUsed: !isPrimary,
          duration,
          error: error
        };
      }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter(r => r.error === null);
    
    if (successfulResults.length === 0) {
      const errors = results.map(r => r.error.message).join(', ');
      throw new Error(`All services for '${serviceName}' failed: ${errors}`);
    }

    // Return the fastest successful result
    const fastestResult = successfulResults.reduce((fastest, current) => 
      current.duration < fastest.duration ? current : fastest
    );

    if (fastestResult.fallbackUsed) {
      console.warn(`Fastest fallback used for ${serviceName}: ${fastestResult.serviceUsed} (${fastestResult.duration}ms)`);
    }

    return fastestResult;
  }

  /**
   * Add a fallback to an existing service
   * @param {string} serviceName - Service name
   * @param {Function} fallbackFn - Fallback function
   */
  addFallback(serviceName, fallbackFn) {
    const fallbacks = this.fallbacks.get(serviceName) || [];
    fallbacks.push(fallbackFn);
    this.fallbacks.set(serviceName, fallbacks);
  }

  /**
   * Remove a fallback from a service
   * @param {string} serviceName - Service name
   * @param {number} index - Index of fallback to remove
   */
  removeFallback(serviceName, index) {
    const fallbacks = this.fallbacks.get(serviceName) || [];
    if (index >= 0 && index < fallbacks.length) {
      fallbacks.splice(index, 1);
      this.fallbacks.set(serviceName, fallbacks);
    }
  }

  /**
   * Get service information
   * @param {string} serviceName - Service name
   * @returns {object} Service information
   */
  getServiceInfo(serviceName) {
    const primaryService = this.primaryServices.get(serviceName);
    const fallbacks = this.fallbacks.get(serviceName) || [];
    const strategy = this.fallbackStrategies.get(serviceName) || this.defaultStrategy;
    
    return {
      name: serviceName,
      hasPrimary: !!primaryService,
      fallbackCount: fallbacks.length,
      strategy,
      options: primaryService?.options || {}
    };
  }

  /**
   * Get all registered services
   * @returns {Array<object>} Array of service information
   */
  getAllServices() {
    const services = [];
    for (const [name] of this.primaryServices) {
      services.push(this.getServiceInfo(name));
    }
    return services;
  }

  /**
   * Clear all services and fallbacks
   */
  clear() {
    this.primaryServices.clear();
    this.fallbacks.clear();
    this.fallbackStrategies.clear();
  }
} 