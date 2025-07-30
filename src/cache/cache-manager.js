import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { platformUtils } from '../utils/platform-utils.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Cache Manager for AI responses
 * Handles caching, compression, TTL, and privacy protection
 */
export class CacheManager {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || platformUtils.getCacheDir();
    this.defaultTTL = options.defaultTTL || 24 * 60 * 60 * 1000; // 24 hours in ms
    this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024; // 100MB
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
    this.statsFile = platformUtils.joinPaths(this.cacheDir, 'stats.json');
    this.indexFile = platformUtils.joinPaths(this.cacheDir, 'index.json');
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      invalidations: 0,
      errors: 0,
      totalSize: 0,
      lastCleanup: null
    };
    this.index = new Map();
  }

  /**
   * Initialize cache directory and load existing data
   */
  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadStats();
      await this.loadIndex();
      await this.cleanup();
    } catch (error) {
      console.error('Cache initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate cache key from prompt and model
   * Uses SHA-256 hash for privacy protection
   */
  generateCacheKey(prompt, model, additionalParams = {}) {
    const data = JSON.stringify({
      prompt: prompt.trim(),
      model: model,
      ...additionalParams
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cache entry
   */
  async get(prompt, model, additionalParams = {}) {
    try {
      const key = this.generateCacheKey(prompt, model, additionalParams);
      const entry = this.index.get(key);
      
      if (!entry) {
        this.stats.misses++;
        await this.saveStats();
        return null;
      }

      // Check TTL
      if (Date.now() > entry.expiresAt) {
        await this.invalidate(key);
        this.stats.misses++;
        await this.saveStats();
        return null;
      }

      // Load cached response
      const cacheFile = platformUtils.joinPaths(this.cacheDir, key);
      const compressedData = await fs.readFile(cacheFile);
      const decompressedData = await gunzip(compressedData);
      const cachedResponse = JSON.parse(decompressedData.toString());

      this.stats.hits++;
      await this.saveStats();
      
      return cachedResponse;
    } catch (error) {
      this.stats.errors++;
      await this.saveStats();
      console.error('Cache get error:', error.message);
      return null;
    }
  }

  /**
   * Set cache entry
   */
  async set(prompt, model, response, additionalParams = {}, ttl = null) {
    try {
      const key = this.generateCacheKey(prompt, model, additionalParams);
      const expiresAt = Date.now() + (ttl || this.defaultTTL);
      
      const cacheEntry = {
        prompt: prompt.trim(),
        model: model,
        response: response,
        additionalParams,
        createdAt: Date.now(),
        expiresAt: expiresAt,
        size: 0
      };

      // Compress and store
      const data = JSON.stringify(cacheEntry);
      const compressedData = await gzip(data);
      
      const cacheFile = platformUtils.joinPaths(this.cacheDir, key);
      await fs.writeFile(cacheFile, compressedData);
      
      // Update index
      this.index.set(key, {
        expiresAt: expiresAt,
        size: compressedData.length,
        createdAt: Date.now()
      });

      this.stats.writes++;
      this.stats.totalSize += compressedData.length;
      await this.saveStats();
      await this.saveIndex();

      // Check if cleanup is needed
      if (this.stats.totalSize > this.maxCacheSize) {
        await this.cleanup();
      }

      return key;
    } catch (error) {
      this.stats.errors++;
      await this.saveStats();
      console.error('Cache set error:', error.message);
      throw error;
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key) {
    try {
      const cacheFile = platformUtils.joinPaths(this.cacheDir, key);
      const entry = this.index.get(key);
      
      if (entry) {
        this.stats.totalSize -= entry.size;
        this.index.delete(key);
        
        try {
          await fs.unlink(cacheFile);
        } catch (error) {
          // File might not exist, ignore
        }
        
        this.stats.invalidations++;
        await this.saveStats();
        await this.saveIndex();
      }
    } catch (error) {
      this.stats.errors++;
      await this.saveStats();
      console.error('Cache invalidation error:', error.message);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file !== 'stats.json' && file !== 'index.json') {
          await fs.unlink(platformUtils.joinPaths(this.cacheDir, file));
        }
      }
      
      this.index.clear();
      this.stats.totalSize = 0;
      this.stats.invalidations += this.index.size;
      await this.saveStats();
      await this.saveIndex();
    } catch (error) {
      this.stats.errors++;
      await this.saveStats();
      console.error('Cache clear error:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup expired entries and enforce size limits
   */
  async cleanup() {
    try {
      const now = Date.now();
      const keysToDelete = [];
      
      // Find expired entries
      for (const [key, entry] of this.index.entries()) {
        if (now > entry.expiresAt) {
          keysToDelete.push(key);
        }
      }
      
      // Delete expired entries
      for (const key of keysToDelete) {
        await this.invalidate(key);
      }
      
      // If still over size limit, remove oldest entries
      if (this.stats.totalSize > this.maxCacheSize) {
        const sortedEntries = Array.from(this.index.entries())
          .sort((a, b) => a[1].createdAt - b[1].createdAt);
        
        for (const [key, entry] of sortedEntries) {
          await this.invalidate(key);
          if (this.stats.totalSize <= this.maxCacheSize * 0.8) {
            break;
          }
        }
      }
      
      this.stats.lastCleanup = now;
      await this.saveStats();
    } catch (error) {
      this.stats.errors++;
      await this.saveStats();
      console.error('Cache cleanup error:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      entryCount: this.index.size,
      cacheSize: this.formatBytes(this.stats.totalSize),
      maxSize: this.formatBytes(this.maxCacheSize),
      usagePercent: ((this.stats.totalSize / this.maxCacheSize) * 100).toFixed(2)
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
   * Load cache statistics
   */
  async loadStats() {
    try {
      const data = await fs.readFile(this.statsFile, 'utf8');
      this.stats = { ...this.stats, ...JSON.parse(data) };
    } catch (error) {
      // Stats file doesn't exist, use defaults
    }
  }

  /**
   * Save cache statistics
   */
  async saveStats() {
    try {
      await fs.writeFile(this.statsFile, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      console.error('Failed to save cache stats:', error.message);
    }
  }

  /**
   * Load cache index
   */
  async loadIndex() {
    try {
      const data = await fs.readFile(this.indexFile, 'utf8');
      const indexData = JSON.parse(data);
      this.index = new Map(indexData);
    } catch (error) {
      // Index file doesn't exist, start with empty map
      this.index = new Map();
    }
  }

  /**
   * Save cache index
   */
  async saveIndex() {
    try {
      const indexData = Array.from(this.index.entries());
      await fs.writeFile(this.indexFile, JSON.stringify(indexData, null, 2));
    } catch (error) {
      console.error('Failed to save cache index:', error.message);
    }
  }

  /**
   * Get cache entry details
   */
  async getEntryDetails(key) {
    try {
      const entry = this.index.get(key);
      if (!entry) return null;

      const cacheFile = path.join(this.cacheDir, key);
      const compressedData = await fs.readFile(cacheFile);
      const decompressedData = await gunzip(compressedData);
      const cachedResponse = JSON.parse(decompressedData.toString());

      return {
        key,
        ...entry,
        ...cachedResponse,
        compressedSize: entry.size,
        uncompressedSize: decompressedData.length,
        compressionRatio: ((1 - entry.size / decompressedData.length) * 100).toFixed(2)
      };
    } catch (error) {
      console.error('Failed to get entry details:', error.message);
      return null;
    }
  }

  /**
   * List all cache entries
   */
  async listEntries() {
    const entries = [];
    for (const [key, entry] of this.index.entries()) {
      const details = await this.getEntryDetails(key);
      if (details) {
        entries.push(details);
      }
    }
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  }
} 