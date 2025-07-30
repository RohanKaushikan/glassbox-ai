/**
 * Metrics Collector for detailed observability
 * Provides comprehensive metrics collection and monitoring capabilities
 */
export class MetricsCollector {
  constructor(options = {}) {
    this.metrics = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
    this.startTime = Date.now();
    this.enabled = options.enabled !== false;
    this.exportInterval = options.exportInterval || 60000; // 1 minute
    this.exportCallback = options.exportCallback || this.defaultExportCallback;
    this.intervalId = null;
  }

  /**
   * Increment a counter
   * @param {string} name - Counter name
   * @param {number} value - Value to increment by (default: 1)
   * @param {object} labels - Optional labels
   */
  increment(name, value = 1, labels = {}) {
    if (!this.enabled) return;
    
    const key = this.getMetricKey(name, labels);
    const counter = this.counters.get(key) || { value: 0, labels };
    counter.value += value;
    counter.lastUpdate = Date.now();
    this.counters.set(key, counter);
  }

  /**
   * Set a gauge value
   * @param {string} name - Gauge name
   * @param {number} value - Gauge value
   * @param {object} labels - Optional labels
   */
  gauge(name, value, labels = {}) {
    if (!this.enabled) return;
    
    const key = this.getMetricKey(name, labels);
    const gauge = this.gauges.get(key) || { value: 0, labels };
    gauge.value = value;
    gauge.lastUpdate = Date.now();
    this.gauges.set(key, gauge);
  }

  /**
   * Record a histogram value
   * @param {string} name - Histogram name
   * @param {number} value - Value to record
   * @param {object} labels - Optional labels
   */
  histogram(name, value, labels = {}) {
    if (!this.enabled) return;
    
    const key = this.getMetricKey(name, labels);
    const histogram = this.histograms.get(key) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      buckets: new Map(),
      labels
    };
    
    histogram.count++;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);
    histogram.lastUpdate = Date.now();
    
    // Update buckets (simple bucketing)
    const bucket = this.getBucket(value);
    histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
    
    this.histograms.set(key, histogram);
  }

  /**
   * Start a timer
   * @param {string} name - Timer name
   * @param {object} labels - Optional labels
   * @returns {Function} Stop function
   */
  timer(name, labels = {}) {
    if (!this.enabled) {
      return () => {}; // No-op if disabled
    }
    
    const startTime = Date.now();
    const key = this.getMetricKey(name, labels);
    
    return () => {
      const duration = Date.now() - startTime;
      this.histogram(name, duration, labels);
    };
  }

  /**
   * Time an async function
   * @param {string} name - Timer name
   * @param {Function} fn - Function to time
   * @param {object} labels - Optional labels
   * @returns {Promise<any>} Function result
   */
  async timeAsync(name, fn, labels = {}) {
    const stop = this.timer(name, labels);
    try {
      const result = await fn();
      stop();
      return result;
    } catch (error) {
      stop();
      throw error;
    }
  }

  /**
   * Record an event
   * @param {string} name - Event name
   * @param {object} data - Event data
   * @param {object} labels - Optional labels
   */
  event(name, data = {}, labels = {}) {
    if (!this.enabled) return;
    
    const key = this.getMetricKey(name, labels);
    const events = this.metrics.get(key) || [];
    events.push({
      timestamp: Date.now(),
      data,
      labels
    });
    
    // Keep only last 1000 events
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }
    
    this.metrics.set(key, events);
  }

  /**
   * Get bucket for histogram
   * @param {number} value - Value to bucket
   * @returns {string} Bucket name
   */
  getBucket(value) {
    const buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    for (const bucket of buckets) {
      if (value <= bucket) {
        return `le_${bucket}`;
      }
    }
    return 'le_inf';
  }

  /**
   * Get metric key with labels
   * @param {string} name - Metric name
   * @param {object} labels - Labels
   * @returns {string} Metric key
   */
  getMetricKey(name, labels = {}) {
    const labelStr = Object.keys(labels)
      .sort()
      .map(key => `${key}=${labels[key]}`)
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Get all metrics
   * @returns {object} All collected metrics
   */
  getAllMetrics() {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    return {
      timestamp: new Date().toISOString(),
      uptime,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms),
      events: Object.fromEntries(this.metrics),
      summary: this.getSummary()
    };
  }

  /**
   * Get metrics summary
   * @returns {object} Metrics summary
   */
  getSummary() {
    const counters = Array.from(this.counters.values());
    const gauges = Array.from(this.gauges.values());
    const histograms = Array.from(this.histograms.values());
    
    return {
      totalCounters: counters.length,
      totalGauges: gauges.length,
      totalHistograms: histograms.length,
      totalEvents: Array.from(this.metrics.values()).reduce((sum, events) => sum + events.length, 0),
      averageCounterValue: counters.length > 0 ? 
        counters.reduce((sum, counter) => sum + counter.value, 0) / counters.length : 0,
      averageGaugeValue: gauges.length > 0 ? 
        gauges.reduce((sum, gauge) => sum + gauge.value, 0) / gauges.length : 0
    };
  }

  /**
   * Get specific metric
   * @param {string} name - Metric name
   * @param {object} labels - Labels
   * @returns {any} Metric value
   */
  getMetric(name, labels = {}) {
    const key = this.getMetricKey(name, labels);
    
    if (this.counters.has(key)) return this.counters.get(key);
    if (this.gauges.has(key)) return this.gauges.get(key);
    if (this.histograms.has(key)) return this.histograms.get(key);
    if (this.metrics.has(key)) return this.metrics.get(key);
    
    return null;
  }

  /**
   * Start metrics export
   */
  startExport() {
    if (this.intervalId) {
      console.warn('Metrics export is already running');
      return;
    }
    
    this.intervalId = setInterval(() => {
      this.exportMetrics();
    }, this.exportInterval);
    
    console.log('Started metrics export');
  }

  /**
   * Stop metrics export
   */
  stopExport() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped metrics export');
    }
  }

  /**
   * Export current metrics
   */
  exportMetrics() {
    const metrics = this.getAllMetrics();
    this.exportCallback(metrics);
  }

  /**
   * Default export callback
   * @param {object} metrics - Metrics to export
   */
  defaultExportCallback(metrics) {
    console.log('Metrics export:', JSON.stringify(metrics, null, 2));
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.metrics.clear();
    this.startTime = Date.now();
  }

  /**
   * Enable metrics collection
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable metrics collection
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Get performance metrics
   * @returns {object} Performance metrics
   */
  getPerformanceMetrics() {
    const histograms = Array.from(this.histograms.values());
    const performanceMetrics = {};
    
    for (const histogram of histograms) {
      if (histogram.count > 0) {
        performanceMetrics[histogram.name] = {
          count: histogram.count,
          sum: histogram.sum,
          min: histogram.min,
          max: histogram.max,
          average: histogram.sum / histogram.count,
          p50: this.calculatePercentile(histogram, 50),
          p95: this.calculatePercentile(histogram, 95),
          p99: this.calculatePercentile(histogram, 99)
        };
      }
    }
    
    return performanceMetrics;
  }

  /**
   * Calculate percentile from histogram
   * @param {object} histogram - Histogram data
   * @param {number} percentile - Percentile to calculate
   * @returns {number} Percentile value
   */
  calculatePercentile(histogram, percentile) {
    // Simple percentile calculation based on buckets
    const sortedBuckets = Array.from(histogram.buckets.entries())
      .sort(([a], [b]) => parseInt(a.replace('le_', '')) - parseInt(b.replace('le_', '')));
    
    let cumulative = 0;
    const target = (percentile / 100) * histogram.count;
    
    for (const [bucket, count] of sortedBuckets) {
      cumulative += count;
      if (cumulative >= target) {
        return parseInt(bucket.replace('le_', ''));
      }
    }
    
    return histogram.max;
  }
} 