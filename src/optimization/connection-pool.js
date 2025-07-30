import axios from 'axios';
import { EventEmitter } from 'events';

/**
 * Connection Pool for API calls
 * Manages HTTP connections efficiently to reduce overhead
 */
export class ConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.maxConnections = options.maxConnections || 10;
    this.maxIdleTime = options.maxIdleTime || 30000; // 30 seconds
    this.keepAlive = options.keepAlive !== false;
    this.keepAliveMsecs = options.keepAliveMsecs || 1000;
    this.maxSockets = options.maxSockets || 50;
    this.maxFreeSockets = options.maxFreeSockets || 10;
    
    this.connections = new Map();
    this.idleConnections = new Map();
    this.activeConnections = 0;
    this.stats = {
      totalRequests: 0,
      cachedRequests: 0,
      connectionErrors: 0,
      averageResponseTime: 0
    };
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.maxIdleTime);
  }

  /**
   * Get or create an axios instance for a specific base URL
   */
  getConnection(baseURL, options = {}) {
    const key = this.generateConnectionKey(baseURL, options);
    
    if (this.connections.has(key)) {
      return this.connections.get(key);
    }
    
    const connection = this.createConnection(baseURL, options);
    this.connections.set(key, connection);
    
    return connection;
  }

  /**
   * Generate unique key for connection
   */
  generateConnectionKey(baseURL, options = {}) {
    const config = {
      baseURL,
      timeout: options.timeout || 30000,
      headers: options.headers || {}
    };
    return JSON.stringify(config);
  }

  /**
   * Create optimized axios instance
   */
  createConnection(baseURL, options = {}) {
    const instance = axios.create({
      baseURL,
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': 'Glassbox-CLI/1.0',
        'Connection': this.keepAlive ? 'keep-alive' : 'close',
        ...options.headers
      },
      // HTTP Agent configuration for connection pooling
      httpAgent: new (require('http').Agent)({
        keepAlive: this.keepAlive,
        keepAliveMsecs: this.keepAliveMsecs,
        maxSockets: this.maxSockets,
        maxFreeSockets: this.maxFreeSockets
      }),
      httpsAgent: new (require('https').Agent)({
        keepAlive: this.keepAlive,
        keepAliveMsecs: this.keepAliveMsecs,
        maxSockets: this.maxSockets,
        maxFreeSockets: this.maxFreeSockets
      })
    });

    // Add request interceptor for tracking
    instance.interceptors.request.use(
      (config) => {
        this.activeConnections++;
        config.metadata = { startTime: Date.now() };
        this.emit('request', config);
        return config;
      },
      (error) => {
        this.activeConnections--;
        this.stats.connectionErrors++;
        this.emit('error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for tracking
    instance.interceptors.response.use(
      (response) => {
        this.activeConnections--;
        const duration = Date.now() - response.config.metadata.startTime;
        this.updateStats(duration);
        this.emit('response', response, duration);
        return response;
      },
      (error) => {
        this.activeConnections--;
        this.stats.connectionErrors++;
        this.emit('error', error);
        return Promise.reject(error);
      }
    );

    return instance;
  }

  /**
   * Update connection statistics
   */
  updateStats(duration) {
    this.stats.totalRequests++;
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + duration) / 
      this.stats.totalRequests;
  }

  /**
   * Clean up idle connections
   */
  cleanupIdleConnections() {
    const now = Date.now();
    for (const [key, lastUsed] of this.idleConnections.entries()) {
      if (now - lastUsed > this.maxIdleTime) {
        const connection = this.connections.get(key);
        if (connection) {
          // Close the connection
          if (connection.httpAgent) {
            connection.httpAgent.destroy();
          }
          if (connection.httpsAgent) {
            connection.httpsAgent.destroy();
          }
          this.connections.delete(key);
        }
        this.idleConnections.delete(key);
      }
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.activeConnections,
      totalConnections: this.connections.size,
      idleConnections: this.idleConnections.size,
      maxConnections: this.maxConnections
    };
  }

  /**
   * Close all connections
   */
  async close() {
    clearInterval(this.cleanupInterval);
    
    for (const [key, connection] of this.connections.entries()) {
      if (connection.httpAgent) {
        connection.httpAgent.destroy();
      }
      if (connection.httpsAgent) {
        connection.httpsAgent.destroy();
      }
    }
    
    this.connections.clear();
    this.idleConnections.clear();
    this.activeConnections = 0;
    
    this.emit('closed');
  }
}

// Global connection pool instance
export const globalConnectionPool = new ConnectionPool({
  maxConnections: 20,
  maxIdleTime: 60000, // 1 minute
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 100,
  maxFreeSockets: 20
}); 