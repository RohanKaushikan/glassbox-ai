# Platform Compatibility Guide

This document outlines the cross-platform compatibility features and fixes implemented in Glassbox CLI.

## 🖥️ Supported Platforms

### Operating Systems
- **Windows** (Windows 10/11, Windows Server 2019+)
- **macOS** (10.15+)
- **Linux** (Ubuntu 18.04+, CentOS 7+, RHEL 7+)

### Architectures
- **x64** (Intel/AMD 64-bit)
- **arm64** (Apple Silicon, ARM64 Linux)

### Node.js Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher

## 🔧 Platform-Specific Features

### 1. Path Separators and File System Differences

#### Cross-Platform Path Handling
```javascript
import { platformUtils } from './src/utils/platform-utils.js';

// Platform-specific path joining
const filePath = platformUtils.joinPaths('dir', 'subdir', 'file.txt');

// Platform-specific path normalization
const normalizedPath = platformUtils.normalizePath(filePath);

// Platform-specific path separator
const separator = platformUtils.getPathSeparator();
```

#### Directory Structure
- **Windows**: Uses `LOCALAPPDATA` and `APPDATA` environment variables
- **macOS**: Uses `~/Library/Caches` and `~/Library/Application Support`
- **Linux**: Uses XDG Base Directory Specification

### 2. Shell Command Differences

#### Cross-Platform Shell Commands
```javascript
// Platform-specific shell detection
const shell = platformUtils.getShellCommand(); // 'powershell.exe' on Windows, 'bash' on Unix

// Platform-specific environment variable syntax
const envSyntax = platformUtils.getEnvVarSyntax('API_KEY', 'value');
// Windows: $env:API_KEY="value"
// Unix: API_KEY="value"
```

#### GitHub Actions Compatibility
```yaml
# Cross-platform environment variable setting
- name: Set environment variables
  run: |
    if [ "$RUNNER_OS" = "Windows" ]; then
      $env:OPENAI_API_KEY="${{ secrets.OPENAI_API_KEY }}"
    else
      export OPENAI_API_KEY="${{ secrets.OPENAI_API_KEY }}"
    fi
```

### 3. Environment Variable Handling

#### Cross-Platform Environment Variables
```javascript
// Platform-specific environment variable setting
platformUtils.setEnvVar('API_KEY', 'value');

// Platform-specific environment variable retrieval
const apiKey = platformUtils.getEnvVar('API_KEY');
```

#### Environment Variable Detection
- **Windows**: Uses PowerShell for system-wide environment variables
- **Unix**: Uses standard `process.env` with fallback to shell commands

### 4. Package Installation and Permissions

#### Cross-Platform Package Management
```javascript
// Platform-specific package installation
const result = platformUtils.installPackageGlobal('package-name');

// Platform-specific package verification
const isInstalled = platformUtils.isPackageInstalled('package-name');
```

#### Permission Handling
```javascript
// Platform-specific permission checking
const isElevated = platformUtils.isElevated();

// Platform-specific file permissions
const permissions = platformUtils.getFilePermissions(filePath);
platformUtils.setFilePermissions(filePath, 0o644);
```

### 5. Terminal Color Support and Formatting

#### Cross-Platform Color Detection
```javascript
// Platform-specific color support detection
const supportsColors = platformUtils.supportsColors();

// Automatic color fallback
const colors = platformUtils.supportsColors() ? {
  pass: chalk.green,
  fail: chalk.red
} : {
  pass: (text) => text,
  fail: (text) => text
};
```

#### Color Support Factors
- **NO_COLOR**: Disables colors globally
- **FORCE_COLOR**: Forces colors even in non-TTY environments
- **CI**: Disables colors in CI environments
- **TERM**: Checks for dumb terminals
- **Windows**: Checks for modern terminals (Windows Terminal, VS Code)

## 🛠️ Installation and Setup

### Automatic Installation
```bash
# Cross-platform installation script
npm run install

# Or run directly
node scripts/install.js
```

### Manual Installation
```bash
# Install dependencies
npm install

# Install globally (platform-specific)
npm install -g .

# Or use platform-specific package manager
# Windows: npm install -g .
# Unix: npm install -g .
```

### Platform-Specific Directories
```javascript
// Cache directories
Windows: %LOCALAPPDATA%\glassbox-cache
macOS: ~/Library/Caches/glassbox
Linux: ~/.cache/glassbox

// Config directories
Windows: %APPDATA%\glassbox
macOS: ~/Library/Application Support/glassbox
Linux: ~/.config/glassbox
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Permission Denied (Unix)
```bash
# Solution: Use sudo for global installation
sudo npm install -g .

# Or install locally
npm install
node src/index.js
```

#### 2. Permission Denied (Windows)
```bash
# Solution: Run PowerShell as Administrator
# Or use user installation
npm install --prefix ~/.npm-global
```

#### 3. Path Too Long (Windows)
```javascript
// Automatic path length validation
const validation = validatePath(filePath);
if (!validation.valid) {
  console.error('Path too long for Windows (max 260 characters)');
}
```

#### 4. Colors Not Displaying
```javascript
// Automatic color detection
if (!platformUtils.supportsColors()) {
  console.log('Colors disabled - running in non-TTY environment');
}
```

#### 5. Environment Variables Not Set
```javascript
// Platform-specific environment variable setting
if (platformUtils.isWindows) {
  // Use PowerShell for Windows
  execSync(`powershell.exe -Command "[Environment]::SetEnvironmentVariable('API_KEY', 'value', 'Process')"`);
} else {
  // Use standard process.env for Unix
  process.env.API_KEY = 'value';
}
```

### Platform-Specific Error Messages
```javascript
// Platform-specific error handling
const errorMessage = platformUtils.getPlatformErrorMessage(error);

// Windows-specific messages
if (error.code === 'EACCES') {
  return 'Access denied. Try running as Administrator.';
}

// Unix-specific messages
if (error.code === 'EACCES') {
  return 'Permission denied. Try using sudo.';
}
```

## 📊 Platform Information

### Get Platform Details
```javascript
const platformInfo = platformUtils.getPlatformInfo();
console.log(platformInfo);
// Output:
// {
//   platform: 'darwin',
//   arch: 'arm64',
//   version: '22.1.0',
//   hostname: 'macbook-pro',
//   isWindows: false,
//   isMac: true,
//   isLinux: false,
//   isUnix: true,
//   supportsColors: true,
//   isElevated: false,
//   homeDir: '/Users/username',
//   tempDir: '/var/folders/...',
//   cacheDir: '/Users/username/Library/Caches/glassbox',
//   configDir: '/Users/username/Library/Application Support/glassbox'
// }
```

## 🧪 Testing Platform Compatibility

### Run Platform Tests
```bash
# Test platform utilities
node -e "
import { platformUtils } from './src/utils/platform-utils.js';
console.log('Platform:', platformUtils.getPlatformInfo());
"

# Test installation
npm run install

# Test CLI functionality
glassbox --version
glassbox init
glassbox test
```

### Platform-Specific Test Cases
```javascript
// Test path handling
const testPath = platformUtils.joinPaths('dir', 'file.txt');
console.log('Test path:', testPath);

// Test color support
console.log('Colors supported:', platformUtils.supportsColors());

// Test environment variables
platformUtils.setEnvVar('TEST_VAR', 'test_value');
console.log('Test var:', platformUtils.getEnvVar('TEST_VAR'));
```

## 🔄 Migration Guide

### From Platform-Specific Code
```javascript
// Old platform-specific code
const isWindows = os.platform() === 'win32';
const separator = isWindows ? '\\' : '/';

// New cross-platform code
import { platformUtils } from './src/utils/platform-utils.js';
const separator = platformUtils.getPathSeparator();
```

### From Hardcoded Paths
```javascript
// Old hardcoded paths
const cacheDir = path.join(process.cwd(), '.glassbox-cache');

// New platform-specific paths
const cacheDir = platformUtils.getCacheDir();
```

### From Platform-Specific Commands
```javascript
// Old platform-specific commands
const command = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// New cross-platform commands
const command = platformUtils.getShellCommand();
```

## 📚 Additional Resources

- [Node.js Platform Compatibility](https://nodejs.org/api/os.html)
- [Cross-Platform Development Best Practices](https://docs.npmjs.com/cli/v8/using-npm/developers)
- [GitHub Actions Platform Support](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners)

## 🤝 Contributing

When contributing to platform compatibility:

1. **Test on multiple platforms** before submitting changes
2. **Use platform utilities** instead of hardcoded platform checks
3. **Follow platform conventions** for paths, permissions, and commands
4. **Document platform-specific behavior** in comments
5. **Add platform-specific tests** for new features

### Platform Testing Checklist
- [ ] Windows 10/11
- [ ] macOS 10.15+
- [ ] Ubuntu 18.04+
- [ ] CentOS 7+
- [ ] Node.js 18+
- [ ] npm 8+
- [ ] x64 architecture
- [ ] arm64 architecture (if applicable) 