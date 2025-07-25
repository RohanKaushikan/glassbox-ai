#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { parseTestFiles } from './parser.js';
import { runTests } from './runner.js';

const program = new Command();

async function initCommand() {
  const dir = path.resolve('.glassbox/tests');
  const sampleFile = path.join(dir, 'sample-test.yml');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(chalk.green(`Created directory: ${dir}`));
  } else {
    console.log(chalk.yellow(`Directory already exists: ${dir}`));
  }
  if (!fs.existsSync(sampleFile)) {
    const sampleContent = `name: Sample Test Suite
description: Example test suite for Glassbox CLI.
settings:
  max_tokens: 100
  max_cost_usd: 0.001
  safety_checks:
    block_pii: true
    block_email: true
    block_phone: true
    block_ssn: true

tests:
  - name: Example Test
    description: Checks if the model can say hello.
    prompt: |
      Say hello.
    expect:
      contains: ["hello"]
      not_contains: ["bye"]
`;
    fs.writeFileSync(sampleFile, sampleContent, 'utf8');
    console.log(chalk.green(`Created sample test file: ${sampleFile}`));
  } else {
    console.log(chalk.yellow(`Sample test file already exists: ${sampleFile}`));
  }
}

function versionCommand() {
  const pkgPath = path.resolve('package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(chalk.cyan(`Glassbox CLI version: ${pkg.version}`));
  } catch (err) {
    console.error(chalk.red('Could not read version from package.json'));
  }
}

program
  .name('glassbox')
  .description('A CLI tool for testing AI systems via structured evaluations')
  .version('0.1.0');

program
  .command('test')
  .description('Run AI prompt tests')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    const testDir = path.resolve('.glassbox/tests');
    if (!options.json) console.log(chalk.blue(`Loading tests from: ${testDir}`));
    const testObjects = parseTestFiles(testDir);
    if (!testObjects.length) {
      if (!options.json) console.log(chalk.yellow('No valid test files found.'));
      else console.log(JSON.stringify({ error: 'No valid test files found.' }, null, 2));
      return;
    }
    if (!options.json) console.log(chalk.blue('Running tests...'));
    const results = await runTests(testObjects);
    if (options.json) {
      // Output only relevant fields for each test
      const jsonResults = results.map(r => ({
        suite: r.suite,
        test: r.test,
        pass: r.pass,
        error: r.error,
        details: r.details,
        cost: r.cost,
        durationMs: r.durationMs
      }));
      console.log(JSON.stringify(jsonResults, null, 2));
      return;
    }
    let passed = 0;
    let failed = 0;
    let totalCost = 0;
    for (const result of results) {
      const status = result.pass ? chalk.green('PASS') : chalk.red('FAIL');
      if (result.pass) passed++; else failed++;
      if (result.cost) totalCost += parseFloat(result.cost);
      console.log(`${status} ${chalk.bold(result.suite)} - ${chalk.bold(result.test)} (${result.durationMs}ms)`);
      if (!result.pass) {
        for (const detail of result.details) {
          console.log(chalk.red('  ' + detail));
        }
      }
      if (result.error) {
        console.log(chalk.red('  Error: ' + result.error));
      }
    }
    console.log();
    console.log(chalk.bold('Summary:'));
    console.log(chalk.green(`${passed} passed`), chalk.red(`${failed} failed`), `Total cost: $${totalCost.toFixed(6)}`);
  });

program
  .command('init')
  .description('Create sample .glassbox folder with example tests')
  .action(initCommand);

program
  .command('version')
  .description('Show version number')
  .action(versionCommand);

program.parse(process.argv); 