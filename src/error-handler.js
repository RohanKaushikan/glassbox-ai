import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Error types for categorization
export const ERROR_TYPES = {
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  CONNECTION_FAILURE: 'CONNECTION_FAILURE',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  SERVICE_OUTAGE: 'SERVICE_OUTAGE',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  BILLING_ERROR: 'BILLING_ERROR',
  PARTIAL_AVAILABILITY: 'PARTIAL_AVAILABILITY',
  // File system errors
  MISSING_DIRECTORY: 'MISSING_DIRECTORY',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DISK_SPACE_FULL: 'DISK_SPACE_FULL',
  FILE_SIZE_LIMIT: 'FILE_SIZE_LIMIT',
  OS_PATH_ISSUE: 'OS_PATH_ISSUE',
  CONCURRENT_ACCESS: 'CONCURRENT_ACCESS',
  FILE_CORRUPTION: 'FILE_CORRUPTION',
  ENCODING_ERROR: 'ENCODING_ERROR',
  SYMLINK_ISSUE: 'SYMLINK_ISSUE',
  LOCK_ERROR: 'LOCK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

// Retry configuration
export const RETRY_CONFIG = {
  DEFAULT_MAX_RETRIES: 3,
  EXPONENTIAL_BACKOFF_BASE: 2,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  RATE_LIMIT_DELAY_MS: 60000,
  TIMEOUT_MS: 30000
};

// Logging configuration
const LOG_CONFIG = {
  LOG_FILE: '.glassbox/error.log',
  MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
  LOG_LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
  }
};

/**
 * Enhanced error class with additional context
 */
export class GlassboxError extends Error {
  constructor(type, message, context = {}) {
    super(message);
    this.name = 'GlassboxError';
    this.type = type;
    this.context = context;
    this.timestamp = new Date();
    this.severity = context.severity || ERROR_SEVERITY.MEDIUM;
    this.retryable = context.retryable !== false;
    this.userFriendly = context.userFriendly !== false;
  }
}

/**
 * Logger for detailed error tracking
 */
class ErrorLogger {
  constructor() {
    this.logFile = LOG_CONFIG.LOG_FILE;
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context,
      stack: context.error?.stack
    };

    // Console output for immediate feedback
    const colorMap = {
      DEBUG: chalk.gray,
      INFO: chalk.blue,
      WARN: chalk.yellow,
      ERROR: chalk.red,
      CRITICAL: chalk.bgRed.white
    };

    const color = colorMap[level] || chalk.white;
    console.error(color(`[${level}] ${message}`));

    // File logging for persistence
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (err) {
      console.error('Failed to write to error log:', err.message);
    }
  }

  debug(message, context = {}) {
    this.log('DEBUG', message, context);
  }

  info(message, context = {}) {
    this.log('INFO', message, context);
  }

  warn(message, context = {}) {
    this.log('WARN', message, context);
  }

  error(message, context = {}) {
    this.log('ERROR', message, context);
  }

  critical(message, context = {}) {
    this.log('CRITICAL', message, context);
  }
}

// Global logger instance
export const logger = new ErrorLogger();

/**
 * Exponential backoff retry with jitter
 */
export async function exponentialBackoff(operation, maxRetries = RETRY_CONFIG.DEFAULT_MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }

      // Determine delay based on error type
      let delay = RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(RETRY_CONFIG.EXPONENTIAL_BACKOFF_BASE, attempt);
      
      // Add jitter to prevent thundering herd
      delay += Math.random() * 1000;
      
      // Cap the delay
      delay = Math.min(delay, RETRY_CONFIG.MAX_DELAY_MS);
      
      // Special handling for rate limits
      if (isRateLimitError(error)) {
        delay = RETRY_CONFIG.RATE_LIMIT_DELAY_MS;
        logger.warn(`Rate limit hit, waiting ${delay}ms before retry`, { attempt, error: error.message });
      } else {
        logger.info(`Retrying operation (attempt ${attempt + 1}/${maxRetries + 1})`, { 
          attempt, 
          delay, 
          error: error.message 
        });
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Sleep utility
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect error types from various sources
 */
export function classifyError(error, context = {}) {
  const message = error.message?.toLowerCase() || '';
  const status = error.response?.status;
  const code = error.code;

  // Network timeouts
  if (code === 'ECONNABORTED' || message.includes('timeout') || message.includes('timed out')) {
    return new GlassboxError(ERROR_TYPES.NETWORK_TIMEOUT, 'Request timed out', {
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { ...context, originalError: error.message }
    });
  }

  // Connection failures
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || message.includes('connection refused')) {
    return new GlassboxError(ERROR_TYPES.CONNECTION_FAILURE, 'Connection failed', {
      severity: ERROR_SEVERITY.HIGH,
      retryable: true,
      context: { ...context, originalError: error.message }
    });
  }

  // Rate limiting
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return new GlassboxError(ERROR_TYPES.API_RATE_LIMIT, 'API rate limit exceeded', {
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { ...context, status, originalError: error.message }
    });
  }

  // Authentication errors
  if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('forbidden')) {
    return new GlassboxError(ERROR_TYPES.AUTHENTICATION_ERROR, 'Authentication failed', {
      severity: ERROR_SEVERITY.HIGH,
      retryable: false,
      context: { ...context, status, originalError: error.message }
    });
  }

  // Model unavailability
  if (status === 404 && message.includes('model') || message.includes('model not found')) {
    return new GlassboxError(ERROR_TYPES.MODEL_UNAVAILABLE, 'Model not available', {
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: false,
      context: { ...context, status, originalError: error.message }
    });
  }

  // Service outages
  if (status >= 500 || message.includes('internal server error') || message.includes('service unavailable')) {
    return new GlassboxError(ERROR_TYPES.SERVICE_OUTAGE, 'Service temporarily unavailable', {
      severity: ERROR_SEVERITY.HIGH,
      retryable: true,
      context: { ...context, status, originalError: error.message }
    });
  }

  // Quota exceeded
  if (status === 402 || message.includes('quota') || message.includes('billing') || message.includes('payment')) {
    return new GlassboxError(ERROR_TYPES.QUOTA_EXCEEDED, 'Quota exceeded or billing issue', {
      severity: ERROR_SEVERITY.CRITICAL,
      retryable: false,
      context: { ...context, status, originalError: error.message }
    });
  }

  // Malformed responses
  if (message.includes('invalid response') || message.includes('malformed') || message.includes('unexpected')) {
    return new GlassboxError(ERROR_TYPES.MALFORMED_RESPONSE, 'Received malformed response', {
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { ...context, originalError: error.message }
    });
  }

  // File system errors
  if (code === 'ENOENT' || message.includes('no such file') || message.includes('not found')) {
    return new GlassboxError(ERROR_TYPES.MISSING_DIRECTORY, 'File or directory not found', {
      severity: ERROR_SEVERITY.HIGH,
      retryable: false,
      context: { ...context, originalError: error.message }
    });
  }

  if (code === 'EACCES' || code === 'EPERM' || message.includes('permission denied')) {
    return new GlassboxError(ERROR_TYPES.PERMISSION_DENIED, 'Permission denied', {
      severity: ERROR_SEVERITY.HIGH,
      retryable: false,
      context: { ...context, originalError: error.message }
    });
  }

  if (code === 'ENOSPC' || message.includes('no space left')) {
    return new GlassboxError(ERROR_TYPES.DISK_SPACE_FULL, 'Disk space full', {
      severity: ERROR_SEVERITY.CRITICAL,
      retryable: false,
      context: { ...context, originalError: error.message }
    });
  }

  if (code === 'EFBIG' || message.includes('file too large')) {
    return new GlassboxError(ERROR_TYPES.FILE_SIZE_LIMIT, 'File too large', {
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: false,
      context: { ...context, originalError: error.message }
    });
  }

  if (code === 'ENAMETOOLONG' || message.includes('name too long')) {
    return new GlassboxError(ERROR_TYPES.OS_PATH_ISSUE, 'Path too long for operating system', {
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: false,
      context: { ...context, originalError: error.message }
    });
  }

  if (code === 'EEXIST' || message.includes('file exists')) {
    return new GlassboxError(ERROR_TYPES.CONCURRENT_ACCESS, 'File already exists or is locked', {
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { ...context, originalError: error.message }
    });
  }

  if (code === 'EIO' || message.includes('input/output error')) {
    return new GlassboxError(ERROR_TYPES.FILE_CORRUPTION, 'File system I/O error', {
      severity: ERROR_SEVERITY.HIGH,
      retryable: true,
      context: { ...context, originalError: error.message }
    });
  }

  // Default unknown error
  return new GlassboxError(ERROR_TYPES.UNKNOWN_ERROR, 'An unexpected error occurred', {
    severity: ERROR_SEVERITY.MEDIUM,
    retryable: true,
    context: { ...context, originalError: error.message }
  });
}

/**
 * Check if error is rate limit related
 */
export function isRateLimitError(error) {
  const message = error.message?.toLowerCase() || '';
  const status = error.response?.status;
  return status === 429 || message.includes('rate limit') || message.includes('too many requests');
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
  if (error instanceof GlassboxError) {
    return error.retryable;
  }
  
  const message = error.message?.toLowerCase() || '';
  const status = error.response?.status;
  
  // Retryable errors
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  const retryableMessages = ['timeout', 'connection', 'network', 'temporary', 'unavailable'];
  
  return retryableStatuses.includes(status) || 
         retryableMessages.some(msg => message.includes(msg));
}

/**
 * Create user-friendly error messages
 */
export function createUserFriendlyMessage(error, context = {}) {
  const errorType = error instanceof GlassboxError ? error.type : ERROR_TYPES.UNKNOWN_ERROR;
  
  const messages = {
    [ERROR_TYPES.NETWORK_TIMEOUT]: {
      title: 'Network Timeout',
      message: 'The request timed out due to network issues.',
      suggestions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Use a more stable network connection'
      ]
    },
    [ERROR_TYPES.CONNECTION_FAILURE]: {
      title: 'Connection Failed',
      message: 'Unable to connect to the AI service.',
      suggestions: [
        'Check if the service is running (Ollama)',
        'Verify API endpoints are accessible',
        'Check firewall settings'
      ]
    },
    [ERROR_TYPES.API_RATE_LIMIT]: {
      title: 'Rate Limit Exceeded',
      message: 'Too many requests to the AI service.',
      suggestions: [
        'Wait a moment before trying again',
        'Reduce the number of concurrent requests',
        'Consider upgrading your API plan'
      ]
    },
    [ERROR_TYPES.AUTHENTICATION_ERROR]: {
      title: 'Authentication Failed',
      message: 'Invalid API key or authentication credentials.',
      suggestions: [
        'Check your API key is set correctly',
        'Verify the API key has proper permissions',
        'Regenerate your API key if needed'
      ]
    },
    [ERROR_TYPES.MODEL_UNAVAILABLE]: {
      title: 'Model Not Available',
      message: 'The requested AI model is not available.',
      suggestions: [
        'Check if the model name is correct',
        'Try using a different model',
        'Ensure the model is available in your region'
      ]
    },
    [ERROR_TYPES.SERVICE_OUTAGE]: {
      title: 'Service Temporarily Unavailable',
      message: 'The AI service is experiencing issues.',
      suggestions: [
        'Try again in a few minutes',
        'Check service status pages',
        'Use a different AI provider'
      ]
    },
    [ERROR_TYPES.QUOTA_EXCEEDED]: {
      title: 'Quota Exceeded',
      message: 'You have exceeded your API quota or billing limit.',
      suggestions: [
        'Check your billing status',
        'Upgrade your API plan',
        'Reduce usage or wait for quota reset'
      ]
    },
    [ERROR_TYPES.MALFORMED_RESPONSE]: {
      title: 'Invalid Response',
      message: 'Received an unexpected response from the AI service.',
      suggestions: [
        'Try the request again',
        'Check if the service is functioning properly',
        'Report the issue if it persists'
      ]
    },
    [ERROR_TYPES.MISSING_DIRECTORY]: {
      title: 'File or Directory Not Found',
      message: 'The specified file or directory does not exist.',
      suggestions: [
        'Check if the path is correct',
        'Create the directory if it does not exist',
        'Verify file permissions'
      ]
    },
    [ERROR_TYPES.PERMISSION_DENIED]: {
      title: 'Permission Denied',
      message: 'Access to the file or directory is denied.',
      suggestions: [
        'Check file and directory permissions',
        'Run with appropriate user privileges',
        'Verify ownership of files and directories'
      ]
    },
    [ERROR_TYPES.DISK_SPACE_FULL]: {
      title: 'Disk Space Full',
      message: 'Insufficient disk space to complete the operation.',
      suggestions: [
        'Free up disk space',
        'Check available storage',
        'Move files to external storage'
      ]
    },
    [ERROR_TYPES.FILE_SIZE_LIMIT]: {
      title: 'File Too Large',
      message: 'The file exceeds the maximum allowed size.',
      suggestions: [
        'Reduce file size',
        'Split large files',
        'Use compression if applicable'
      ]
    },
    [ERROR_TYPES.OS_PATH_ISSUE]: {
      title: 'Path Issue',
      message: 'The file path is invalid for the current operating system.',
      suggestions: [
        'Check path length limits',
        'Use valid characters for your OS',
        'Avoid special characters in paths'
      ]
    },
    [ERROR_TYPES.CONCURRENT_ACCESS]: {
      title: 'Concurrent Access',
      message: 'The file is being accessed by another process.',
      suggestions: [
        'Wait for other processes to finish',
        'Close other applications using the file',
        'Try again in a few moments'
      ]
    },
    [ERROR_TYPES.FILE_CORRUPTION]: {
      title: 'File Corruption',
      message: 'The file appears to be corrupted or damaged.',
      suggestions: [
        'Check file integrity',
        'Restore from backup',
        'Recreate the file if possible'
      ]
    },
    [ERROR_TYPES.ENCODING_ERROR]: {
      title: 'Encoding Error',
      message: 'The file contains invalid character encoding.',
      suggestions: [
        'Check file encoding',
        'Convert to UTF-8 if possible',
        'Use a different text editor'
      ]
    },
    [ERROR_TYPES.SYMLINK_ISSUE]: {
      title: 'Symbolic Link Issue',
      message: 'There is a problem with a symbolic link.',
      suggestions: [
        'Check if the symlink target exists',
        'Verify symlink permissions',
        'Recreate the symlink if needed'
      ]
    },
    [ERROR_TYPES.LOCK_ERROR]: {
      title: 'File Lock Error',
      message: 'Could not acquire or release a file lock.',
      suggestions: [
        'Wait for the lock to be released',
        'Check for stale lock files',
        'Restart the application if needed'
      ]
    },
    [ERROR_TYPES.UNKNOWN_ERROR]: {
      title: 'Unexpected Error',
      message: 'An unexpected error occurred.',
      suggestions: [
        'Try again in a few moments',
        'Check the error logs for details',
        'Report the issue if it persists'
      ]
    }
  };

  const errorInfo = messages[errorType] || messages[ERROR_TYPES.UNKNOWN_ERROR];
  
  let output = chalk.red(`\n❌ ${errorInfo.title}: ${errorInfo.message}\n`);
  
  if (errorInfo.suggestions) {
    output += chalk.yellow('\n💡 Suggestions:\n');
    errorInfo.suggestions.forEach(suggestion => {
      output += chalk.gray(`  • ${suggestion}\n`);
    });
  }
  
  if (context.details) {
    output += chalk.blue('\n🔍 Details:\n');
    output += chalk.gray(`  ${context.details}\n`);
  }
  
  return output;
}

/**
 * Handle errors with graceful degradation
 */
export function handleErrorWithGracefulDegradation(error, context = {}) {
  const classifiedError = classifyError(error, context);
  
  // Log the error for debugging
  logger.error(`Error occurred: ${classifiedError.message}`, {
    type: classifiedError.type,
    severity: classifiedError.severity,
    context: classifiedError.context,
    stack: error.stack
  });
  
  // Create user-friendly message
  const userMessage = createUserFriendlyMessage(classifiedError, context);
  
  // Handle based on severity
  switch (classifiedError.severity) {
    case ERROR_SEVERITY.CRITICAL:
      logger.critical('Critical error - immediate action required', {
        error: classifiedError.message,
        context: classifiedError.context
      });
      break;
      
    case ERROR_SEVERITY.HIGH:
      logger.error('High severity error - may affect functionality', {
        error: classifiedError.message,
        context: classifiedError.context
      });
      break;
      
    case ERROR_SEVERITY.MEDIUM:
      logger.warn('Medium severity error - functionality may be degraded', {
        error: classifiedError.message,
        context: classifiedError.context
      });
      break;
      
    case ERROR_SEVERITY.LOW:
      logger.info('Low severity error - minimal impact', {
        error: classifiedError.message,
        context: classifiedError.context
      });
      break;
  }
  
  return {
    error: classifiedError,
    userMessage,
    retryable: classifiedError.retryable,
    severity: classifiedError.severity
  };
}

/**
 * Health check for AI services
 */
export async function checkServiceHealth(provider, context = {}) {
  const healthChecks = {
    openai: async () => {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'HEAD',
          timeout: 5000
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    },
    ollama: async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          timeout: 5000
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  };
  
  const healthCheck = healthChecks[provider];
  if (!healthCheck) {
    return { healthy: false, reason: 'Unknown provider' };
  }
  
  try {
    const healthy = await healthCheck();
    return { 
      healthy, 
      reason: healthy ? 'Service responding' : 'Service not responding' 
    };
  } catch (error) {
    return { 
      healthy: false, 
      reason: `Health check failed: ${error.message}` 
    };
  }
}

/**
 * Get error statistics for monitoring
 */
export function getErrorStats() {
  try {
    if (!fs.existsSync(LOG_CONFIG.LOG_FILE)) {
      return { totalErrors: 0, errorTypes: {} };
    }
    
    const logContent = fs.readFileSync(LOG_CONFIG.LOG_FILE, 'utf8');
    const lines = logContent.trim().split('\n');
    
    const stats = {
      totalErrors: 0,
      errorTypes: {},
      recentErrors: []
    };
    
    lines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.level === 'ERROR' || entry.level === 'CRITICAL') {
          stats.totalErrors++;
          
          const errorType = entry.context?.type || 'UNKNOWN';
          stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
          
          // Keep last 10 errors
          if (stats.recentErrors.length < 10) {
            stats.recentErrors.push({
              timestamp: entry.timestamp,
              message: entry.message,
              type: errorType
            });
          }
        }
      } catch (parseError) {
        // Skip malformed log entries
      }
    });
    
    return stats;
  } catch (error) {
    return { totalErrors: 0, errorTypes: {}, error: error.message };
  }
} 