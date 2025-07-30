import fs from 'fs/promises';
import path from 'path';

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG = {
  enabled: true,
  cacheDir: '.glassbox-cache',
  defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  compressionThreshold: 1024, // 1KB
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  privacy: {
    hashPrompts: true,
    excludeSensitiveFields: ['api_key', 'password', 'token', 'secret']
  },
  models: {
    // Model-specific TTL overrides
    'gpt-4': 12 * 60 * 60 * 1000, // 12 hours
    'gpt-3.5-turbo': 24 * 60 * 60 * 1000, // 24 hours
    'claude-3': 12 * 60 * 60 * 1000, // 12 hours
    'llama2': 7 * 24 * 60 * 60 * 1000 // 7 days
  }
};

/**
 * Cache configuration manager
 */
export class CacheConfig {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(process.cwd(), '.glassbox-cache-config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from file
   */
  async load() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const loadedConfig = JSON.parse(data);
      this.config = { ...DEFAULT_CONFIG, ...loadedConfig };
      return this.config;
    } catch (error) {
      // Config file doesn't exist, use defaults
      return this.config;
    }
  }

  /**
   * Save configuration to file
   */
  async save() {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save cache config: ${error.message}`);
    }
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get TTL for specific model
   */
  getTTL(model) {
    return this.config.models[model] || this.config.defaultTTL;
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];
    
    if (this.config.defaultTTL < 0) {
      errors.push('defaultTTL must be positive');
    }
    
    if (this.config.maxCacheSize < 1024) {
      errors.push('maxCacheSize must be at least 1KB');
    }
    
    if (this.config.compressionThreshold < 0) {
      errors.push('compressionThreshold must be non-negative');
    }
    
    if (this.config.cleanupInterval < 0) {
      errors.push('cleanupInterval must be positive');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get sanitized configuration for cache manager
   */
  getCacheOptions() {
    return {
      cacheDir: this.config.cacheDir,
      defaultTTL: this.config.defaultTTL,
      maxCacheSize: this.config.maxCacheSize,
      compressionThreshold: this.config.compressionThreshold
    };
  }

  /**
   * Check if caching is enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Get privacy settings
   */
  getPrivacySettings() {
    return this.config.privacy;
  }

  /**
   * Create default configuration file
   */
  async createDefault() {
    if (await this.exists()) {
      throw new Error('Configuration file already exists');
    }
    
    await this.save();
    return this.config;
  }

  /**
   * Check if configuration file exists
   */
  async exists() {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset to default configuration
   */
  reset() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get all configuration as object
   */
  getAll() {
    return { ...this.config };
  }
} 