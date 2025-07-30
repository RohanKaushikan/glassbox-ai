import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

/**
 * Platform utilities for cross-platform compatibility
 */
export class PlatformUtils {
  constructor() {
    this.platform = os.platform();
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
    this.isUnix = this.isMac || this.isLinux;
  }

  /**
   * Get platform-specific path separator
   */
  getPathSeparator() {
    return this.isWindows ? '\\' : '/';
  }

  /**
   * Normalize path for current platform
   */
  normalizePath(filePath) {
    return path.normalize(filePath);
  }

  /**
   * Join paths using platform-specific separator
   */
  joinPaths(...paths) {
    return path.join(...paths);
  }

  /**
   * Get platform-specific home directory
   */
  getHomeDir() {
    return os.homedir();
  }

  /**
   * Get platform-specific temp directory
   */
  getTempDir() {
    return os.tmpdir();
  }

  /**
   * Get platform-specific cache directory
   */
  getCacheDir() {
    if (this.isWindows) {
      return path.join(process.env.LOCALAPPDATA || os.homedir(), 'glassbox-cache');
    } else if (this.isMac) {
      return path.join(os.homedir(), 'Library', 'Caches', 'glassbox');
    } else {
      return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'glassbox');
    }
  }

  /**
   * Get platform-specific config directory
   */
  getConfigDir() {
    if (this.isWindows) {
      return path.join(process.env.APPDATA || os.homedir(), 'glassbox');
    } else if (this.isMac) {
      return path.join(os.homedir(), 'Library', 'Application Support', 'glassbox');
    } else {
      return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'glassbox');
    }
  }

  /**
   * Check if terminal supports colors
   */
  supportsColors() {
    // Check if NO_COLOR environment variable is set
    if (process.env.NO_COLOR) {
      return false;
    }

    // Check if FORCE_COLOR is set
    if (process.env.FORCE_COLOR) {
      return true;
    }

    // Check if running in a CI environment
    if (process.env.CI) {
      return false;
    }

    // Check if running in a dumb terminal
    if (process.env.TERM === 'dumb') {
      return false;
    }

    // Platform-specific checks
    if (this.isWindows) {
      // Check if running in Windows Terminal or modern console
      return process.env.TERM_PROGRAM === 'vscode' || 
             process.env.TERM_PROGRAM === 'WindowsTerminal' ||
             process.env.COLORTERM === 'truecolor';
    }

    // Unix-like systems
    return process.env.TERM && process.env.TERM !== 'dumb';
  }

  /**
   * Get platform-specific shell command
   */
  getShellCommand() {
    if (this.isWindows) {
      return 'powershell.exe';
    }
    return 'bash';
  }

  /**
   * Get platform-specific environment variable syntax
   */
  getEnvVarSyntax(varName, value) {
    if (this.isWindows) {
      return `$env:${varName}="${value}"`;
    }
    return `${varName}="${value}"`;
  }

  /**
   * Set environment variable for current platform
   */
  setEnvVar(varName, value) {
    if (this.isWindows) {
      try {
        execSync(`powershell.exe -Command "[Environment]::SetEnvironmentVariable('${varName}', '${value}', 'Process')"`, { stdio: 'pipe' });
      } catch (error) {
        // Fallback to process.env
        process.env[varName] = value;
      }
    } else {
      process.env[varName] = value;
    }
  }

  /**
   * Get environment variable for current platform
   */
  getEnvVar(varName) {
    return process.env[varName];
  }

  /**
   * Check if running with elevated privileges
   */
  isElevated() {
    if (this.isWindows) {
      try {
        const result = execSync('net session', { stdio: 'pipe' });
        return true;
      } catch (error) {
        return false;
      }
    } else {
      return process.getuid && process.getuid() === 0;
    }
  }

  /**
   * Get platform-specific package manager
   */
  getPackageManager() {
    if (this.isWindows) {
      return 'npm';
    }
    return 'npm'; // Default to npm for all platforms
  }

  /**
   * Install package globally for current platform
   */
  installPackageGlobal(packageName) {
    const manager = this.getPackageManager();
    const command = `${manager} install -g ${packageName}`;
    
    try {
      execSync(command, { stdio: 'inherit' });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        suggestion: this.isElevated() ? 
          'Try running without elevated privileges' : 
          'Try running with elevated privileges'
      };
    }
  }

  /**
   * Check if package is installed globally
   */
  isPackageInstalled(packageName) {
    try {
      execSync(`${this.getPackageManager()} list -g ${packageName}`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get platform-specific file permissions
   */
  getFilePermissions(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return {
        readable: true,
        writable: true,
        executable: this.isUnix ? (stats.mode & 0o111) !== 0 : false,
        mode: stats.mode
      };
    } catch (error) {
      return {
        readable: false,
        writable: false,
        executable: false,
        mode: 0
      };
    }
  }

  /**
   * Set file permissions for current platform
   */
  setFilePermissions(filePath, permissions) {
    try {
      if (this.isUnix) {
        fs.chmodSync(filePath, permissions);
      }
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get platform information
   */
  getPlatformInfo() {
    return {
      platform: this.platform,
      arch: os.arch(),
      version: os.release(),
      hostname: os.hostname(),
      isWindows: this.isWindows,
      isMac: this.isMac,
      isLinux: this.isLinux,
      isUnix: this.isUnix,
      supportsColors: this.supportsColors(),
      isElevated: this.isElevated(),
      homeDir: this.getHomeDir(),
      tempDir: this.getTempDir(),
      cacheDir: this.getCacheDir(),
      configDir: this.getConfigDir()
    };
  }

  /**
   * Create platform-specific directory structure
   */
  createPlatformDirs() {
    const dirs = [
      this.getCacheDir(),
      this.getConfigDir()
    ];

    for (const dir of dirs) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create directory ${dir}: ${error.message}`);
      }
    }

    return dirs;
  }

  /**
   * Get platform-specific error message
   */
  getPlatformErrorMessage(error) {
    if (this.isWindows) {
      if (error.code === 'EACCES') {
        return 'Access denied. Try running as Administrator.';
      }
      if (error.code === 'ENOENT') {
        return 'File or directory not found.';
      }
    } else {
      if (error.code === 'EACCES') {
        return 'Permission denied. Try using sudo.';
      }
      if (error.code === 'ENOENT') {
        return 'File or directory not found.';
      }
    }
    return error.message;
  }
}

// Export singleton instance
export const platformUtils = new PlatformUtils(); 