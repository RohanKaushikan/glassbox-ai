import { Command } from 'commander';
import chalk from 'chalk';
import { CacheManager } from '../cache/cache-manager.js';
import ora from 'ora';

/**
 * Cache management commands
 */
export function createCacheCommands() {
  const cache = new Command('cache')
    .description('Manage AI response cache')
    .option('-d, --cache-dir <path>', 'Cache directory path', '.glassbox-cache');

  // Stats command
  cache.command('stats')
    .description('Show cache statistics')
    .action(async (options) => {
      const spinner = ora('Loading cache statistics...').start();
      
      try {
        const cacheManager = new CacheManager({ cacheDir: options.cacheDir });
        await cacheManager.initialize();
        const stats = cacheManager.getStats();
        
        spinner.succeed('Cache statistics loaded');
        
        console.log('\n' + chalk.bold.blue('Cache Statistics:'));
        console.log(chalk.gray('─'.repeat(50)));
        
        console.log(`${chalk.cyan('Hits:')} ${stats.hits}`);
        console.log(`${chalk.cyan('Misses:')} ${stats.misses}`);
        console.log(`${chalk.cyan('Hit Rate:')} ${stats.hitRate}`);
        console.log(`${chalk.cyan('Writes:')} ${stats.writes}`);
        console.log(`${chalk.cyan('Invalidations:')} ${stats.invalidations}`);
        console.log(`${chalk.cyan('Errors:')} ${stats.errors}`);
        
        console.log('\n' + chalk.bold.blue('Storage:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(`${chalk.cyan('Entries:')} ${stats.entryCount}`);
        console.log(`${chalk.cyan('Size:')} ${stats.cacheSize}`);
        console.log(`${chalk.cyan('Max Size:')} ${stats.maxSize}`);
        console.log(`${chalk.cyan('Usage:')} ${stats.usagePercent}%`);
        
        if (stats.lastCleanup) {
          console.log(`${chalk.cyan('Last Cleanup:')} ${new Date(stats.lastCleanup).toLocaleString()}`);
        }
        
      } catch (error) {
        spinner.fail('Failed to load cache statistics');
        console.error(chalk.red('Error:'), error.message);
      }
    });

  // List command
  cache.command('list')
    .description('List all cache entries')
    .option('-l, --limit <number>', 'Limit number of entries to show', '20')
    .option('--show-content', 'Show response content preview')
    .action(async (options) => {
      const spinner = ora('Loading cache entries...').start();
      
      try {
        const cacheManager = new CacheManager({ cacheDir: options.cacheDir });
        await cacheManager.initialize();
        const entries = await cacheManager.listEntries();
        
        spinner.succeed(`Found ${entries.length} cache entries`);
        
        const limit = parseInt(options.limit);
        const displayEntries = entries.slice(0, limit);
        
        console.log('\n' + chalk.bold.blue(`Cache Entries (showing ${displayEntries.length}/${entries.length}):`));
        console.log(chalk.gray('─'.repeat(80)));
        
        for (const entry of displayEntries) {
          const age = Math.floor((Date.now() - entry.createdAt) / (1000 * 60 * 60 * 24));
          const expiresIn = Math.floor((entry.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          
          console.log(chalk.bold.green(`Key: ${entry.key.substring(0, 16)}...`));
          console.log(`  Model: ${chalk.cyan(entry.model)}`);
          console.log(`  Age: ${chalk.yellow(age)} days`);
          console.log(`  Expires in: ${chalk.yellow(expiresIn)} days`);
          console.log(`  Size: ${chalk.gray(entry.compressedSize)} bytes (${entry.compressionRatio}% compressed)`);
          
          if (options.showContent) {
            const preview = entry.response?.content?.substring(0, 100) || entry.response?.substring(0, 100) || 'No content';
            console.log(`  Preview: ${chalk.gray(preview)}...`);
          }
          
          console.log('');
        }
        
        if (entries.length > limit) {
          console.log(chalk.gray(`... and ${entries.length - limit} more entries`));
        }
        
      } catch (error) {
        spinner.fail('Failed to load cache entries');
        console.error(chalk.red('Error:'), error.message);
      }
    });

  // Clear command
  cache.command('clear')
    .description('Clear all cache entries')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options) => {
      if (!options.force) {
        console.log(chalk.yellow('This will delete all cached AI responses.'));
        const readline = (await import('readline')).createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question('Are you sure? (y/N): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray('Operation cancelled'));
          return;
        }
      }
      
      const spinner = ora('Clearing cache...').start();
      
      try {
        const cacheManager = new CacheManager({ cacheDir: options.cacheDir });
        await cacheManager.initialize();
        await cacheManager.clear();
        
        spinner.succeed('Cache cleared successfully');
        console.log(chalk.green('All cached responses have been removed'));
        
      } catch (error) {
        spinner.fail('Failed to clear cache');
        console.error(chalk.red('Error:'), error.message);
      }
    });

  // Cleanup command
  cache.command('cleanup')
    .description('Clean up expired entries and enforce size limits')
    .action(async (options) => {
      const spinner = ora('Cleaning up cache...').start();
      
      try {
        const cacheManager = new CacheManager({ cacheDir: options.cacheDir });
        await cacheManager.initialize();
        
        const beforeStats = cacheManager.getStats();
        await cacheManager.cleanup();
        const afterStats = cacheManager.getStats();
        
        const removedEntries = beforeStats.entryCount - afterStats.entryCount;
        const freedSpace = beforeStats.totalSize - afterStats.totalSize;
        
        spinner.succeed('Cache cleanup completed');
        
        if (removedEntries > 0) {
          console.log(chalk.green(`Removed ${removedEntries} expired entries`));
          console.log(chalk.green(`Freed ${cacheManager.formatBytes(freedSpace)} of space`));
        } else {
          console.log(chalk.gray('No expired entries found'));
        }
        
      } catch (error) {
        spinner.fail('Failed to cleanup cache');
        console.error(chalk.red('Error:'), error.message);
      }
    });

  // Details command
  cache.command('details <key>')
    .description('Show detailed information about a cache entry')
    .action(async (key, options) => {
      const spinner = ora('Loading entry details...').start();
      
      try {
        const cacheManager = new CacheManager({ cacheDir: options.cacheDir });
        await cacheManager.initialize();
        const details = await cacheManager.getEntryDetails(key);
        
        if (!details) {
          spinner.fail('Cache entry not found');
          console.error(chalk.red('Error:'), 'No cache entry found with the specified key');
          return;
        }
        
        spinner.succeed('Entry details loaded');
        
        console.log('\n' + chalk.bold.blue('Cache Entry Details:'));
        console.log(chalk.gray('─'.repeat(80)));
        
        console.log(`${chalk.cyan('Key:')} ${details.key}`);
        console.log(`${chalk.cyan('Model:')} ${details.model}`);
        console.log(`${chalk.cyan('Created:')} ${new Date(details.createdAt).toLocaleString()}`);
        console.log(`${chalk.cyan('Expires:')} ${new Date(details.expiresAt).toLocaleString()}`);
        console.log(`${chalk.cyan('Age:')} ${Math.floor((Date.now() - details.createdAt) / (1000 * 60 * 60 * 24))} days`);
        console.log(`${chalk.cyan('Expires in:')} ${Math.floor((details.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))} days`);
        
        console.log('\n' + chalk.bold.blue('Storage:'));
        console.log(`${chalk.cyan('Compressed Size:')} ${details.compressedSize} bytes`);
        console.log(`${chalk.cyan('Uncompressed Size:')} ${details.uncompressedSize} bytes`);
        console.log(`${chalk.cyan('Compression Ratio:')} ${details.compressionRatio}%`);
        
        console.log('\n' + chalk.bold.blue('Parameters:'));
        if (details.additionalParams && Object.keys(details.additionalParams).length > 0) {
          for (const [param, value] of Object.entries(details.additionalParams)) {
            console.log(`  ${chalk.cyan(param)}: ${value}`);
          }
        } else {
          console.log(chalk.gray('  No additional parameters'));
        }
        
        console.log('\n' + chalk.bold.blue('Prompt:'));
        console.log(chalk.gray(details.prompt));
        
        console.log('\n' + chalk.bold.blue('Response:'));
        const response = details.response?.content || details.response || 'No response content';
        console.log(chalk.gray(response.substring(0, 500) + (response.length > 500 ? '...' : '')));
        
      } catch (error) {
        spinner.fail('Failed to load entry details');
        console.error(chalk.red('Error:'), error.message);
      }
    });

  // Invalidate command
  cache.command('invalidate <key>')
    .description('Invalidate a specific cache entry')
    .action(async (key, options) => {
      const spinner = ora('Invalidating cache entry...').start();
      
      try {
        const cacheManager = new CacheManager({ cacheDir: options.cacheDir });
        await cacheManager.initialize();
        await cacheManager.invalidate(key);
        
        spinner.succeed('Cache entry invalidated');
        console.log(chalk.green(`Entry ${key} has been removed from cache`));
        
      } catch (error) {
        spinner.fail('Failed to invalidate cache entry');
        console.error(chalk.red('Error:'), error.message);
      }
    });

  return cache;
} 