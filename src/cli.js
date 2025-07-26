#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { parseTestFiles } from './parser.js';
import { runTests } from './runner.js';

const program = new Command();

// CLI configuration
const CLI_CONFIG = {
  colors: {
    pass: chalk.green,
    fail: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    highlight: chalk.cyan,
    muted: chalk.gray
  },
  symbols: {
    pass: '✓',
    fail: '✗',
    warning: '⚠',
    info: 'ℹ',
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  }
};

// Error types for better categorization
const ERROR_TYPES = {
  USER_ERROR: 'USER_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR'
};

// Documentation URLs
const DOCS = {
  gettingStarted: 'https://github.com/your-repo/glassbox#getting-started',
  testFormat: 'https://github.com/your-repo/glassbox#test-format',
  troubleshooting: 'https://github.com/your-repo/glassbox#troubleshooting',
  configuration: 'https://github.com/your-repo/glassbox#configuration'
};

// Available models
const AVAILABLE_MODELS = {
  local: ['mistral:7b', 'llama2:7b', 'codellama:7b'],
  openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
  anthropic: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus']
};

// Export formats
const EXPORT_FORMATS = {
  json: 'JSON',
  xml: 'XML',
  html: 'HTML',
  csv: 'CSV'
};

let isVerbose = false;
let isQuiet = false;
let spinnerInterval = null;
let spinnerIndex = 0;

/**
 * Export results to different formats
 * @param {object} results - Test results
 * @param {string} format - Export format
 * @param {string} outputPath - Output file path
 */
function exportResults(results, format, outputPath = null) {
  const { aggregated, raw } = results;
  
  switch (format.toLowerCase()) {
    case 'json':
      const jsonOutput = JSON.stringify(results.machineReadable, null, 2);
      if (outputPath) {
        fs.writeFileSync(outputPath, jsonOutput);
        console.log(CLI_CONFIG.colors.success(`✓ Results exported to: ${outputPath}`));
      } else {
        console.log(jsonOutput);
      }
      break;
      
    case 'xml':
      const xmlOutput = generateXMLReport(results);
      if (outputPath) {
        fs.writeFileSync(outputPath, xmlOutput);
        console.log(CLI_CONFIG.colors.success(`✓ Results exported to: ${outputPath}`));
      } else {
        console.log(xmlOutput);
      }
      break;
      
    case 'html':
      const htmlOutput = generateHTMLReport(results);
      if (outputPath) {
        fs.writeFileSync(outputPath, htmlOutput);
        console.log(CLI_CONFIG.colors.success(`✓ Results exported to: ${outputPath}`));
      } else {
        console.log(htmlOutput);
      }
      break;
      
    case 'csv':
      const csvOutput = generateCSVReport(results);
      if (outputPath) {
        fs.writeFileSync(outputPath, csvOutput);
        console.log(CLI_CONFIG.colors.success(`✓ Results exported to: ${outputPath}`));
      } else {
        console.log(csvOutput);
      }
      break;
      
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Generate XML report
 * @param {object} results - Test results
 * @returns {string} XML report
 */
function generateXMLReport(results) {
  const { aggregated, raw } = results;
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<testResults>\n';
  xml += `  <summary>\n`;
  xml += `    <total>${aggregated.summary.total}</total>\n`;
  xml += `    <passed>${aggregated.summary.passed}</passed>\n`;
  xml += `    <failed>${aggregated.summary.failed}</failed>\n`;
  xml += `    <successRate>${aggregated.summary.successRate.toFixed(1)}</successRate>\n`;
  xml += `    <totalDuration>${aggregated.summary.totalDuration}</totalDuration>\n`;
  xml += `    <totalCost>${aggregated.summary.totalCost}</totalCost>\n`;
  xml += `  </summary>\n`;
  
  xml += `  <tests>\n`;
  raw.forEach(test => {
    xml += `    <test>\n`;
    xml += `      <suite>${test.suite}</suite>\n`;
    xml += `      <name>${test.test}</name>\n`;
    xml += `      <pass>${test.pass}</pass>\n`;
    xml += `      <duration>${test.durationMs}</duration>\n`;
    xml += `      <cost>${test.cost || 0}</cost>\n`;
    if (test.error) {
      xml += `      <error>${test.error}</error>\n`;
    }
    xml += `    </test>\n`;
  });
  xml += `  </tests>\n`;
  xml += '</testResults>';
  
  return xml;
}

/**
 * Generate HTML report
 * @param {object} results - Test results
 * @returns {string} HTML report
 */
function generateHTMLReport(results) {
  const { aggregated, raw } = results;
  
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Glassbox Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .test { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }
        .pass { border-left-color: #4caf50; background: #f1f8e9; }
        .fail { border-left-color: #f44336; background: #ffebee; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .metric { background: white; padding: 15px; border-radius: 3px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .metric-label { color: #666; }
    </style>
</head>
<body>
    <h1>Glassbox Test Results</h1>
    <div class="summary">
        <h2>Summary</h2>
        <div class="metrics">
            <div class="metric">
                <div class="metric-value">${aggregated.summary.total}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #4caf50;">${aggregated.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #f44336;">${aggregated.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${aggregated.summary.successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
        </div>
    </div>
    
    <h2>Test Results</h2>
    ${raw.map(test => `
    <div class="test ${test.pass ? 'pass' : 'fail'}">
        <strong>${test.suite} - ${test.test}</strong><br>
        Duration: ${test.durationMs}ms | Cost: $${test.cost || 0}<br>
        ${test.error ? `<span style="color: #f44336;">Error: ${test.error}</span>` : ''}
    </div>
    `).join('')}
</body>
</html>`;
  
  return html;
}

/**
 * Generate CSV report
 * @param {object} results - Test results
 * @returns {string} CSV report
 */
function generateCSVReport(results) {
  const { aggregated, raw } = results;
  
  let csv = 'Suite,Test,Pass,Duration (ms),Cost,Error\n';
  
  raw.forEach(test => {
    const error = test.error ? `"${test.error.replace(/"/g, '""')}"` : '';
    csv += `${test.suite},${test.test},${test.pass},${test.durationMs},${test.cost || 0},${error}\n`;
  });
  
  return csv;
}

/**
 * Validate model selection
 * @param {string} model - Model name
 * @returns {boolean} Is valid model
 */
function validateModel(model) {
  const allModels = [
    ...AVAILABLE_MODELS.local,
    ...AVAILABLE_MODELS.openai,
    ...AVAILABLE_MODELS.anthropic
  ];
  return allModels.includes(model);
}

/**
 * Get model provider type
 * @param {string} model - Model name
 * @returns {string} Provider type
 */
function getModelProvider(model) {
  if (AVAILABLE_MODELS.local.includes(model)) return 'local';
  if (AVAILABLE_MODELS.openai.includes(model)) return 'openai';
  if (AVAILABLE_MODELS.anthropic.includes(model)) return 'anthropic';
  return 'unknown';
}

/**
 * Create user-friendly error messages
 * @param {string} errorType - Type of error
 * @param {string} message - Error message
 * @param {object} context - Additional context
 * @returns {string} Formatted error message
 */
function createUserFriendlyError(errorType, message, context = {}) {
  let errorOutput = '';
  
  // Error header
  errorOutput += CLI_CONFIG.colors.error(`\n❌ ${errorType.replace('_', ' ')}: ${message}\n`);
  
  // Context information
  if (context.details) {
    errorOutput += CLI_CONFIG.colors.muted(`\nDetails: ${context.details}\n`);
  }
  
  // Common solutions based on error type
  switch (errorType) {
    case ERROR_TYPES.USER_ERROR:
      errorOutput += CLI_CONFIG.colors.info('\n💡 How to fix this:\n');
      if (context.suggestions) {
        context.suggestions.forEach(suggestion => {
          errorOutput += CLI_CONFIG.colors.muted(`  • ${suggestion}\n`);
        });
      }
      break;
      
    case ERROR_TYPES.CONFIGURATION_ERROR:
      errorOutput += CLI_CONFIG.colors.info('\n🔧 Configuration help:\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Check your test YAML files for syntax errors\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Ensure all required fields are present\n');
      errorOutput += CLI_CONFIG.colors.muted(`  • See test format guide: ${DOCS.testFormat}\n`);
      break;
      
    case ERROR_TYPES.NETWORK_ERROR:
      errorOutput += CLI_CONFIG.colors.info('\n🌐 Network troubleshooting:\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Check your internet connection\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Verify API keys are set correctly\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Try running with --verbose for more details\n');
      break;
      
    case ERROR_TYPES.PERMISSION_ERROR:
      errorOutput += CLI_CONFIG.colors.info('\n🔐 Permission help:\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Check file and directory permissions\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Ensure you have write access to .glassbox/\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Try running with elevated permissions if needed\n');
      break;
      
    case ERROR_TYPES.SYSTEM_ERROR:
      errorOutput += CLI_CONFIG.colors.info('\n🛠️  System troubleshooting:\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Check available disk space\n');
      errorOutput += CLI_CONFIG.colors.muted('  • Verify Node.js version (requires 16+) \n');
      errorOutput += CLI_CONFIG.colors.muted('  • Try reinstalling dependencies: npm install\n');
      break;
  }
  
  // Examples if provided
  if (context.examples) {
    errorOutput += CLI_CONFIG.colors.info('\n📝 Examples:\n');
    context.examples.forEach(example => {
      errorOutput += CLI_CONFIG.colors.muted(`  $ ${example}\n`);
    });
  }
  
  // Documentation links
  if (context.docs) {
    errorOutput += CLI_CONFIG.colors.info('\n📚 More help:\n');
    context.docs.forEach(doc => {
      errorOutput += CLI_CONFIG.colors.muted(`  • ${doc}\n`);
    });
  }
  
  // General troubleshooting
  errorOutput += CLI_CONFIG.colors.info('\n🔍 Need more help?\n');
  errorOutput += CLI_CONFIG.colors.muted(`  • Run with --verbose for detailed output\n`);
  errorOutput += CLI_CONFIG.colors.muted(`  • Check troubleshooting guide: ${DOCS.troubleshooting}\n`);
  errorOutput += CLI_CONFIG.colors.muted(`  • Report issues: https://github.com/your-repo/glassbox/issues\n`);
  
  return errorOutput;
}

/**
 * Handle specific error scenarios with user-friendly messages
 * @param {Error} error - The error object
 * @param {object} context - Additional context
 * @returns {string} User-friendly error message
 */
function handleSpecificError(error, context = {}) {
  const errorMessage = error.message.toLowerCase();
  
  // Test directory not found
  if (errorMessage.includes('no such file') && errorMessage.includes('.glassbox')) {
    return createUserFriendlyError(ERROR_TYPES.USER_ERROR, 
      'Test directory not found',
      {
        details: 'The .glassbox/tests/ directory does not exist.',
        suggestions: [
          'Run "glassbox init" to create the test directory and sample files',
          'Check if you\'re in the correct project directory',
          'Verify the .glassbox folder exists in your project root'
        ],
        examples: [
          'glassbox init',
          'ls -la .glassbox/',
          'mkdir -p .glassbox/tests/'
        ],
        docs: [DOCS.gettingStarted]
      }
    );
  }
  
  // No test files found
  if (errorMessage.includes('no valid test files')) {
    return createUserFriendlyError(ERROR_TYPES.USER_ERROR,
      'No test files found',
      {
        details: 'No valid YAML test files were found in .glassbox/tests/',
        suggestions: [
          'Create test files in .glassbox/tests/ directory',
          'Use "glassbox init" to create sample test files',
          'Check that your YAML files have the correct format'
        ],
        examples: [
          'glassbox init',
          'ls .glassbox/tests/',
          'cat .glassbox/tests/sample-test.yml'
        ],
        docs: [DOCS.testFormat, DOCS.gettingStarted]
      }
    );
  }
  
  // YAML parsing errors
  if (errorMessage.includes('yaml') || errorMessage.includes('parsing')) {
    return createUserFriendlyError(ERROR_TYPES.CONFIGURATION_ERROR,
      'Invalid YAML format in test file',
      {
        details: 'One or more test files contain invalid YAML syntax.',
        suggestions: [
          'Check YAML syntax in your test files',
          'Use a YAML validator to find syntax errors',
          'Ensure proper indentation and formatting'
        ],
        examples: [
          'yamllint .glassbox/tests/*.yml',
          'cat .glassbox/tests/your-test.yml'
        ],
        docs: [DOCS.testFormat]
      }
    );
  }
  
  // Network/API errors
  if (errorMessage.includes('network') || errorMessage.includes('connection') || 
      errorMessage.includes('timeout') || errorMessage.includes('econnrefused')) {
    return createUserFriendlyError(ERROR_TYPES.NETWORK_ERROR,
      'Network connection failed',
      {
        details: 'Unable to connect to AI model services.',
        suggestions: [
          'Check your internet connection',
          'Verify API keys are set correctly (OPENAI_API_KEY)',
          'Ensure Ollama is running (if using local models)',
          'Try again in a few minutes'
        ],
        examples: [
          'export OPENAI_API_KEY="your-api-key"',
          'ollama serve',
          'ping api.openai.com'
        ],
        docs: [DOCS.configuration]
      }
    );
  }
  
  // Permission errors
  if (errorMessage.includes('permission') || errorMessage.includes('eacces') || 
      errorMessage.includes('access denied')) {
    return createUserFriendlyError(ERROR_TYPES.PERMISSION_ERROR,
      'Permission denied',
      {
        details: 'Unable to read or write files due to permission restrictions.',
        suggestions: [
          'Check file and directory permissions',
          'Ensure you have write access to the project directory',
          'Try running with appropriate permissions'
        ],
        examples: [
          'chmod 755 .glassbox/',
          'sudo glassbox test',
          'ls -la .glassbox/'
        ],
        docs: [DOCS.troubleshooting]
      }
    );
  }
  
  // Budget exceeded
  if (errorMessage.includes('budget') || errorMessage.includes('cost')) {
    return createUserFriendlyError(ERROR_TYPES.USER_ERROR,
      'Budget limit exceeded',
      {
        details: 'Test execution exceeded the specified budget limit.',
        suggestions: [
          'Increase the budget limit with --budget option',
          'Reduce the number of tests or test complexity',
          'Use cheaper models for testing'
        ],
        examples: [
          'glassbox test --budget 1.00',
          'glassbox test --concurrency 1'
        ],
        docs: [DOCS.configuration]
      }
    );
  }
  
  // Model not found/available
  if (errorMessage.includes('model') && (errorMessage.includes('not found') || 
      errorMessage.includes('unavailable'))) {
    return createUserFriendlyError(ERROR_TYPES.CONFIGURATION_ERROR,
      'AI model not available',
      {
        details: 'The specified AI model is not available or not properly configured.',
        suggestions: [
          'Check if Ollama is running (for local models)',
          'Verify API keys are set correctly',
          'Try using a different model',
          'Check model availability in your region'
        ],
        examples: [
          'ollama list',
          'export OPENAI_API_KEY="your-key"',
          'glassbox test --model gpt-3.5-turbo'
        ],
        docs: [DOCS.configuration]
      }
    );
  }
  
  // Default system error
  return createUserFriendlyError(ERROR_TYPES.SYSTEM_ERROR,
    'An unexpected error occurred',
    {
      details: error.message,
      suggestions: [
        'Try running with --verbose for more details',
        'Check the error logs for more information',
        'Restart the application and try again'
      ],
      examples: [
        'glassbox test --verbose',
        'npm install',
        'node --version'
      ],
      docs: [DOCS.troubleshooting]
    }
  );
}

/**
 * Display spinner animation
 * @param {string} message - Message to display with spinner
 */
function showSpinner(message) {
  if (isQuiet) return;
  
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${CLI_CONFIG.colors.info(CLI_CONFIG.symbols.spinner[spinnerIndex])} ${message}`);
    spinnerIndex = (spinnerIndex + 1) % CLI_CONFIG.symbols.spinner.length;
  }, 100);
}

/**
 * Stop spinner animation
 */
function stopSpinner() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear spinner line
  }
}

/**
 * Display progress bar
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {string} label - Label for progress bar
 */
function showProgressBar(current, total, label = 'Progress') {
  if (isQuiet) return;
  
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  process.stdout.write(`\r${CLI_CONFIG.colors.info(label)}: [${bar}] ${percentage}% (${current}/${total})`);
}

/**
 * Display formatted table
 * @param {Array<Array<string>>} rows - Table rows
 * @param {Array<string>} headers - Table headers
 */
function displayTable(headers, rows) {
  if (isQuiet) return;
  
  // Calculate column widths
  const widths = headers.map((header, i) => {
    const columnValues = [header, ...rows.map(row => row[i] || '')];
    return Math.max(...columnValues.map(val => val.length));
  });
  
  // Print header
  const headerRow = headers.map((header, i) => header.padEnd(widths[i])).join(' | ');
  console.log(CLI_CONFIG.colors.highlight(headerRow));
  console.log(CLI_CONFIG.colors.muted('-'.repeat(headerRow.length)));
  
  // Print rows
  rows.forEach(row => {
    const formattedRow = row.map((cell, i) => (cell || '').padEnd(widths[i])).join(' | ');
    console.log(formattedRow);
  });
  console.log();
}

/**
 * Display test results in a professional format
 * @param {object} results - Test results from runner
 */
function displayTestResults(results) {
  if (isQuiet) return;
  
  const { raw, aggregated } = results;
  
  // Summary section
  console.log(CLI_CONFIG.colors.highlight('\n📊 TEST RESULTS SUMMARY'));
  console.log(CLI_CONFIG.colors.muted('='.repeat(50)));
  
  const summaryTable = [
    ['Metric', 'Value'],
    ['Total Tests', aggregated.summary.total.toString()],
    ['Passed', CLI_CONFIG.colors.pass(`${aggregated.summary.passed} (${aggregated.summary.successRate.toFixed(1)}%)`)],
    ['Failed', CLI_CONFIG.colors.fail(aggregated.summary.failed.toString())],
    ['Total Duration', `${(aggregated.summary.totalDuration / 1000).toFixed(1)}s`],
    ['Average Duration', `${(aggregated.performance.averageDuration / 1000).toFixed(1)}s`],
    ['Total Cost', `$${aggregated.summary.totalCost.toFixed(6)}`],
    ['Total Tokens', aggregated.summary.totalTokens.toLocaleString()],
    ['Model Fallback Rate', `${aggregated.models.fallbackRate.toFixed(1)}%`]
  ];
  
  displayTable(['Metric', 'Value'], summaryTable.map(row => [row[0], row[1]]));
  
  // Failure breakdown
  if (aggregated.summary.failed > 0) {
    console.log(CLI_CONFIG.colors.warning('⚠️  FAILURE BREAKDOWN'));
    console.log(CLI_CONFIG.colors.muted('-'.repeat(30)));
    
    const failureRows = Object.entries(aggregated.failures.byCategory).map(([category, count]) => [
      category,
      count.toString(),
      `${((count / aggregated.summary.failed) * 100).toFixed(1)}%`
    ]);
    
    displayTable(['Category', 'Count', 'Percentage'], failureRows);
  }
  
  // Model usage
  console.log(CLI_CONFIG.colors.info('🤖 MODEL USAGE'));
  console.log(CLI_CONFIG.colors.muted('-'.repeat(20)));
  
  const modelRows = Object.entries(aggregated.models.usage).map(([model, count]) => [
    model,
    count.toString(),
    `${((count / aggregated.summary.total) * 100).toFixed(1)}%`
  ]);
  
  displayTable(['Model', 'Tests', 'Usage %'], modelRows);
  
  // Performance insights
  console.log(CLI_CONFIG.colors.info('⚡ PERFORMANCE INSIGHTS'));
  console.log(CLI_CONFIG.colors.muted('-'.repeat(25)));
  
  const performanceRows = [
    ['Fast tests (<5s)', aggregated.performance.durationDistribution.fast.toString()],
    ['Medium tests (5-15s)', aggregated.performance.durationDistribution.medium.toString()],
    ['Slow tests (>15s)', aggregated.performance.durationDistribution.slow.toString()]
  ];
  
  displayTable(['Category', 'Count'], performanceRows);
  
  if (aggregated.performance.slowestTest) {
    console.log(CLI_CONFIG.colors.warning(`🐌 Slowest test: ${aggregated.performance.slowestTest.suite} - ${aggregated.performance.slowestTest.test} (${aggregated.performance.slowestTest.durationMs}ms)`));
  }
  
  if (aggregated.performance.fastestTest) {
    console.log(CLI_CONFIG.colors.success(`⚡ Fastest test: ${aggregated.performance.fastestTest.suite} - ${aggregated.performance.fastestTest.test} (${aggregated.performance.fastestTest.durationMs}ms)`));
  }
  
  // Detailed results in verbose mode
  if (isVerbose) {
    console.log(CLI_CONFIG.colors.info('\n🔍 DETAILED RESULTS'));
    console.log(CLI_CONFIG.colors.muted('-'.repeat(20)));
    
    raw.forEach((result, index) => {
      const status = result.pass ? CLI_CONFIG.symbols.pass : CLI_CONFIG.symbols.fail;
      const statusColor = result.pass ? CLI_CONFIG.colors.pass : CLI_CONFIG.colors.fail;
      const modelInfo = result.fallbackUsed ? ` [${result.modelUsed} via fallback]` : ` [${result.modelUsed}]`;
      
      console.log(`${statusColor(status)} ${result.suite} - ${result.test} (${result.durationMs}ms)${modelInfo}`);
      
      if (!result.pass && result.details) {
        result.details.forEach(detail => {
          console.log(CLI_CONFIG.colors.muted(`  └─ ${detail}`));
        });
      }
      
      if (result.error) {
        console.log(CLI_CONFIG.colors.error(`  └─ Error: ${result.error}`));
      }
    });
  }
}

async function initCommand() {
  const dir = path.resolve('.glassbox/tests');
  const sampleFile = path.join(dir, 'sample-test.yml');
  
  console.log(CLI_CONFIG.colors.info('🚀 Initializing Glassbox test environment...'));
  
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(CLI_CONFIG.colors.success(`✓ Created directory: ${dir}`));
    } else {
      console.log(CLI_CONFIG.colors.warning(`⚠ Directory already exists: ${dir}`));
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
      console.log(CLI_CONFIG.colors.success(`✓ Created sample test file: ${sampleFile}`));
    } else {
      console.log(CLI_CONFIG.colors.warning(`⚠ Sample test file already exists: ${sampleFile}`));
    }
    
    console.log(CLI_CONFIG.colors.success('\n🎉 Glassbox initialization complete!'));
    console.log(CLI_CONFIG.colors.muted('Next steps:'));
    console.log(CLI_CONFIG.colors.muted('  1. Edit the sample test file in .glassbox/tests/'));
    console.log(CLI_CONFIG.colors.muted('  2. Run "glassbox test" to execute your tests'));
    console.log(CLI_CONFIG.colors.muted('  3. Use "glassbox test --help" for more options'));
    
  } catch (error) {
    console.error(handleSpecificError(error, {
      details: 'Failed to initialize Glassbox test environment',
      context: { operation: 'init', directory: dir }
    }));
    process.exit(1);
  }
}

function versionCommand() {
  const pkgPath = path.resolve('package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(CLI_CONFIG.colors.highlight(`Glassbox CLI version: ${pkg.version}`));
    console.log(CLI_CONFIG.colors.muted('A professional AI testing framework'));
  } catch (err) {
    console.error(handleSpecificError(err, {
      details: 'Could not read version information',
      context: { operation: 'version' }
    }));
  }
}

program
  .name('glassbox')
  .description('A professional CLI tool for testing AI systems via structured evaluations')
  .version('0.1.0')
  .option('-v, --verbose', 'Enable verbose output with detailed test results')
  .option('-q, --quiet', 'Suppress all output except errors and final results')
  .option('--json', 'Output results in JSON format for machine consumption')
  .option('--no-color', 'Disable colored output')
  .option('--timeout <ms>', 'Set test timeout in milliseconds (default: 30000)', '30000')
  .option('--concurrency <number>', 'Set maximum concurrent tests (default: 5)', '5')
  .option('--test-dir <path>', 'Custom test directory path (default: .glassbox/tests/)')
  .option('--model <name>', 'Specify AI model to use (e.g., gpt-3.5-turbo, mistral:7b)')
  .option('--retry <number>', 'Number of retries for failed tests (default: 2)', '2')
  .option('--budget <amount>', 'Set budget limit in USD')
  .option('--export <format>', `Export results to file (formats: ${Object.keys(EXPORT_FORMATS).join(', ')})`)
  .option('--output <path>', 'Output file path for exported results');

program
  .command('test')
  .description('Run AI prompt tests with professional reporting')
  .option('--suite <name>', 'Run only tests from specific suite')
  .option('--filter <pattern>', 'Run only tests matching pattern')
  .action(async (options, command) => {
    // Set global flags
    isVerbose = command.parent.opts().verbose;
    isQuiet = command.parent.opts().quiet;
    
    if (command.parent.opts().noColor) {
      // Disable colors
      Object.keys(CLI_CONFIG.colors).forEach(key => {
        CLI_CONFIG.colors[key] = (text) => text;
      });
    }
    
    // Validate model selection
    const model = command.parent.opts().model;
    if (model && !validateModel(model)) {
      console.error(createUserFriendlyError(ERROR_TYPES.CONFIGURATION_ERROR,
        'Invalid model specified',
        {
          details: `Model "${model}" is not supported.`,
          suggestions: [
            'Use one of the available models',
            'Check model availability and spelling'
          ],
          examples: [
            'glassbox test --model gpt-3.5-turbo',
            'glassbox test --model mistral:7b'
          ],
          docs: [DOCS.configuration]
        }
      ));
      process.exit(1);
    }
    
    // Set test directory
    const testDir = command.parent.opts().testDir || path.resolve('.glassbox/tests');
    
    if (!isQuiet) {
      console.log(CLI_CONFIG.colors.info(`🔍 Loading tests from: ${testDir}`));
      if (model) {
        console.log(CLI_CONFIG.colors.info(`🤖 Using model: ${model} (${getModelProvider(model)})`));
      }
    }
    
    try {
      const testObjects = parseTestFiles(testDir);
      if (!testObjects.length) {
        throw new Error('No valid test files found');
      }
      
      if (!isQuiet) {
        console.log(CLI_CONFIG.colors.success(`✓ Found ${testObjects.length} test suite(s)`));
        console.log(CLI_CONFIG.colors.info('🚀 Starting test execution...'));
      }
      
      const results = await runTests(testObjects);
      
      // Handle export if specified
      const exportFormat = command.parent.opts().export;
      if (exportFormat) {
        const outputPath = command.parent.opts().output || `glassbox-results.${exportFormat}`;
        exportResults(results, exportFormat, outputPath);
      }
      
      if (command.parent.opts().json) {
        console.log(JSON.stringify(results.machineReadable, null, 2));
      } else {
        displayTestResults(results);
      }
      
      // Exit with appropriate code
      process.exit(results.aggregated.summary.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error(handleSpecificError(error, {
        context: { 
          operation: 'test',
          testDir,
          model,
          options: command.parent.opts()
        }
      }));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create sample .glassbox folder with example tests')
  .action(initCommand);

program
  .command('version')
  .description('Show version number and framework information')
  .action(versionCommand);

// Enhanced help text
program.addHelpText('after', `

Examples:
  $ glassbox init                    # Initialize test environment
  $ glassbox test                   # Run all tests
  $ glassbox test --verbose         # Run with detailed output
  $ glassbox test --json            # Output results in JSON format
  $ glassbox test --budget 0.10     # Set $0.10 budget limit
  $ glassbox test --concurrency 3   # Run max 3 tests concurrently
  $ glassbox test --model gpt-4     # Use specific AI model
  $ glassbox test --test-dir ./tests # Use custom test directory
  $ glassbox test --export html     # Export results as HTML report
  $ glassbox test --export json --output results.json # Export to specific file

Configuration Options:
  --timeout <ms>      Set test timeout (default: 30000ms)
  --retry <number>    Number of retries for failed tests (default: 2)
  --model <name>      Specify AI model (local: mistral:7b, openai: gpt-3.5-turbo)
  --test-dir <path>   Custom test directory path
  --budget <amount>   Set budget limit in USD
  --export <format>   Export results (json, xml, html, csv)
  --output <path>     Output file path for exports

Test Configuration:
  Tests are defined in YAML files in .glassbox/tests/
  Each test file can contain multiple test suites
  Tests support content validation, PII detection, and cost tracking

For more information, visit: https://github.com/your-repo/glassbox
`);

program.parse(process.argv); 