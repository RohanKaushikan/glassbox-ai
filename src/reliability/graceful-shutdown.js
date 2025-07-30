/**
 * Graceful Shutdown Manager
 * Handles cleanup procedures and ensures proper resource cleanup
 */
export class GracefulShutdown {
  constructor(options = {}) {
    this.cleanupTasks = new Map();
    this.shutdownHooks = [];
    this.isShuttingDown = false;
    this.shutdownTimeout = options.shutdownTimeout || 30000; // 30 seconds
    this.forceKillTimeout = options.forceKillTimeout || 5000; // 5 seconds
    this.onShutdown = options.onShutdown || this.defaultOnShutdown;
    this.onForceKill = options.onForceKill || this.defaultOnForceKill;
    
    // Bind to process signals
    this.setupSignalHandlers();
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    for (const signal of signals) {
      process.on(signal, () => {
        console.log(`Received ${signal}, initiating graceful shutdown...`);
        this.shutdown(signal);
      });
    }
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.shutdown('uncaughtException', error);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown('unhandledRejection', reason);
    });
  }

  /**
   * Register a cleanup task
   * @param {string} name - Task name
   * @param {Function} task - Cleanup function
   * @param {object} options - Task options
   */
  registerCleanupTask(name, task, options = {}) {
    this.cleanupTasks.set(name, {
      task,
      options: {
        timeout: 5000,
        critical: false,
        priority: 0,
        ...options
      }
    });
  }

  /**
   * Register a shutdown hook
   * @param {Function} hook - Shutdown hook function
   * @param {object} options - Hook options
   */
  registerShutdownHook(hook, options = {}) {
    this.shutdownHooks.push({
      hook,
      options: {
        timeout: 5000,
        critical: false,
        priority: 0,
        ...options
      }
    });
  }

  /**
   * Remove a cleanup task
   * @param {string} name - Task name
   */
  removeCleanupTask(name) {
    this.cleanupTasks.delete(name);
  }

  /**
   * Remove a shutdown hook
   * @param {Function} hook - Hook function to remove
   */
  removeShutdownHook(hook) {
    const index = this.shutdownHooks.findIndex(h => h.hook === hook);
    if (index !== -1) {
      this.shutdownHooks.splice(index, 1);
    }
  }

  /**
   * Initiate graceful shutdown
   * @param {string} signal - Signal that triggered shutdown
   * @param {any} error - Optional error that caused shutdown
   */
  async shutdown(signal, error = null) {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();
    
    console.log('Starting graceful shutdown...');
    
    try {
      // Call shutdown hooks first
      await this.executeShutdownHooks();
      
      // Execute cleanup tasks
      await this.executeCleanupTasks();
      
      const duration = Date.now() - startTime;
      console.log(`Graceful shutdown completed in ${duration}ms`);
      
      // Call final shutdown callback
      this.onShutdown(signal, error, duration);
      
      // Exit process
      process.exit(0);
      
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
      
      const duration = Date.now() - startTime;
      this.onForceKill(signal, error, shutdownError, duration);
      
      // Force exit after timeout
      setTimeout(() => {
        console.error('Force killing process...');
        process.exit(1);
      }, this.forceKillTimeout);
    }
  }

  /**
   * Execute shutdown hooks
   */
  async executeShutdownHooks() {
    console.log('Executing shutdown hooks...');
    
    // Sort hooks by priority (higher priority first)
    const sortedHooks = this.shutdownHooks.sort((a, b) => b.options.priority - a.options.priority);
    
    const hookPromises = sortedHooks.map(async (hookInfo) => {
      const { hook, options } = hookInfo;
      
      try {
        await Promise.race([
          hook(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hook timeout')), options.timeout)
          )
        ]);
        
        console.log(`Shutdown hook completed successfully`);
        
      } catch (error) {
        console.error(`Shutdown hook failed:`, error);
        
        if (options.critical) {
          throw error;
        }
      }
    });
    
    await Promise.allSettled(hookPromises);
  }

  /**
   * Execute cleanup tasks
   */
  async executeCleanupTasks() {
    console.log('Executing cleanup tasks...');
    
    // Sort tasks by priority (higher priority first)
    const sortedTasks = Array.from(this.cleanupTasks.entries())
      .sort(([, a], [, b]) => b.options.priority - a.options.priority);
    
    const taskPromises = sortedTasks.map(async ([name, taskInfo]) => {
      const { task, options } = taskInfo;
      
      try {
        await Promise.race([
          task(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cleanup task timeout')), options.timeout)
          )
        ]);
        
        console.log(`Cleanup task '${name}' completed successfully`);
        
      } catch (error) {
        console.error(`Cleanup task '${name}' failed:`, error);
        
        if (options.critical) {
          throw error;
        }
      }
    });
    
    await Promise.allSettled(taskPromises);
  }

  /**
   * Default shutdown callback
   * @param {string} signal - Signal that triggered shutdown
   * @param {any} error - Optional error
   * @param {number} duration - Shutdown duration
   */
  defaultOnShutdown(signal, error, duration) {
    console.log(`Graceful shutdown completed successfully in ${duration}ms`);
    if (error) {
      console.error('Shutdown was triggered by error:', error);
    }
  }

  /**
   * Default force kill callback
   * @param {string} signal - Signal that triggered shutdown
   * @param {any} error - Original error
   * @param {Error} shutdownError - Shutdown error
   * @param {number} duration - Shutdown duration
   */
  defaultOnForceKill(signal, error, shutdownError, duration) {
    console.error(`Graceful shutdown failed after ${duration}ms:`, shutdownError);
    console.error('Original error:', error);
    console.error('Shutdown error:', shutdownError);
  }

  /**
   * Get shutdown status
   * @returns {object} Shutdown status
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      cleanupTasksCount: this.cleanupTasks.size,
      shutdownHooksCount: this.shutdownHooks.length,
      registeredTasks: Array.from(this.cleanupTasks.keys()),
      registeredHooks: this.shutdownHooks.length
    };
  }

  /**
   * Test shutdown without actually shutting down
   * @returns {Promise<object>} Test results
   */
  async testShutdown() {
    console.log('Testing shutdown procedures...');
    
    const results = {
      hooks: [],
      tasks: [],
      success: true,
      duration: 0
    };
    
    const startTime = Date.now();
    
    try {
      // Test shutdown hooks
      for (const hookInfo of this.shutdownHooks) {
        try {
          const start = Date.now();
          await hookInfo.hook();
          const duration = Date.now() - start;
          
          results.hooks.push({
            success: true,
            duration,
            error: null
          });
        } catch (error) {
          results.hooks.push({
            success: false,
            duration: 0,
            error: error.message
          });
          results.success = false;
        }
      }
      
      // Test cleanup tasks
      for (const [name, taskInfo] of this.cleanupTasks) {
        try {
          const start = Date.now();
          await taskInfo.task();
          const duration = Date.now() - start;
          
          results.tasks.push({
            name,
            success: true,
            duration,
            error: null
          });
        } catch (error) {
          results.tasks.push({
            name,
            success: false,
            duration: 0,
            error: error.message
          });
          results.success = false;
        }
      }
      
    } catch (error) {
      results.success = false;
    }
    
    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Clear all cleanup tasks and shutdown hooks
   */
  clear() {
    this.cleanupTasks.clear();
    this.shutdownHooks = [];
  }
} 