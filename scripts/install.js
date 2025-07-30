#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { platformUtils } from '../src/utils/platform-utils.js';

/**
 * Cross-platform installation script for Glassbox CLI
 */
class Installer {
  constructor() {
    this.platform = platformUtils.getPlatformInfo();
  }

  /**
   * Check system requirements
   */
  checkRequirements() {
    console.log('🔍 Checking system requirements...');
    
    const requirements = {
      node: this.checkNodeVersion(),
      npm: this.checkNpmVersion(),
      permissions: this.checkPermissions(),
      directories: this.checkDirectories()
    };

    const allMet = Object.values(requirements).every(req => req.met);
    
    if (!allMet) {
      console.log('❌ System requirements not met:');
      Object.entries(requirements).forEach(([name, req]) => {
        if (!req.met) {
          console.log(`   • ${name}: ${req.message}`);
        }
      });
      return false;
    }

    console.log('✅ All system requirements met');
    return true;
  }

  /**
   * Check Node.js version
   */
  checkNodeVersion() {
    try {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      
      if (major >= 18) {
        return { met: true, message: `Node.js ${version}` };
      } else {
        return { 
          met: false, 
          message: `Node.js ${version} (requires 18+)` 
        };
      }
    } catch (error) {
      return { met: false, message: 'Node.js not found' };
    }
  }

  /**
   * Check npm version
   */
  checkNpmVersion() {
    try {
      const version = execSync('npm --version', { encoding: 'utf8' }).trim();
      const major = parseInt(version.split('.')[0]);
      
      if (major >= 8) {
        return { met: true, message: `npm ${version}` };
      } else {
        return { 
          met: false, 
          message: `npm ${version} (requires 8+)` 
        };
      }
    } catch (error) {
      return { met: false, message: 'npm not found' };
    }
  }

  /**
   * Check permissions
   */
  checkPermissions() {
    if (platformUtils.isElevated()) {
      return { met: true, message: 'Running with elevated privileges' };
    } else {
      return { met: true, message: 'Running with user privileges' };
    }
  }

  /**
   * Check directories
   */
  checkDirectories() {
    const dirs = [
      platformUtils.getCacheDir(),
      platformUtils.getConfigDir()
    ];

    const writable = dirs.every(dir => {
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
      } catch (error) {
        return false;
      }
    });

    if (writable) {
      return { met: true, message: 'Directories writable' };
    } else {
      return { met: false, message: 'Some directories not writable' };
    }
  }

  /**
   * Install dependencies
   */
  installDependencies() {
    console.log('📦 Installing dependencies...');
    
    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('✅ Dependencies installed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error.message);
      return false;
    }
  }

  /**
   * Install globally
   */
  installGlobal() {
    console.log('🌍 Installing Glassbox CLI globally...');
    
    try {
      const result = platformUtils.installPackageGlobal('.');
      
      if (result.success) {
        console.log('✅ Glassbox CLI installed globally');
        return true;
      } else {
        console.error('❌ Failed to install globally:', result.error);
        console.log('💡 Suggestion:', result.suggestion);
        return false;
      }
    } catch (error) {
      console.error('❌ Installation failed:', error.message);
      return false;
    }
  }

  /**
   * Create platform directories
   */
  createDirectories() {
    console.log('📁 Creating platform directories...');
    
    try {
      const dirs = platformUtils.createPlatformDirs();
      console.log('✅ Created directories:', dirs);
      return true;
    } catch (error) {
      console.error('❌ Failed to create directories:', error.message);
      return false;
    }
  }

  /**
   * Set up environment
   */
  setupEnvironment() {
    console.log('🔧 Setting up environment...');
    
    // Create .glassbox directory in current working directory
    const glassboxDir = platformUtils.joinPaths(process.cwd(), '.glassbox');
    const testsDir = platformUtils.joinPaths(glassboxDir, 'tests');
    
    try {
      fs.mkdirSync(testsDir, { recursive: true });
      console.log('✅ Created test directory:', testsDir);
      return true;
    } catch (error) {
      console.error('❌ Failed to create test directory:', error.message);
      return false;
    }
  }

  /**
   * Verify installation
   */
  verifyInstallation() {
    console.log('🔍 Verifying installation...');
    
    try {
      // Check if glassbox command is available
      execSync('glassbox --version', { stdio: 'pipe' });
      console.log('✅ Glassbox CLI is available');
      return true;
    } catch (error) {
      console.error('❌ Glassbox CLI not found in PATH');
      return false;
    }
  }

  /**
   * Display platform information
   */
  displayPlatformInfo() {
    console.log('📊 Platform Information:');
    console.log(`   • Platform: ${this.platform.platform}`);
    console.log(`   • Architecture: ${this.platform.arch}`);
    console.log(`   • Version: ${this.platform.version}`);
    console.log(`   • Hostname: ${this.platform.hostname}`);
    console.log(`   • Colors Supported: ${this.platform.supportsColors ? 'Yes' : 'No'}`);
    console.log(`   • Elevated: ${this.platform.isElevated ? 'Yes' : 'No'}`);
    console.log(`   • Home Directory: ${this.platform.homeDir}`);
    console.log(`   • Cache Directory: ${this.platform.cacheDir}`);
    console.log(`   • Config Directory: ${this.platform.configDir}`);
  }

  /**
   * Run installation
   */
  async install() {
    console.log('🚀 Starting Glassbox CLI installation...');
    console.log('='.repeat(50));
    
    this.displayPlatformInfo();
    console.log('');
    
    // Check requirements
    if (!this.checkRequirements()) {
      process.exit(1);
    }
    
    // Install dependencies
    if (!this.installDependencies()) {
      process.exit(1);
    }
    
    // Create directories
    if (!this.createDirectories()) {
      process.exit(1);
    }
    
    // Setup environment
    if (!this.setupEnvironment()) {
      process.exit(1);
    }
    
    // Install globally
    if (!this.installGlobal()) {
      console.log('⚠️  Global installation failed, but local installation succeeded');
      console.log('💡 You can run the CLI with: node src/index.js');
    }
    
    // Verify installation
    if (!this.verifyInstallation()) {
      console.log('⚠️  Installation verification failed');
      console.log('💡 You can still run the CLI locally');
    }
    
    console.log('');
    console.log('🎉 Installation completed!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Set your API keys as environment variables');
    console.log('   2. Run: glassbox init');
    console.log('   3. Run: glassbox test');
    console.log('');
    console.log('📚 Documentation: https://github.com/your-repo/glassbox');
  }
}

// Run installation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const installer = new Installer();
  installer.install().catch(error => {
    console.error('💥 Installation failed:', error.message);
    process.exit(1);
  });
}

export { Installer }; 