#!/usr/bin/env node
import { Command } from 'commander';
import { testCommand } from './commands/test.js';
import { initCommand } from './commands/init.js';
import { versionCommand } from './commands/version.js';

const program = new Command();

program
  .name('glassbox')
  .description('A CLI tool for testing AI systems via structured evaluations')
  .version('0.1.0');

program
  .command('test')
  .description('Run AI prompt tests')
  .action(testCommand);

program
  .command('init')
  .description('Create sample .glassbox folder with example tests')
  .action(initCommand);

program
  .command('version')
  .description('Show version number')
  .action(versionCommand);

if (process.argv.length <= 2) {
  console.error('No command provided. See help below:');
  program.help({ error: true });
}

program.parse(process.argv); 