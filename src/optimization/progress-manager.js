import { EventEmitter } from 'events';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Progress Manager for long-running operations
 */
export class ProgressManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enabled = options.enabled !== false;
    this.quiet = options.quiet || false;
    this.spinners = new Map();
    this.progressBars = new Map();
    this.operations = new Map();
    
    this.stats = {
      totalOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      averageDuration: 0
    };
  }

  /**
   * Start a new operation with progress tracking
   */
  startOperation(id, description, options = {}) {
    if (!this.enabled || this.quiet) return;
    
    const operation = {
      id,
      description,
      startTime: Date.now(),
      status: 'running',
      progress: 0,
      total: options.total || 100,
      current: 0,
      spinner: null,
      progressBar: null
    };
    
    this.operations.set(id, operation);
    this.stats.totalOperations++;
    
    // Create spinner
    if (options.showSpinner !== false) {
      operation.spinner = ora({
        text: description,
        color: 'blue'
      }).start();
    }
    
    // Create progress bar
    if (options.showProgressBar) {
      operation.progressBar = this.createProgressBar(description, operation.total);
    }
    
    this.emit('operation-start', operation);
    return operation;
  }

  /**
   * Update operation progress
   */
  updateProgress(id, current, total = null) {
    if (!this.enabled || this.quiet) return;
    
    const operation = this.operations.get(id);
    if (!operation) return;
    
    operation.current = current;
    if (total !== null) {
      operation.total = total;
    }
    
    operation.progress = (current / operation.total) * 100;
    
    // Update spinner
    if (operation.spinner) {
      operation.spinner.text = `${operation.description} (${current}/${operation.total})`;
    }
    
    // Update progress bar
    if (operation.progressBar) {
      this.updateProgressBar(operation.progressBar, current, operation.total);
    }
    
    this.emit('progress-update', operation);
  }

  /**
   * Complete an operation
   */
  completeOperation(id, result = null) {
    if (!this.enabled || this.quiet) return;
    
    const operation = this.operations.get(id);
    if (!operation) return;
    
    operation.status = 'completed';
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.result = result;
    
    // Stop spinner
    if (operation.spinner) {
      operation.spinner.succeed(`${operation.description} completed`);
    }
    
    // Complete progress bar
    if (operation.progressBar) {
      this.completeProgressBar(operation.progressBar);
    }
    
    this.stats.completedOperations++;
    this.updateAverageDuration(operation.duration);
    
    this.emit('operation-complete', operation);
    this.operations.delete(id);
  }

  /**
   * Fail an operation
   */
  failOperation(id, error = null) {
    if (!this.enabled || this.quiet) return;
    
    const operation = this.operations.get(id);
    if (!operation) return;
    
    operation.status = 'failed';
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.error = error;
    
    // Stop spinner
    if (operation.spinner) {
      operation.spinner.fail(`${operation.description} failed`);
    }
    
    // Complete progress bar
    if (operation.progressBar) {
      this.failProgressBar(operation.progressBar);
    }
    
    this.stats.failedOperations++;
    this.updateAverageDuration(operation.duration);
    
    this.emit('operation-fail', operation);
    this.operations.delete(id);
  }

  /**
   * Create a progress bar
   */
  createProgressBar(description, total) {
    const progressBar = {
      description,
      total,
      current: 0,
      width: 50,
      startTime: Date.now()
    };
    
    this.progressBars.set(description, progressBar);
    return progressBar;
  }

  /**
   * Update progress bar
   */
  updateProgressBar(progressBar, current, total) {
    progressBar.current = current;
    progressBar.total = total;
    
    const percentage = (current / total) * 100;
    const filledWidth = Math.round((progressBar.width * current) / total);
    const bar = '█'.repeat(filledWidth) + '░'.repeat(progressBar.width - filledWidth);
    
    const elapsed = Date.now() - progressBar.startTime;
    const rate = current / (elapsed / 1000);
    const eta = rate > 0 ? Math.round((total - current) / rate) : 0;
    
    process.stdout.write(`\r${chalk.blue(progressBar.description)}: [${bar}] ${percentage.toFixed(1)}% (${current}/${total}) ETA: ${this.formatTime(eta)}`);
  }

  /**
   * Complete progress bar
   */
  completeProgressBar(progressBar) {
    const bar = '█'.repeat(progressBar.width);
    const duration = Date.now() - progressBar.startTime;
    
    process.stdout.write(`\r${chalk.green(progressBar.description)}: [${bar}] 100% (${progressBar.total}/${progressBar.total}) completed in ${this.formatTime(duration)}\n`);
  }

  /**
   * Fail progress bar
   */
  failProgressBar(progressBar) {
    const bar = '█'.repeat(Math.round((progressBar.width * progressBar.current) / progressBar.total)) + '░'.repeat(progressBar.width - Math.round((progressBar.width * progressBar.current) / progressBar.total));
    
    process.stdout.write(`\r${chalk.red(progressBar.description)}: [${bar}] failed\n`);
  }

  /**
   * Format time in human readable format
   */
  formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  /**
   * Update average duration
   */
  updateAverageDuration(duration) {
    this.stats.averageDuration = 
      (this.stats.averageDuration * (this.stats.completedOperations + this.stats.failedOperations - 1) + duration) / 
      (this.stats.completedOperations + this.stats.failedOperations);
  }

  /**
   * Start batch operation
   */
  startBatchOperation(id, description, total, options = {}) {
    const operation = this.startOperation(id, description, {
      ...options,
      showProgressBar: true,
      total
    });
    
    return {
      update: (current) => this.updateProgress(id, current, total),
      complete: (result) => this.completeOperation(id, result),
      fail: (error) => this.failOperation(id, error)
    };
  }

  /**
   * Start streaming operation
   */
  startStreamingOperation(id, description, options = {}) {
    const operation = this.startOperation(id, description, {
      ...options,
      showSpinner: true,
      showProgressBar: false
    });
    
    return {
      update: (message) => {
        if (operation.spinner) {
          operation.spinner.text = `${description}: ${message}`;
        }
      },
      complete: (result) => this.completeOperation(id, result),
      fail: (error) => this.failOperation(id, error)
    };
  }

  /**
   * Create multi-step progress
   */
  createMultiStepProgress(steps) {
    const progress = {
      currentStep: 0,
      steps: steps.map((step, index) => ({
        ...step,
        index,
        status: 'pending'
      })),
      startTime: Date.now()
    };
    
    return {
      next: () => {
        if (progress.currentStep < progress.steps.length) {
          const step = progress.steps[progress.currentStep];
          step.status = 'running';
          step.startTime = Date.now();
          
          if (step.spinner) {
            step.spinner = ora({
              text: step.description,
              color: 'blue'
            }).start();
          }
          
          progress.currentStep++;
          return step;
        }
        return null;
      },
      
      complete: (result) => {
        const step = progress.steps[progress.currentStep - 1];
        if (step) {
          step.status = 'completed';
          step.endTime = Date.now();
          step.duration = step.endTime - step.startTime;
          step.result = result;
          
          if (step.spinner) {
            step.spinner.succeed(`${step.description} completed`);
          }
        }
      },
      
      fail: (error) => {
        const step = progress.steps[progress.currentStep - 1];
        if (step) {
          step.status = 'failed';
          step.endTime = Date.now();
          step.duration = step.endTime - step.startTime;
          step.error = error;
          
          if (step.spinner) {
            step.spinner.fail(`${step.description} failed`);
          }
        }
      },
      
      getStats: () => ({
        currentStep: progress.currentStep,
        totalSteps: progress.steps.length,
        completedSteps: progress.steps.filter(s => s.status === 'completed').length,
        failedSteps: progress.steps.filter(s => s.status === 'failed').length,
        totalDuration: Date.now() - progress.startTime
      })
    };
  }

  /**
   * Get progress statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeOperations: this.operations.size,
      successRate: this.stats.totalOperations > 0 
        ? (this.stats.completedOperations / this.stats.totalOperations * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Clear all progress indicators
   */
  clear() {
    for (const [id, operation] of this.operations.entries()) {
      if (operation.spinner) {
        operation.spinner.stop();
      }
    }
    
    this.operations.clear();
    this.progressBars.clear();
    this.spinners.clear();
  }
}

// Global progress manager instance
export const globalProgressManager = new ProgressManager({
  enabled: true,
  quiet: false
}); 