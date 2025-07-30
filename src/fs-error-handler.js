import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { 
  GlassboxError, 
  ERROR_TYPES, 
  ERROR_SEVERITY, 
  logger 
} from './error-handler.js';
import { platformUtils } from './utils/platform-utils.js';

// Re-export logger for convenience
export { logger };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File system error types
export const FS_ERROR_TYPES = {
  MISSING_DIRECTORY: 'MISSING_DIRECTORY',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DISK_SPACE_FULL: 'DISK_SPACE_FULL',
  FILE_SIZE_LIMIT: 'FILE_SIZE_LIMIT',
  OS_PATH_ISSUE: 'OS_PATH_ISSUE',
  CONCURRENT_ACCESS: 'CONCURRENT_ACCESS',
  FILE_CORRUPTION: 'FILE_CORRUPTION',
  ENCODING_ERROR: 'ENCODING_ERROR',
  SYMLINK_ISSUE: 'SYMLINK_ISSUE',
  LOCK_ERROR: 'LOCK_ERROR'
};

// File system configuration
const FS_CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MIN_DISK_SPACE: 50 * 1024 * 1024, // 50MB
  LOCK_TIMEOUT: 30000, // 30 seconds
  ENCODINGS: ['utf8', 'utf-8', 'ascii', 'latin1'],
  WINDOWS_PATH_MAX: 260,
  UNIX_PATH_MAX: 4096
};

/**
 * Enhanced file system error class
 */
export class FileSystemError extends GlassboxError {
  constructor(type, message, context = {}) {
    super(type, message, {
      severity: ERROR_SEVERITY.HIGH,
      retryable: context.retryable !== false,
      userFriendly: context.userFriendly !== false,
      ...context
    });
    this.fsType = type;
    this.filePath = context.filePath;
    this.operation = context.operation;
  }
}

/**
 * Check if path is valid for current OS
 */
export function validatePath(filePath, context = {}) {
  const errors = [];

  // Check path length limits
  const maxPathLength = platformUtils.isWindows ? FS_CONFIG.WINDOWS_PATH_MAX : FS_CONFIG.UNIX_PATH_MAX;
  if (filePath.length > maxPathLength) {
    errors.push(new FileSystemError(FS_ERROR_TYPES.OS_PATH_ISSUE, 
      `Path too long for ${platformUtils.platform}: ${filePath.length} characters (max: ${maxPathLength})`, {
        filePath,
        operation: context.operation,
        pathLength: filePath.length,
        maxLength: maxPathLength,
        platform: platformUtils.platform
      }
    ));
  }

  // Check for invalid characters based on OS
  const invalidChars = platformUtils.isWindows 
    ? /[<>:"|?*]/g 
    : /[\0]/g;
  
  if (invalidChars.test(filePath)) {
    errors.push(new FileSystemError(FS_ERROR_TYPES.OS_PATH_ISSUE,
      `Path contains invalid characters for ${platformUtils.platform}: ${filePath}`, {
        filePath,
        operation: context.operation,
        platform: platformUtils.platform
      }
    ));
  }

  // Check for directory traversal attempts
  if (filePath.includes('..') || filePath.includes('~')) {
    errors.push(new FileSystemError(FS_ERROR_TYPES.OS_PATH_ISSUE,
      `Path contains potentially dangerous patterns: ${filePath}`, {
        filePath,
        operation: context.operation,
        dangerousPatterns: ['..', '~']
      }
    ));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check directory existence and permissions
 */
export async function checkDirectory(dirPath, context = {}) {
  const errors = [];

  try {
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      errors.push(new FileSystemError(FS_ERROR_TYPES.MISSING_DIRECTORY,
        `Directory does not exist: ${dirPath}`, {
          filePath: dirPath,
          operation: context.operation,
          suggestion: 'Create the directory or check the path'
        }
      ));
      return { valid: false, errors };
    }

    // Check if it's actually a directory
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      errors.push(new FileSystemError(FS_ERROR_TYPES.PERMISSION_DENIED,
        `Path exists but is not a directory: ${dirPath}`, {
          filePath: dirPath,
          operation: context.operation,
          isFile: stats.isFile(),
          isSymbolicLink: stats.isSymbolicLink()
        }
      ));
    }

    // Check read permissions
    try {
      fs.accessSync(dirPath, fs.constants.R_OK);
    } catch (error) {
      errors.push(new FileSystemError(FS_ERROR_TYPES.PERMISSION_DENIED,
        `No read permission for directory: ${dirPath}`, {
          filePath: dirPath,
          operation: context.operation,
          originalError: error.message
        }
      ));
    }

    // Check write permissions if needed
    if (context.requireWrite) {
      try {
        fs.accessSync(dirPath, fs.constants.W_OK);
      } catch (error) {
        errors.push(new FileSystemError(FS_ERROR_TYPES.PERMISSION_DENIED,
          `No write permission for directory: ${dirPath}`, {
            filePath: dirPath,
            operation: context.operation,
            originalError: error.message
          }
        ));
      }
    }

  } catch (error) {
    errors.push(new FileSystemError(FS_ERROR_TYPES.PERMISSION_DENIED,
      `Error accessing directory: ${dirPath}`, {
        filePath: dirPath,
        operation: context.operation,
        originalError: error.message
      }
    ));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check disk space availability
 */
export async function checkDiskSpace(dirPath, requiredSpace = FS_CONFIG.MIN_DISK_SPACE) {
  try {
    // Get disk space info
    const stats = fs.statSync(dirPath);
    const freeSpace = os.freemem(); // Available system memory
    
    if (freeSpace < requiredSpace) {
      return {
        sufficient: false,
        freeSpace,
        requiredSpace,
        error: new FileSystemError(FS_ERROR_TYPES.DISK_SPACE_FULL,
          `Insufficient disk space: ${Math.round(freeSpace / 1024 / 1024)}MB available, ${Math.round(requiredSpace / 1024 / 1024)}MB required`, {
            filePath: dirPath,
            operation: 'disk_space_check',
            freeSpace,
            requiredSpace
          }
        )
      };
    }

    return {
      sufficient: true,
      freeSpace,
      requiredSpace
    };
  } catch (error) {
    return {
      sufficient: false,
      error: new FileSystemError(FS_ERROR_TYPES.DISK_SPACE_FULL,
        `Could not check disk space: ${error.message}`, {
          filePath: dirPath,
          operation: 'disk_space_check',
          originalError: error.message
        }
      )
    };
  }
}

/**
 * Check file size limits
 */
export function checkFileSize(filePath, maxSize = FS_CONFIG.MAX_FILE_SIZE) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > maxSize) {
        return {
          withinLimit: false,
          fileSize: stats.size,
          maxSize,
          error: new FileSystemError(FS_ERROR_TYPES.FILE_SIZE_LIMIT,
            `File too large: ${Math.round(stats.size / 1024 / 1024)}MB (max: ${Math.round(maxSize / 1024 / 1024)}MB)`, {
              filePath,
              operation: 'file_size_check',
              fileSize: stats.size,
              maxSize
            }
          )
        };
      }
    }

    return {
      withinLimit: true
    };
  } catch (error) {
    return {
      withinLimit: false,
      error: new FileSystemError(FS_ERROR_TYPES.FILE_SIZE_LIMIT,
        `Could not check file size: ${error.message}`, {
          filePath,
          operation: 'file_size_check',
          originalError: error.message
        }
      )
    };
  }
}

/**
 * Handle concurrent file access with file locking
 */
export class FileLock {
  constructor(filePath) {
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.lockHandle = null;
  }

  async acquire(timeout = FS_CONFIG.LOCK_TIMEOUT) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Try to create lock file
        this.lockHandle = await fs.promises.open(this.lockPath, 'wx');
        await this.lockHandle.write(Date.now().toString());
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock file exists, check if it's stale
          try {
            const lockContent = await fs.promises.readFile(this.lockPath, 'utf8');
            const lockTime = parseInt(lockContent);
            const lockAge = Date.now() - lockTime;
            
            if (lockAge > timeout) {
              // Stale lock, remove it
              await fs.promises.unlink(this.lockPath);
              continue;
            }
          } catch (readError) {
            // Lock file might be corrupted, remove it
            try {
              await fs.promises.unlink(this.lockPath);
            } catch (unlinkError) {
              // Ignore unlink errors
            }
            continue;
          }
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    throw new FileSystemError(FS_ERROR_TYPES.LOCK_ERROR,
      `Could not acquire lock for file: ${this.filePath}`, {
        filePath: this.filePath,
        operation: 'file_lock',
        timeout
      }
    );
  }

  async release() {
    if (this.lockHandle) {
      await this.lockHandle.close();
      try {
        await fs.promises.unlink(this.lockPath);
      } catch (error) {
        // Ignore unlink errors
      }
      this.lockHandle = null;
    }
  }
}

/**
 * Check for file corruption
 */
export async function checkFileIntegrity(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        error: new FileSystemError(FS_ERROR_TYPES.FILE_CORRUPTION,
          `File does not exist: ${filePath}`, {
            filePath,
            operation: 'integrity_check'
          }
        )
      };
    }

    const stats = fs.statSync(filePath);
    
    // Check for zero-size files (might indicate corruption)
    if (stats.size === 0) {
      return {
        valid: false,
        error: new FileSystemError(FS_ERROR_TYPES.FILE_CORRUPTION,
          `File is empty: ${filePath}`, {
            filePath,
            operation: 'integrity_check',
            fileSize: 0
          }
        )
      };
    }

    // Try to read the file to check for corruption
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      
      // Check for common corruption indicators
      if (content.includes('\0') || content.includes('')) {
        return {
          valid: false,
          error: new FileSystemError(FS_ERROR_TYPES.FILE_CORRUPTION,
            `File contains corruption indicators: ${filePath}`, {
              filePath,
              operation: 'integrity_check',
              indicators: ['null bytes', 'replacement characters']
            }
          )
        };
      }

      return { valid: true };
    } catch (readError) {
      return {
        valid: false,
        error: new FileSystemError(FS_ERROR_TYPES.FILE_CORRUPTION,
          `Could not read file: ${readError.message}`, {
            filePath,
            operation: 'integrity_check',
            originalError: readError.message
          }
        )
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: new FileSystemError(FS_ERROR_TYPES.FILE_CORRUPTION,
        `Error checking file integrity: ${error.message}`, {
          filePath,
          operation: 'integrity_check',
          originalError: error.message
        }
      )
    };
  }
}

/**
 * Handle encoding issues
 */
export async function detectEncoding(filePath) {
  const encodings = FS_CONFIG.ENCODINGS;
  
  for (const encoding of encodings) {
    try {
      const content = await fs.promises.readFile(filePath, encoding);
      
      // Check for encoding errors (replacement characters)
      if (!content.includes('')) {
        return {
          encoding,
          valid: true
        };
      }
    } catch (error) {
      // Try next encoding
      continue;
    }
  }
  
  return {
    encoding: null,
    valid: false,
    error: new FileSystemError(FS_ERROR_TYPES.ENCODING_ERROR,
      `Could not detect valid encoding for file: ${filePath}`, {
        filePath,
        operation: 'encoding_detection',
        triedEncodings: encodings
      }
    )
  };
}

/**
 * Handle symlinks and unusual file system configurations
 */
export async function resolveSymlinks(filePath) {
  try {
    const realPath = await fs.promises.realpath(filePath);
    
    if (realPath !== filePath) {
      logger.info(`Resolved symlink: ${filePath} -> ${realPath}`);
    }
    
    return {
      originalPath: filePath,
      resolvedPath: realPath,
      isSymlink: realPath !== filePath
    };
  } catch (error) {
    return {
      originalPath: filePath,
      resolvedPath: null,
      isSymlink: false,
      error: new FileSystemError(FS_ERROR_TYPES.SYMLINK_ISSUE,
        `Could not resolve symlink: ${error.message}`, {
          filePath,
          operation: 'symlink_resolution',
          originalError: error.message
        }
      )
    };
  }
}

/**
 * Safe file writing with atomic operations
 */
export async function safeWriteFile(filePath, content, options = {}) {
  const {
    encoding = 'utf8',
    mode = 0o644,
    atomic = true,
    backup = true
  } = options;

  const lock = new FileLock(filePath);
  
  try {
    await lock.acquire();
    
    // Create backup if requested
    if (backup && fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup`;
      await fs.promises.copyFile(filePath, backupPath);
    }
    
    if (atomic) {
      // Write to temporary file first
      const tempPath = `${filePath}.tmp`;
      await fs.promises.writeFile(tempPath, content, { encoding, mode });
      
      // Atomic move
      await fs.promises.rename(tempPath, filePath);
    } else {
      // Direct write
      await fs.promises.writeFile(filePath, content, { encoding, mode });
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: new FileSystemError(FS_ERROR_TYPES.PERMISSION_DENIED,
        `Failed to write file: ${error.message}`, {
          filePath,
          operation: 'safe_write',
          originalError: error.message
        }
      )
    };
  } finally {
    await lock.release();
  }
}

/**
 * Safe file reading with error handling
 */
export async function safeReadFile(filePath, options = {}) {
  const {
    encoding = 'utf8',
    checkIntegrity = true,
    resolveSymlinks: resolveLinks = true
  } = options;

  try {
    // Resolve symlinks if requested
    let targetPath = filePath;
    if (resolveLinks) {
      const symlinkResult = await resolveSymlinks(filePath);
      if (symlinkResult.error) {
        return { success: false, error: symlinkResult.error };
      }
      targetPath = symlinkResult.resolvedPath;
    }
    
    // Check file integrity if requested
    if (checkIntegrity) {
      const integrityResult = await checkFileIntegrity(targetPath);
      if (!integrityResult.valid) {
        return { success: false, error: integrityResult.error };
      }
    }
    
    // Read file with encoding detection
    const encodingResult = await detectEncoding(targetPath);
    if (!encodingResult.valid) {
      return { success: false, error: encodingResult.error };
    }
    
    const content = await fs.promises.readFile(targetPath, encodingResult.encoding);
    
    return {
      success: true,
      content,
      encoding: encodingResult.encoding,
      filePath: targetPath
    };
  } catch (error) {
    return {
      success: false,
      error: new FileSystemError(FS_ERROR_TYPES.PERMISSION_DENIED,
        `Failed to read file: ${error.message}`, {
          filePath,
          operation: 'safe_read',
          originalError: error.message
        }
      )
    };
  }
}

/**
 * Create directory with proper error handling
 */
export async function safeCreateDirectory(dirPath, options = {}) {
  const {
    recursive = true,
    mode = 0o755
  } = options;

  try {
    // Validate path
    const pathValidation = validatePath(dirPath, { operation: 'create_directory' });
    if (!pathValidation.valid) {
      return { success: false, errors: pathValidation.errors };
    }
    
    // Check if directory already exists
    if (fs.existsSync(dirPath)) {
      const stats = fs.statSync(dirPath);
      if (stats.isDirectory()) {
        return { success: true, existed: true };
      } else {
        return {
          success: false,
          error: new FileSystemError(FS_ERROR_TYPES.PERMISSION_DENIED,
            `Path exists but is not a directory: ${dirPath}`, {
              filePath: dirPath,
              operation: 'create_directory',
              isFile: stats.isFile()
            }
          )
        };
      }
    }
    
    // Create directory
    await fs.promises.mkdir(dirPath, { recursive, mode });
    
    return { success: true, existed: false };
  } catch (error) {
    return {
      success: false,
      error: new FileSystemError(FS_ERROR_TYPES.MISSING_DIRECTORY,
        `Failed to create directory: ${error.message}`, {
          filePath: dirPath,
          operation: 'create_directory',
          originalError: error.message
        }
      )
    };
  }
}

/**
 * Comprehensive file system validation
 */
export async function validateFileSystem(filePath, context = {}) {
  const errors = [];
  
  // Path validation
  const pathValidation = validatePath(filePath, context);
  if (!pathValidation.valid) {
    errors.push(...pathValidation.errors);
  }
  
  // Directory validation
  const dirPath = path.dirname(filePath);
  const dirValidation = await checkDirectory(dirPath, { ...context, requireWrite: true });
  if (!dirValidation.valid) {
    errors.push(...dirValidation.errors);
  }
  
  // Disk space check
  const spaceCheck = await checkDiskSpace(dirPath);
  if (!spaceCheck.sufficient) {
    errors.push(spaceCheck.error);
  }
  
  // File size check if file exists
  if (fs.existsSync(filePath)) {
    const sizeCheck = checkFileSize(filePath);
    if (!sizeCheck.withinLimit) {
      errors.push(sizeCheck.error);
    }
  }
  
  // Symlink resolution
  const symlinkResult = await resolveSymlinks(filePath);
  if (symlinkResult.error) {
    errors.push(symlinkResult.error);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    symlinkInfo: symlinkResult
  };
}

/**
 * Get file system information for debugging
 */
export function getFileSystemInfo(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const dirPath = path.dirname(filePath);
    const dirStats = fs.statSync(dirPath);
    
    return {
      file: {
        exists: true,
        size: stats.size,
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid,
        atime: stats.atime,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymbolicLink: stats.isSymbolicLink()
      },
      directory: {
        path: dirPath,
        exists: true,
        mode: dirStats.mode,
        uid: dirStats.uid,
        gid: dirStats.gid
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        homedir: os.homedir(),
        tmpdir: os.tmpdir(),
        freemem: os.freemem(),
        totalmem: os.totalmem()
      }
    };
  } catch (error) {
    return {
      error: error.message,
      file: { exists: false },
      directory: { exists: false },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        homedir: os.homedir(),
        tmpdir: os.tmpdir()
      }
    };
  }
} 