/**
 * Reliability Manager - Main orchestrator for enterprise-grade reliability
 * Integrates all reliability features into a unified system
 */
import { ExponentialBackoff } from './exponential-backoff.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { FallbackManager } from './fallback-manager.js';
import { HealthChecker } from './health-checker.js';
import { MetricsCollector } from './metrics-collector.js';
import { RequestQueue } from './request-queue.js';
import { GracefulShutdown } from './graceful-shutdown.js';

export class ReliabilityManager {
  constructor(options = {}) {
    // Initialize all reliability components
    this.exponentialBackoff = new ExponentialBackoff(options.backoff || {});
    this.circuitBreakers = new Map();
    this.fallbackManager = new FallbackManager(options.fallback || {});
    this.healthChecker = new HealthChecker(options.health || {});
    this.metrics = new MetricsCollector(options.metrics || {});
    this.requestQueue = new RequestQueue(options.queue || {});
    this.gracefulShutdown = new GracefulShutdown(options.shutdown || {});
    
    // Configuration
    this.enabled = options.enabled !== false;
    this.autoStart = options.autoStart !== false;
    
    // Service registry
    this.services = new Map();
    this.serviceConfigs = new Map();
    
    // Auto-start if enabled
    if (this.autoStart) {
      this.start();
    }
  }

  /**
   * Start all reliability components
   */
  start() {
    if (!this.enabled) return;
    
    console.log('Starting enterprise reliability system...');
    
    // Start health monitoring
    this.healthChecker.start();
    
    // Start metrics collection
    this.metrics.startExport();
    
    // Register shutdown hooks
    this.setupShutdownHooks();
    
    console.log('Enterprise reliability system started');
  }

  /**
   * Stop all reliability components
   */
  stop() {
    console.log('Stopping enterprise reliability system...');
    
    this.healthChecker.stop();
    this.metrics.stopExport();
    this.requestQueue.clear();
    
    console.log('Enterprise reliability system stopped');
  }

  /**
   * Register a service with reliability features
   * @param {string} serviceName - Service name
   * @param {Function} primaryFn - Primary service function
   * @param {Array<Function>} fallbacks - Fallback functions
   * @param {object} options - Service options
   */
  registerService(serviceName, primaryFn, fallbacks = [], options = {}) {
    const config = {
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        ...options.circuitBreaker
      },
      backoff: {
        maxAttempts: 3,
        baseDelay: 1000,
        ...options.backoff
      },
      health: {
        checkInterval: 30000,
        timeout: 10000,
        ...options.health
      },
      queue: {
        priority: 0,
        timeout: 30000,
        ...options.queue
      },
      metrics: {
        enabled: true,
        ...options.metrics
      },
      ...options
    };

    // Create circuit breaker for this service
    const circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.circuitBreakers.set(serviceName, circuitBreaker);

    // Register with fallback manager
    this.fallbackManager.registerService(serviceName, primaryFn, fallbacks, {
      strategy: config.fallbackStrategy || 'sequential',
      timeout: config.queue.timeout
    });

    // Register health check
    this.healthChecker.registerCheck(`${serviceName}_health`, async () => {
      try {
        await this.executeWithReliability(serviceName, () => Promise.resolve('healthy'));
        return { status: 'healthy' };
      } catch (error) {
        throw new Error(`Service health check failed: ${error.message}`);
      }
    }, {
      timeout: config.health.timeout,
      critical: config.health.critical || false
    });

    // Store service configuration
    this.serviceConfigs.set(serviceName, config);
    this.services.set(serviceName, primaryFn);

    console.log(`Registered service '${serviceName}' with reliability features`);
  }

  /**
   * Execute a service with all reliability features
   * @param {string} serviceName - Service name
   * @param {Array} args - Service arguments
   * @param {object} options - Execution options
   * @returns {Promise<any>} Service result
   */
  async executeWithReliability(serviceName, args = [], options = {}) {
    if (!this.enabled) {
      // Execute without reliability features
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service '${serviceName}' not registered`);
      }
      return await service(...args);
    }

    const config = this.serviceConfigs.get(serviceName);
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!config || !circuitBreaker) {
      throw new Error(`Service '${serviceName}' not registered with reliability features`);
    }

    // Create the execution function with all reliability layers
    const executeFn = async () => {
      return await this.metrics.timeAsync(`${serviceName}_execution`, async () => {
        // Execute with circuit breaker
        return await circuitBreaker.execute(async () => {
          // Execute with fallback manager
          const result = await this.fallbackManager.execute(serviceName, args, options);
          return result.result;
        }, {
          fallback: (error) => {
            this.metrics.increment(`${serviceName}_circuit_breaker_failures`);
            throw error;
          }
        });
      }, { service: serviceName });
    };

    // Add to request queue if enabled
    if (config.queue.enabled !== false) {
      return await this.requestQueue.add(executeFn, {
        priority: config.queue.priority,
        timeout: config.queue.timeout
      });
    } else {
      return await executeFn();
    }
  }

  /**
   * Execute with exponential backoff retry
   * @param {string} serviceName - Service name
   * @param {Array} args - Service arguments
   * @param {object} options - Retry options
   * @returns {Promise<any>} Service result
   */
  async executeWithRetry(serviceName, args = [], options = {}) {
    const config = this.serviceConfigs.get(serviceName);
    const backoffConfig = { ...this.exponentialBackoff, ...config?.backoff, ...options };

    return await this.exponentialBackoff.execute(async () => {
      return await this.executeWithReliability(serviceName, args, options);
    }, backoffConfig);
  }

  /**
   * Get service health status
   * @param {string} serviceName - Service name
   * @returns {object} Health status
   */
  getServiceHealth(serviceName) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    const healthStatus = this.healthChecker.getCheckStatus(`${serviceName}_health`);
    const serviceInfo = this.fallbackManager.getServiceInfo(serviceName);

    return {
      serviceName,
      circuitBreaker: circuitBreaker ? circuitBreaker.getState() : null,
      health: healthStatus,
      fallback: serviceInfo,
      metrics: this.getServiceMetrics(serviceName)
    };
  }

  /**
   * Get service metrics
   * @param {string} serviceName - Service name
   * @returns {object} Service metrics
   */
  getServiceMetrics(serviceName) {
    const metrics = this.metrics.getAllMetrics();
    const serviceMetrics = {};

    // Filter metrics for this service
    for (const [key, value] of Object.entries(metrics.histograms)) {
      if (key.includes(serviceName)) {
        serviceMetrics[key] = value;
      }
    }

    for (const [key, value] of Object.entries(metrics.counters)) {
      if (key.includes(serviceName)) {
        serviceMetrics[key] = value;
      }
    }

    return serviceMetrics;
  }

  /**
   * Get overall system health
   * @returns {object} System health status
   */
  getSystemHealth() {
    return {
      overall: this.healthChecker.getOverallHealth(),
      services: Array.from(this.services.keys()).map(name => this.getServiceHealth(name)),
      queue: this.requestQueue.getStatus(),
      metrics: this.metrics.getSummary(),
      shutdown: this.gracefulShutdown.getStatus()
    };
  }

  /**
   * Get comprehensive system metrics
   * @returns {object} System metrics
   */
  getSystemMetrics() {
    return {
      metrics: this.metrics.getAllMetrics(),
      performance: this.metrics.getPerformanceMetrics(),
      queue: this.requestQueue.getMetrics(),
      health: this.healthChecker.getMetrics(),
      services: Array.from(this.services.keys()).reduce((acc, name) => {
        acc[name] = this.getServiceMetrics(name);
        return acc;
      }, {})
    };
  }

  /**
   * Setup shutdown hooks for cleanup
   */
  setupShutdownHooks() {
    // Register cleanup tasks
    this.gracefulShutdown.registerCleanupTask('stop_health_checker', () => {
      this.healthChecker.stop();
    }, { priority: 1 });

    this.gracefulShutdown.registerCleanupTask('stop_metrics', () => {
      this.metrics.stopExport();
    }, { priority: 2 });

    this.gracefulShutdown.registerCleanupTask('clear_queue', () => {
      this.requestQueue.clear();
    }, { priority: 3 });

    // Register shutdown hooks
    this.gracefulShutdown.registerShutdownHook(async () => {
      console.log('Exporting final metrics...');
      this.metrics.exportMetrics();
    }, { priority: 1 });

    this.gracefulShutdown.registerShutdownHook(async () => {
      console.log('Generating final health report...');
      const health = this.getSystemHealth();
      console.log('Final system health:', JSON.stringify(health, null, 2));
    }, { priority: 2 });
  }

  /**
   * Test reliability features
   * @param {string} serviceName - Service to test
   * @returns {Promise<object>} Test results
   */
  async testReliability(serviceName) {
    const results = {
      serviceName,
      circuitBreaker: null,
      health: null,
      fallback: null,
      metrics: null,
      queue: null,
      success: true
    };

    try {
      // Test circuit breaker
      const circuitBreaker = this.circuitBreakers.get(serviceName);
      if (circuitBreaker) {
        results.circuitBreaker = circuitBreaker.getState();
      }

      // Test health check
      const healthStatus = this.healthChecker.getCheckStatus(`${serviceName}_health`);
      results.health = healthStatus;

      // Test fallback
      const fallbackInfo = this.fallbackManager.getServiceInfo(serviceName);
      results.fallback = fallbackInfo;

      // Test metrics
      results.metrics = this.getServiceMetrics(serviceName);

      // Test queue
      results.queue = this.requestQueue.getStatus();

    } catch (error) {
      results.success = false;
      results.error = error.message;
    }

    return results;
  }

  /**
   * Enable reliability features
   */
  enable() {
    this.enabled = true;
    console.log('Reliability features enabled');
  }

  /**
   * Disable reliability features
   */
  disable() {
    this.enabled = false;
    console.log('Reliability features disabled');
  }

  /**
   * Get reliability configuration
   * @returns {object} Configuration
   */
  getConfiguration() {
    return {
      enabled: this.enabled,
      autoStart: this.autoStart,
      services: Array.from(this.serviceConfigs.keys()),
      serviceConfigs: Object.fromEntries(this.serviceConfigs),
      components: {
        exponentialBackoff: this.exponentialBackoff,
        circuitBreakers: this.circuitBreakers.size,
        fallbackManager: this.fallbackManager.getAllServices(),
        healthChecker: this.healthChecker.getOverallHealth(),
        metrics: this.metrics.getSummary(),
        requestQueue: this.requestQueue.getStatus(),
        gracefulShutdown: this.gracefulShutdown.getStatus()
      }
    };
  }
} 