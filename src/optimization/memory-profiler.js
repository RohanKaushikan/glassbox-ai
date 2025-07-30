import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * Memory Profiler and Leak Detector
 */
export class MemoryProfiler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enabled = options.enabled !== false;
    this.interval = options.interval || 30000; // 30 seconds
    this.threshold = options.threshold || 100 * 1024 * 1024; // 100MB
    this.snapshots = [];
    this.maxSnapshots = options.maxSnapshots || 50;
    this.monitoring = false;
    this.intervalId = null;
    
    this.stats = {
      totalSnapshots: 0,
      memoryLeaks: 0,
      peakUsage: 0,
      averageUsage: 0,
      garbageCollections: 0
    };
  }

  /**
   * Start memory monitoring
   */
  start() {
    if (!this.enabled || this.monitoring) return;
    
    this.monitoring = true;
    this.intervalId = setInterval(() => {
      this.takeSnapshot();
    }, this.interval);
    
    this.emit('monitoring-started');
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.emit('monitoring-stopped');
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot() {
    const usage = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0
    };
    
    this.snapshots.push(snapshot);
    
    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
    
    this.stats.totalSnapshots++;
    this.updateStats(snapshot);
    
    // Check for memory leaks
    this.detectMemoryLeak();
    
    this.emit('snapshot-taken', snapshot);
  }

  /**
   * Update memory statistics
   */
  updateStats(snapshot) {
    this.stats.peakUsage = Math.max(this.stats.peakUsage, snapshot.heapUsed);
    
    const totalUsage = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0);
    this.stats.averageUsage = totalUsage / this.snapshots.length;
  }

  /**
   * Detect memory leaks
   */
  detectMemoryLeak() {
    if (this.snapshots.length < 3) return;
    
    const recent = this.snapshots.slice(-3);
    const trend = this.calculateTrend(recent.map(s => s.heapUsed));
    
    if (trend > 0.1) { // 10% growth threshold
      this.stats.memoryLeaks++;
      this.emit('memory-leak-detected', {
        trend,
        snapshots: recent,
        recommendation: this.getLeakRecommendation(recent)
      });
    }
  }

  /**
   * Calculate trend from data points
   */
  calculateTrend(data) {
    if (data.length < 2) return 0;
    
    const n = data.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, y) => sum + y, 0);
    const sumXY = data.reduce((sum, y, i) => sum + (i * y), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope / data[0]; // Normalize by initial value
  }

  /**
   * Get memory leak recommendations
   */
  getLeakRecommendation(snapshots) {
    const growth = snapshots[snapshots.length - 1].heapUsed - snapshots[0].heapUsed;
    const growthMB = growth / (1024 * 1024);
    
    if (growthMB > 50) {
      return 'Critical: Large memory leak detected. Check for unclosed resources, event listeners, or circular references.';
    } else if (growthMB > 20) {
      return 'Warning: Moderate memory leak detected. Review object lifecycle management.';
    } else if (growthMB > 5) {
      return 'Info: Small memory growth detected. Monitor for patterns.';
    }
    
    return 'No significant memory leak detected.';
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC() {
    if (global.gc) {
      global.gc();
      this.stats.garbageCollections++;
      this.emit('garbage-collection');
    }
  }

  /**
   * Get memory usage report
   */
  getMemoryReport() {
    const current = process.memoryUsage();
    const recent = this.snapshots.slice(-5);
    
    return {
      current: {
        rss: this.formatBytes(current.rss),
        heapTotal: this.formatBytes(current.heapTotal),
        heapUsed: this.formatBytes(current.heapUsed),
        external: this.formatBytes(current.external)
      },
      trend: recent.length >= 2 ? this.calculateTrend(recent.map(s => s.heapUsed)) : 0,
      snapshots: recent.length,
      stats: this.stats
    };
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Profile a function's memory usage
   */
  async profileFunction(fn, name = 'anonymous') {
    const before = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const after = process.memoryUsage();
      const endTime = performance.now();
      
      const memoryDelta = {
        rss: after.rss - before.rss,
        heapTotal: after.heapTotal - before.heapTotal,
        heapUsed: after.heapUsed - before.heapUsed,
        external: after.external - before.external
      };
      
      const profile = {
        name,
        duration: endTime - startTime,
        memoryDelta,
        memoryDeltaFormatted: {
          rss: this.formatBytes(memoryDelta.rss),
          heapTotal: this.formatBytes(memoryDelta.heapTotal),
          heapUsed: this.formatBytes(memoryDelta.heapUsed),
          external: this.formatBytes(memoryDelta.external)
        }
      };
      
      this.emit('function-profiled', profile);
      return { result, profile };
      
    } catch (error) {
      const after = process.memoryUsage();
      const endTime = performance.now();
      
      const profile = {
        name,
        duration: endTime - startTime,
        error: error.message,
        memoryDelta: {
          rss: after.rss - before.rss,
          heapTotal: after.heapTotal - before.heapTotal,
          heapUsed: after.heapUsed - before.heapUsed,
          external: after.external - before.external
        }
      };
      
      this.emit('function-profiled', profile);
      throw error;
    }
  }

  /**
   * Monitor specific objects for leaks
   */
  monitorObject(obj, name = 'object') {
    const weakRef = new WeakRef(obj);
    const initialSize = this.estimateObjectSize(obj);
    
    const monitor = {
      name,
      initialSize,
      currentSize: initialSize,
      references: 0,
      lastAccessed: Date.now()
    };
    
    // Set up periodic checking
    const checkInterval = setInterval(() => {
      const ref = weakRef.deref();
      if (ref) {
        monitor.currentSize = this.estimateObjectSize(ref);
        monitor.lastAccessed = Date.now();
        monitor.references++;
        
        if (monitor.currentSize > monitor.initialSize * 2) {
          this.emit('object-growth', monitor);
        }
      } else {
        clearInterval(checkInterval);
        this.emit('object-collected', monitor);
      }
    }, 10000); // Check every 10 seconds
    
    return monitor;
  }

  /**
   * Estimate object size (rough approximation)
   */
  estimateObjectSize(obj) {
    if (obj === null || obj === undefined) return 0;
    
    let size = 0;
    const visited = new WeakSet();
    
    const estimate = (item) => {
      if (visited.has(item)) return 0;
      visited.add(item);
      
      if (typeof item === 'string') {
        size += item.length * 2; // UTF-16
      } else if (typeof item === 'number') {
        size += 8;
      } else if (typeof item === 'boolean') {
        size += 4;
      } else if (Array.isArray(item)) {
        size += 8; // Array overhead
        for (const element of item) {
          estimate(element);
        }
      } else if (typeof item === 'object') {
        size += 8; // Object overhead
        for (const key in item) {
          if (item.hasOwnProperty(key)) {
            size += key.length * 2; // Key size
            estimate(item[key]);
          }
        }
      }
    };
    
    estimate(obj);
    return size;
  }

  /**
   * Get detailed memory analysis
   */
  getDetailedAnalysis() {
    const current = process.memoryUsage();
    const recent = this.snapshots.slice(-10);
    
    const analysis = {
      current: current,
      trend: recent.length >= 2 ? this.calculateTrend(recent.map(s => s.heapUsed)) : 0,
      peak: this.stats.peakUsage,
      average: this.stats.averageUsage,
      snapshots: recent.length,
      recommendations: []
    };
    
    // Generate recommendations
    if (current.heapUsed > this.threshold) {
      analysis.recommendations.push('High memory usage detected. Consider optimizing data structures or implementing pagination.');
    }
    
    if (analysis.trend > 0.05) {
      analysis.recommendations.push('Memory growth detected. Check for memory leaks in event listeners or circular references.');
    }
    
    if (current.external > current.heapUsed * 0.5) {
      analysis.recommendations.push('High external memory usage. Review file handles, network connections, or native modules.');
    }
    
    return analysis;
  }

  /**
   * Clear all snapshots
   */
  clear() {
    this.snapshots = [];
    this.stats = {
      totalSnapshots: 0,
      memoryLeaks: 0,
      peakUsage: 0,
      averageUsage: 0,
      garbageCollections: 0
    };
  }
}

// Global memory profiler instance
export const globalMemoryProfiler = new MemoryProfiler({
  enabled: true,
  interval: 30000,
  threshold: 100 * 1024 * 1024, // 100MB
  maxSnapshots: 50
}); 