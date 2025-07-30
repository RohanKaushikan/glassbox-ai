import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { EventEmitter } from 'events';

/**
 * Optimized YAML Parser with lazy loading and caching
 */
export class OptimizedParser extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.cache = new Map();
    this.cacheSize = options.cacheSize || 100;
    this.batchSize = options.batchSize || 10;
    this.lazyLoad = options.lazyLoad !== false;
    this.validateOnLoad = options.validateOnLoad !== false;
    
    this.stats = {
      filesParsed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationErrors: 0,
      parsingErrors: 0
    };
  }

  /**
   * Parse test files with lazy loading and batching
   */
  async parseTestFiles(testDir, options = {}) {
    const files = await this.getTestFiles(testDir);
    
    if (files.length === 0) {
      throw new Error('No valid test files found');
    }

    const results = [];
    const batches = this.createBatches(files, this.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.emit('batch-start', { batchIndex: i, totalBatches: batches.length, files: batch });
      
      const batchResults = await this.parseBatch(batch, options);
      results.push(...batchResults);
      
      this.emit('batch-complete', { 
        batchIndex: i, 
        totalBatches: batches.length, 
        results: batchResults 
      });
    }

    return results;
  }

  /**
   * Get all test files from directory
   */
  async getTestFiles(testDir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(testDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.yml')) {
          files.push(path.join(testDir, entry.name));
        } else if (entry.isDirectory()) {
          const subFiles = await this.getTestFiles(path.join(testDir, entry.name));
          files.push(...subFiles);
        }
      }
    } catch (error) {
      throw new Error(`Failed to read test directory: ${error.message}`);
    }

    return files.sort();
  }

  /**
   * Create batches of files for processing
   */
  createBatches(files, batchSize) {
    const batches = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Parse a batch of files
   */
  async parseBatch(files, options = {}) {
    const promises = files.map(file => this.parseFile(file, options));
    const results = await Promise.allSettled(promises);
    
    return results
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          this.stats.parsingErrors++;
          this.emit('parse-error', { file: files[index], error: result.reason });
          return null;
        }
      })
      .filter(result => result !== null);
  }

  /**
   * Parse a single file with caching
   */
  async parseFile(filePath, options = {}) {
    const cacheKey = this.generateCacheKey(filePath, options);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    this.stats.cacheMisses++;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = this.parseYAML(content, filePath);
      
      if (this.validateOnLoad) {
        this.validateTestSuite(parsed, filePath);
      }
      
      // Cache the result
      this.cacheResult(cacheKey, parsed);
      
      this.stats.filesParsed++;
      this.emit('file-parsed', { file: filePath, result: parsed });
      
      return parsed;
      
    } catch (error) {
      this.stats.parsingErrors++;
      this.emit('parse-error', { file: filePath, error });
      throw error;
    }
  }

  /**
   * Parse YAML content with optimized parsing
   */
  parseYAML(content, filePath) {
    try {
      const parsed = yaml.load(content, {
        filename: filePath,
        strict: false,
        onWarning: (warning) => {
          this.emit('parse-warning', { file: filePath, warning });
        }
      });

      if (!parsed) {
        throw new Error('Empty or invalid YAML content');
      }

      return {
        file: filePath,
        content: parsed,
        metadata: {
          size: content.length,
          lines: content.split('\n').length,
          parsedAt: Date.now()
        }
      };
      
    } catch (error) {
      throw new Error(`YAML parsing failed for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Validate test suite structure
   */
  validateTestSuite(parsed, filePath) {
    const { content } = parsed;
    
    if (!content.name) {
      throw new Error(`Missing 'name' field in ${filePath}`);
    }
    
    if (!content.tests || !Array.isArray(content.tests)) {
      throw new Error(`Missing or invalid 'tests' array in ${filePath}`);
    }
    
    for (let i = 0; i < content.tests.length; i++) {
      const test = content.tests[i];
      
      if (!test.name) {
        throw new Error(`Test ${i + 1} in ${filePath} is missing 'name' field`);
      }
      
      if (!test.prompt) {
        throw new Error(`Test '${test.name}' in ${filePath} is missing 'prompt' field`);
      }
      
      if (!test.expect) {
        throw new Error(`Test '${test.name}' in ${filePath} is missing 'expect' field`);
      }
    }
  }

  /**
   * Generate cache key for file
   */
  generateCacheKey(filePath, options = {}) {
    const key = {
      file: filePath,
      validateOnLoad: this.validateOnLoad,
      ...options
    };
    return JSON.stringify(key);
  }

  /**
   * Cache result with size management
   */
  cacheResult(key, result) {
    if (this.cache.size >= this.cacheSize) {
      // Remove oldest entry (simple LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, result);
  }

  /**
   * Lazy load test suites
   */
  async lazyLoadTestSuites(testDir, options = {}) {
    const files = await this.getTestFiles(testDir);
    
    return {
      files,
      totalFiles: files.length,
      loadTest: async (index) => {
        if (index >= files.length) {
          throw new Error('Test index out of range');
        }
        return await this.parseFile(files[index], options);
      },
      loadBatch: async (startIndex, count) => {
        const endIndex = Math.min(startIndex + count, files.length);
        const batchFiles = files.slice(startIndex, endIndex);
        return await this.parseBatch(batchFiles, options);
      }
    };
  }

  /**
   * Stream parse large files
   */
  async streamParseFile(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      stream.on('end', async () => {
        try {
          const content = chunks.join('');
          const parsed = this.parseYAML(content, filePath);
          
          if (this.validateOnLoad) {
            this.validateTestSuite(parsed, filePath);
          }
          
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Get parser statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Optimize cache size
   */
  optimizeCache() {
    if (this.cache.size > this.cacheSize * 0.8) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.slice(0, Math.floor(this.cacheSize * 0.2));
      
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }
} 