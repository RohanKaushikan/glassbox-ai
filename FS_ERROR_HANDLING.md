# File System Error Handling System

The Glassbox CLI includes a comprehensive file system error handling system that provides robust handling for file system issues across different operating systems and file system configurations.

## 🎯 Features

### 1. Missing Directories and Permission Issues
- **Directory existence validation** with helpful error messages
- **Permission checking** for read/write access
- **Safe directory creation** with proper error handling
- **Cross-platform permission handling** (Unix/Windows)

### 2. Disk Space and File Size Limitations
- **Disk space monitoring** with configurable thresholds
- **File size validation** with maximum limits
- **Space requirement checking** before operations
- **Memory availability monitoring**

### 3. Different Operating Systems (Windows paths, etc.)
- **OS-specific path validation** (Windows 260 char limit, Unix 4096 char limit)
- **Invalid character detection** per OS
- **Path length enforcement** with helpful error messages
- **Cross-platform compatibility** handling

### 4. Concurrent File Access and Locking Issues
- **File locking mechanism** with timeout handling
- **Stale lock detection** and cleanup
- **Atomic file operations** to prevent corruption
- **Concurrent access prevention** with proper error messages

### 5. Corrupted or Partially Written Files
- **File integrity checking** with corruption detection
- **Backup creation** before file modifications
- **Atomic write operations** to prevent partial writes
- **Corruption indicator detection** (null bytes, replacement characters)

### 6. Unicode and Encoding Problems
- **Multi-encoding support** (UTF-8, ASCII, Latin-1)
- **Encoding detection** with fallback mechanisms
- **Encoding error handling** with clear error messages
- **Character validation** and sanitization

### 7. Symlinks and Unusual File System Configurations
- **Symlink resolution** with error handling
- **Real path detection** for complex file systems
- **Symlink validation** and permission checking
- **Cross-platform symlink support**

## 🛠️ Core Components

### File System Error Handler (`src/fs-error-handler.js`)
- **FileSystemError class** with enhanced context
- **Path validation** for different operating systems
- **Directory checking** with permission validation
- **Disk space monitoring** with configurable thresholds
- **File locking** with timeout and stale lock handling
- **Safe file operations** with atomic writes and backups

### Error Types
```javascript
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
```

### Configuration
```javascript
const FS_CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MIN_DISK_SPACE: 50 * 1024 * 1024, // 50MB
  LOCK_TIMEOUT: 30000, // 30 seconds
  ENCODINGS: ['utf8', 'utf-8', 'ascii', 'latin1'],
  WINDOWS_PATH_MAX: 260,
  UNIX_PATH_MAX: 4096
};
```

## 📊 Error Handling Examples

### Path Validation
```javascript
// Check if path is valid for current OS
const validation = validatePath('/path/to/file.txt', { operation: 'read' });
if (!validation.valid) {
  validation.errors.forEach(error => {
    console.error(error.message);
  });
}
```

### Directory Checking
```javascript
// Check directory existence and permissions
const dirCheck = await checkDirectory('/path/to/dir', { 
  operation: 'write',
  requireWrite: true 
});
if (!dirCheck.valid) {
  dirCheck.errors.forEach(error => {
    console.error(error.message);
  });
}
```

### Disk Space Monitoring
```javascript
// Check available disk space
const spaceCheck = await checkDiskSpace('/path/to/dir', 1024 * 1024); // 1MB required
if (!spaceCheck.sufficient) {
  console.error(spaceCheck.error.message);
}
```

### File Locking
```javascript
// Safe file operations with locking
const lock = new FileLock('/path/to/file.txt');
try {
  await lock.acquire();
  // Perform file operations
  await fs.promises.writeFile('/path/to/file.txt', content);
} finally {
  await lock.release();
}
```

### Safe File Reading
```javascript
// Read file with comprehensive error handling
const readResult = await safeReadFile('/path/to/file.txt', {
  checkIntegrity: true,
  resolveSymlinks: true
});

if (readResult.success) {
  console.log('File content:', readResult.content);
  console.log('Detected encoding:', readResult.encoding);
} else {
  console.error('Read failed:', readResult.error.message);
}
```

### Safe File Writing
```javascript
// Write file with atomic operations and backup
const writeResult = await safeWriteFile('/path/to/file.txt', content, {
  atomic: true,
  backup: true,
  encoding: 'utf8'
});

if (writeResult.success) {
  console.log('File written successfully');
} else {
  console.error('Write failed:', writeResult.error.message);
}
```

## 🔧 OS-Specific Handling

### Windows Path Issues
- **Path length limits**: 260 characters maximum
- **Invalid characters**: `< > : " | ? *`
- **Directory traversal**: `..` and `~` detection
- **Case sensitivity**: Insensitive path handling

### Unix/Linux Path Issues
- **Path length limits**: 4096 characters maximum
- **Invalid characters**: Null bytes (`\0`)
- **Permission checking**: Read/write/execute permissions
- **Symlink handling**: Proper resolution and validation

### Cross-Platform Compatibility
```javascript
// Platform-specific path validation
const maxPathLength = os.platform() === 'win32' ? 260 : 4096;
const invalidChars = os.platform() === 'win32' 
  ? /[<>:"|?*]/g 
  : /[\0]/g;
```

## 🔒 File Locking System

### Lock Acquisition
```javascript
const lock = new FileLock('/path/to/file.txt');
await lock.acquire(30000); // 30 second timeout
```

### Stale Lock Detection
```javascript
// Automatic stale lock cleanup
if (lockAge > timeout) {
  await fs.promises.unlink(lockPath);
}
```

### Lock Release
```javascript
// Always release locks in finally block
try {
  await lock.acquire();
  // File operations
} finally {
  await lock.release();
}
```

## 🛡️ Security Features

### Path Validation
- **Directory traversal prevention**: `..` and `~` detection
- **Invalid character filtering**: OS-specific character validation
- **Path length enforcement**: Platform-specific limits
- **Symlink resolution**: Safe symlink handling

### File Operations
- **Atomic writes**: Prevent partial file corruption
- **Backup creation**: Automatic backup before modifications
- **Integrity checking**: Corruption detection
- **Permission validation**: Read/write permission checking

## 📝 Logging and Monitoring

### File System Logging
```javascript
logger.info('File operation started', {
  filePath: '/path/to/file.txt',
  operation: 'write',
  fileSize: content.length
});

logger.error('File operation failed', {
  filePath: '/path/to/file.txt',
  error: error.type,
  message: error.message
});
```

### Error Statistics
```javascript
{
  totalErrors: 25,
  errorTypes: {
    PERMISSION_DENIED: 8,
    MISSING_DIRECTORY: 5,
    FILE_CORRUPTION: 3,
    ENCODING_ERROR: 2,
    DISK_SPACE_FULL: 2,
    OS_PATH_ISSUE: 3,
    CONCURRENT_ACCESS: 2
  }
}
```

## 🔍 Diagnostics

### File System Diagnostics Command
```bash
# Check file system health
glassbox diagnose --check-fs

# Check specific aspects
glassbox diagnose --check-fs --check-api
```

### Diagnostic Output
```
💾 Checking file system...

✓ Test directory accessible
✓ Sufficient disk space: 15.2GB available
✓ File system information:
  Platform: darwin
  Architecture: arm64
  Home directory: /Users/username
  Temp directory: /var/folders/...
```

## 🚨 Error Severity Levels

### LOW
- **Impact**: Minimal functionality impact
- **Action**: Log and continue
- **Examples**: Encoding warnings, symlink info

### MEDIUM
- **Impact**: Some functionality degraded
- **Action**: Retry with backoff
- **Examples**: File size limits, path issues

### HIGH
- **Impact**: Significant functionality impact
- **Action**: Retry with longer backoff
- **Examples**: Permission denied, missing directories

### CRITICAL
- **Impact**: System unusable
- **Action**: Immediate attention required
- **Examples**: Disk space full, file corruption

## 🔧 Configuration Options

### Environment Variables
```bash
# File system configuration
export GLASSBOX_MAX_FILE_SIZE="104857600"  # 100MB
export GLASSBOX_MIN_DISK_SPACE="52428800"  # 50MB
export GLASSBOX_LOCK_TIMEOUT="30000"       # 30 seconds
```

### CLI Options
```bash
# File system diagnostics
glassbox diagnose --check-fs

# Verbose file system output
glassbox test --verbose
```

## 📈 Performance Monitoring

### File System Metrics
- **File operation success rate**
- **Average operation time**
- **Error rate by type**
- **Disk space usage**

### Monitoring Commands
```bash
# Check file system health
glassbox diagnose --check-fs

# View error statistics
glassbox health --verbose

# Monitor file operations
tail -f .glassbox/error.log | grep "fs"
```

## 🛠️ Troubleshooting Guide

### Common Issues

1. **Permission Denied**
   ```bash
   # Check file permissions
   ls -la /path/to/file
   
   # Fix permissions
   chmod 644 /path/to/file
   chown username:group /path/to/file
   ```

2. **Disk Space Full**
   ```bash
   # Check disk space
   df -h
   
   # Clean up space
   rm -rf /tmp/*
   ```

3. **File Corruption**
   ```bash
   # Check file integrity
   file /path/to/file
   
   # Restore from backup
   cp /path/to/file.backup /path/to/file
   ```

4. **Encoding Issues**
   ```bash
   # Check file encoding
   file -i /path/to/file
   
   # Convert encoding
   iconv -f ISO-8859-1 -t UTF-8 /path/to/file
   ```

### Debug Commands
```bash
# Check file system info
glassbox diagnose --check-fs

# View detailed file system logs
tail -f .glassbox/error.log

# Test file operations
glassbox test --verbose
```

## 🎉 Success Metrics

- ✅ **10 file system error types** comprehensively handled
- ✅ **Cross-platform compatibility** (Windows, Unix, macOS)
- ✅ **Atomic file operations** with backup support
- ✅ **File locking system** with stale lock detection
- ✅ **Encoding detection** with multi-encoding support
- ✅ **Symlink handling** with proper resolution
- ✅ **Disk space monitoring** with configurable thresholds
- ✅ **Permission validation** with detailed error messages
- ✅ **File integrity checking** with corruption detection

## 🚀 Benefits

1. **Reliability**: Robust file system operations prevent data loss
2. **Cross-Platform**: Works consistently across different operating systems
3. **Security**: Path validation and permission checking prevent vulnerabilities
4. **Observability**: Comprehensive logging for debugging file system issues
5. **User Experience**: Clear error messages with helpful suggestions
6. **Maintainability**: Structured error handling system
7. **Performance**: Efficient file operations with proper locking
8. **Flexibility**: Configurable thresholds and timeouts

The file system error handling system provides production-ready file operations with comprehensive error handling, cross-platform compatibility, and robust security features. 