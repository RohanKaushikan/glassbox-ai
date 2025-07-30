import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validation error types
export const VALIDATION_ERRORS = {
  YAML_SYNTAX: 'YAML_SYNTAX',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_VALUE: 'INVALID_VALUE',
  INJECTION_ATTEMPT: 'INJECTION_ATTEMPT',
  FILE_PATH: 'FILE_PATH',
  PERMISSION: 'PERMISSION',
  API_KEY: 'API_KEY',
  NETWORK: 'NETWORK',
  SCHEMA: 'SCHEMA'
};

// Required fields for test configuration
const REQUIRED_FIELDS = {
  root: ['name', 'description', 'settings', 'tests'],
  test: ['name', 'description', 'prompt', 'expect_contains'],
  settings: ['model', 'provider']
};

// Field constraints and validation rules
const FIELD_CONSTRAINTS = {
  name: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/,
    description: 'Test name (alphanumeric, hyphens, underscores only)'
  },
  description: {
    type: 'string',
    minLength: 10,
    maxLength: 500,
    description: 'Test description (10-500 characters)'
  },
  prompt: {
    type: 'string',
    minLength: 5,
    maxLength: 2000,
    description: 'Test prompt (5-2000 characters)'
  },
  expect_contains: {
    type: 'array',
    minItems: 1,
    maxItems: 20,
    itemType: 'string',
    description: 'Expected keywords (1-20 items)'
  },
  max_tokens: {
    type: 'number',
    min: 1,
    max: 4000,
    description: 'Maximum tokens (1-4000)'
  },
  max_cost_usd: {
    type: 'number',
    min: 0.001,
    max: 1.0,
    description: 'Maximum cost in USD (0.001-1.0)'
  }
};

// Dangerous patterns for injection detection
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /system\s*\(/gi,
  /shell_exec\s*\(/gi,
  /passthru\s*\(/gi,
  /`.*`/g,
  /\$\{.*\}/g,
  /import\s+os\s*;?\s*os\.system/gi,
  /subprocess\.call/gi,
  /subprocess\.Popen/gi
];

// File path validation patterns
const PATH_PATTERNS = {
  dangerous: [
    /\.\./g,  // Directory traversal
    /\/etc\/passwd/gi,
    /\/etc\/shadow/gi,
    /\/proc\//gi,
    /\/sys\//gi,
    /\/dev\//gi,
    /\/root\//gi,
    /\/home\/.*\/\.ssh/gi
  ],
  safe: [
    /^[a-zA-Z0-9\/\-_\.]+$/  // Safe characters only
  ]
};

/**
 * Create a user-friendly error message with examples
 * @param {string} errorType - Type of validation error
 * @param {string} field - Field that failed validation
 * @param {string} value - Value that failed validation
 * @param {string} reason - Reason for failure
 * @returns {string} Formatted error message
 */
function createErrorMessage(errorType, field, value, reason) {
  const examples = {
    name: 'Example: "fibonacci_function" or "hello_world_test"',
    description: 'Example: "Test that generates a Python function to compute Fibonacci numbers"',
    prompt: 'Example: "Write a Python function to compute the nth Fibonacci number"',
    expect_contains: 'Example: ["def", "return", "fibonacci"]',
    max_tokens: 'Example: 200',
    max_cost_usd: 'Example: 0.005'
  };

  const baseMessage = chalk.red(`❌ Validation Error: ${reason}`);
  const fieldInfo = chalk.yellow(`Field: ${field}`);
  const valueInfo = value ? chalk.gray(`Value: ${value}`) : '';
  const example = examples[field] ? chalk.cyan(`💡 ${examples[field]}`) : '';

  return `${baseMessage}\n${fieldInfo}\n${valueInfo}\n${example}`.trim();
}

/**
 * Validate YAML syntax and provide helpful error messages
 * @param {string} content - YAML content to validate
 * @param {string} filePath - Path to the file being validated
 * @returns {object} Validation result
 */
function validateYAMLSyntax(content, filePath) {
  try {
    const parsed = yaml.parse(content);
    return { valid: true, data: parsed };
  } catch (error) {
    const errorMessage = error.message;
    let helpfulMessage = `YAML syntax error in ${filePath}:\n${errorMessage}`;
    
    // Provide specific guidance for common YAML errors
    if (errorMessage.includes('indentation')) {
      helpfulMessage += '\n\n💡 Tip: Check your indentation. YAML is sensitive to spaces vs tabs.';
    } else if (errorMessage.includes('quotes')) {
      helpfulMessage += '\n\n💡 Tip: Use quotes around strings with special characters.';
    } else if (errorMessage.includes('duplicate key')) {
      helpfulMessage += '\n\n💡 Tip: Each key must be unique within its scope.';
    }
    
    return {
      valid: false,
      error: {
        type: VALIDATION_ERRORS.YAML_SYNTAX,
        message: helpfulMessage,
        originalError: error
      }
    };
  }
}

/**
 * Check for required fields in the configuration
 * @param {object} data - Parsed YAML data
 * @param {string} filePath - Path to the file being validated
 * @returns {object} Validation result
 */
function validateRequiredFields(data, filePath) {
  const errors = [];
  
  // Check root level required fields
  for (const field of REQUIRED_FIELDS.root) {
    if (!data[field]) {
      errors.push({
        type: VALIDATION_ERRORS.REQUIRED_FIELD,
        field,
        message: createErrorMessage(
          VALIDATION_ERRORS.REQUIRED_FIELD,
          field,
          null,
          `Missing required field: ${field}`
        )
      });
    }
  }
  
  // Check tests array
  if (data.tests && Array.isArray(data.tests)) {
    data.tests.forEach((test, index) => {
      for (const field of REQUIRED_FIELDS.test) {
        if (!test[field]) {
          errors.push({
            type: VALIDATION_ERRORS.REQUIRED_FIELD,
            field: `tests[${index}].${field}`,
            message: createErrorMessage(
              VALIDATION_ERRORS.REQUIRED_FIELD,
              field,
              null,
              `Missing required field in test ${index + 1}: ${field}`
            )
          });
        }
      }
    });
  }
  
  // Check settings
  if (data.settings) {
    for (const field of REQUIRED_FIELDS.settings) {
      if (!data.settings[field]) {
        errors.push({
          type: VALIDATION_ERRORS.REQUIRED_FIELD,
          field: `settings.${field}`,
          message: createErrorMessage(
            VALIDATION_ERRORS.REQUIRED_FIELD,
            field,
            null,
            `Missing required field in settings: ${field}`
          )
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate field values against constraints
 * @param {object} data - Parsed YAML data
 * @returns {object} Validation result
 */
function validateFieldValues(data) {
  const errors = [];
  
  // Validate root level fields
  if (data.name) {
    const constraint = FIELD_CONSTRAINTS.name;
    if (typeof data.name !== constraint.type) {
      errors.push({
        type: VALIDATION_ERRORS.INVALID_VALUE,
        field: 'name',
        value: data.name,
        message: createErrorMessage(
          VALIDATION_ERRORS.INVALID_VALUE,
          'name',
          data.name,
          `Name must be a string`
        )
      });
    } else if (data.name.length < constraint.minLength || data.name.length > constraint.maxLength) {
      errors.push({
        type: VALIDATION_ERRORS.INVALID_VALUE,
        field: 'name',
        value: data.name,
        message: createErrorMessage(
          VALIDATION_ERRORS.INVALID_VALUE,
          'name',
          data.name,
          `Name must be ${constraint.minLength}-${constraint.maxLength} characters`
        )
      });
    } else if (!constraint.pattern.test(data.name)) {
      errors.push({
        type: VALIDATION_ERRORS.INVALID_VALUE,
        field: 'name',
        value: data.name,
        message: createErrorMessage(
          VALIDATION_ERRORS.INVALID_VALUE,
          'name',
          data.name,
          `Name contains invalid characters (only alphanumeric, hyphens, underscores allowed)`
        )
      });
    }
  }
  
  // Validate description
  if (data.description) {
    const constraint = FIELD_CONSTRAINTS.description;
    if (typeof data.description !== constraint.type) {
      errors.push({
        type: VALIDATION_ERRORS.INVALID_VALUE,
        field: 'description',
        value: data.description,
        message: createErrorMessage(
          VALIDATION_ERRORS.INVALID_VALUE,
          'description',
          data.description,
          `Description must be a string`
        )
      });
    } else if (data.description.length < constraint.minLength || data.description.length > constraint.maxLength) {
      errors.push({
        type: VALIDATION_ERRORS.INVALID_VALUE,
        field: 'description',
        value: data.description,
        message: createErrorMessage(
          VALIDATION_ERRORS.INVALID_VALUE,
          'description',
          data.description,
          `Description must be ${constraint.minLength}-${constraint.maxLength} characters`
        )
      });
    }
  }
  
  // Validate tests array
  if (data.tests && Array.isArray(data.tests)) {
    data.tests.forEach((test, index) => {
      // Validate prompt
      if (test.prompt) {
        const constraint = FIELD_CONSTRAINTS.prompt;
        if (typeof test.prompt !== constraint.type) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].prompt`,
            value: test.prompt,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'prompt',
              test.prompt,
              `Prompt must be a string`
            )
          });
        } else if (test.prompt.length < constraint.minLength || test.prompt.length > constraint.maxLength) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].prompt`,
            value: test.prompt,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'prompt',
              test.prompt,
              `Prompt must be ${constraint.minLength}-${constraint.maxLength} characters`
            )
          });
        }
      }
      
      // Validate expect_contains
      if (test.expect_contains) {
        const constraint = FIELD_CONSTRAINTS.expect_contains;
        if (!Array.isArray(test.expect_contains)) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].expect_contains`,
            value: test.expect_contains,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'expect_contains',
              test.expect_contains,
              `expect_contains must be an array`
            )
          });
        } else if (test.expect_contains.length < constraint.minItems || test.expect_contains.length > constraint.maxItems) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].expect_contains`,
            value: test.expect_contains,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'expect_contains',
              test.expect_contains,
              `expect_contains must have ${constraint.minItems}-${constraint.maxItems} items`
            )
          });
        } else {
          // Validate each item in the array
          test.expect_contains.forEach((item, itemIndex) => {
            if (typeof item !== constraint.itemType) {
              errors.push({
                type: VALIDATION_ERRORS.INVALID_VALUE,
                field: `tests[${index}].expect_contains[${itemIndex}]`,
                value: item,
                message: createErrorMessage(
                  VALIDATION_ERRORS.INVALID_VALUE,
                  'expect_contains item',
                  item,
                  `Each item in expect_contains must be a string`
                )
              });
            }
          });
        }
      }
      
      // Validate max_tokens
      if (test.max_tokens !== undefined) {
        const constraint = FIELD_CONSTRAINTS.max_tokens;
        if (typeof test.max_tokens !== constraint.type) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].max_tokens`,
            value: test.max_tokens,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'max_tokens',
              test.max_tokens,
              `max_tokens must be a number`
            )
          });
        } else if (test.max_tokens < constraint.min || test.max_tokens > constraint.max) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].max_tokens`,
            value: test.max_tokens,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'max_tokens',
              test.max_tokens,
              `max_tokens must be between ${constraint.min} and ${constraint.max}`
            )
          });
        }
      }
      
      // Validate max_cost_usd
      if (test.max_cost_usd !== undefined) {
        const constraint = FIELD_CONSTRAINTS.max_cost_usd;
        if (typeof test.max_cost_usd !== constraint.type) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].max_cost_usd`,
            value: test.max_cost_usd,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'max_cost_usd',
              test.max_cost_usd,
              `max_cost_usd must be a number`
            )
          });
        } else if (test.max_cost_usd < constraint.min || test.max_cost_usd > constraint.max) {
          errors.push({
            type: VALIDATION_ERRORS.INVALID_VALUE,
            field: `tests[${index}].max_cost_usd`,
            value: test.max_cost_usd,
            message: createErrorMessage(
              VALIDATION_ERRORS.INVALID_VALUE,
              'max_cost_usd',
              test.max_cost_usd,
              `max_cost_usd must be between ${constraint.min} and ${constraint.max}`
            )
          });
        }
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize user inputs to prevent injection attacks
 * @param {object} data - Parsed YAML data
 * @returns {object} Validation result
 */
function sanitizeInputs(data) {
  const errors = [];
  const sanitizedData = JSON.parse(JSON.stringify(data)); // Deep clone
  
  // Recursive function to check for dangerous patterns
  function checkForInjection(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string') {
        // Check for dangerous patterns
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(value)) {
            errors.push({
              type: VALIDATION_ERRORS.INJECTION_ATTEMPT,
              field: currentPath,
              value: value,
              message: createErrorMessage(
                VALIDATION_ERRORS.INJECTION_ATTEMPT,
                currentPath,
                value,
                `Potential injection attempt detected in ${currentPath}`
              )
            });
            break;
          }
        }
        
        // Sanitize the string
        let sanitized = value;
        
        // Remove or escape potentially dangerous characters
        sanitized = sanitized.replace(/[<>]/g, (match) => {
          return match === '<' ? '&lt;' : '&gt;';
        });
        
        // Remove script tags and javascript: protocols
        sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        
        if (sanitized !== value) {
          obj[key] = sanitized;
        }
      } else if (typeof value === 'object' && value !== null) {
        checkForInjection(value, currentPath);
      }
    }
  }
  
  checkForInjection(sanitizedData);
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedData
  };
}

/**
 * Validate file paths and check permissions
 * @param {string} filePath - Path to validate
 * @returns {object} Validation result
 */
function validateFilePath(filePath) {
  const errors = [];
  
  try {
    // Check for dangerous path patterns
    for (const pattern of PATH_PATTERNS.dangerous) {
      if (pattern.test(filePath)) {
        errors.push({
          type: VALIDATION_ERRORS.FILE_PATH,
          field: 'filePath',
          value: filePath,
          message: createErrorMessage(
            VALIDATION_ERRORS.FILE_PATH,
            'filePath',
            filePath,
            `Dangerous file path detected: ${filePath}`
          )
        });
        return { valid: false, errors };
      }
    }
    
    // Check if file exists and is readable
    if (!fs.existsSync(filePath)) {
      errors.push({
        type: VALIDATION_ERRORS.FILE_PATH,
        field: 'filePath',
        value: filePath,
        message: createErrorMessage(
          VALIDATION_ERRORS.FILE_PATH,
          'filePath',
          filePath,
          `File does not exist: ${filePath}`
        )
      });
    } else {
      // Check read permissions
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (error) {
        errors.push({
          type: VALIDATION_ERRORS.PERMISSION,
          field: 'filePath',
          value: filePath,
          message: createErrorMessage(
            VALIDATION_ERRORS.PERMISSION,
            'filePath',
            filePath,
            `No read permission for file: ${filePath}`
          )
        });
      }
    }
    
    // Check directory permissions for output files
    const dir = path.dirname(filePath);
    if (dir !== '.') {
      try {
        fs.accessSync(dir, fs.constants.W_OK);
      } catch (error) {
        errors.push({
          type: VALIDATION_ERRORS.PERMISSION,
          field: 'directory',
          value: dir,
          message: createErrorMessage(
            VALIDATION_ERRORS.PERMISSION,
            'directory',
            dir,
            `No write permission for directory: ${dir}`
          )
        });
      }
    }
    
  } catch (error) {
    errors.push({
      type: VALIDATION_ERRORS.FILE_PATH,
      field: 'filePath',
      value: filePath,
      message: createErrorMessage(
        VALIDATION_ERRORS.FILE_PATH,
        'filePath',
        filePath,
        `Invalid file path: ${error.message}`
      )
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate API keys and network connectivity
 * @param {object} settings - Settings object containing API configuration
 * @returns {Promise<object>} Validation result
 */
async function validateAPIConfiguration(settings) {
  const errors = [];
  
  if (!settings || !settings.provider) {
    errors.push({
      type: VALIDATION_ERRORS.API_KEY,
      field: 'settings.provider',
      message: createErrorMessage(
        VALIDATION_ERRORS.API_KEY,
        'provider',
        null,
        'Provider is required in settings'
      )
    });
    return { valid: false, errors };
  }
  
  // Check for API key based on provider
  const apiKeyEnvVars = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    local: null // Local models don't need API keys
  };
  
  const envVar = apiKeyEnvVars[settings.provider];
  if (envVar && !process.env[envVar]) {
    errors.push({
      type: VALIDATION_ERRORS.API_KEY,
      field: 'API_KEY',
      message: createErrorMessage(
        VALIDATION_ERRORS.API_KEY,
        'API_KEY',
        null,
        `Missing API key for ${settings.provider}. Set ${envVar} environment variable.`
      )
    });
  }
  
  // Test network connectivity for cloud providers
  if (settings.provider !== 'local') {
    try {
      const testUrls = {
        openai: 'https://api.openai.com/v1/models',
        anthropic: 'https://api.anthropic.com/v1/messages'
      };
      
      const testUrl = testUrls[settings.provider];
      if (testUrl) {
        const response = await fetch(testUrl, {
          method: 'HEAD',
          timeout: 5000
        });
        
        if (!response.ok) {
          errors.push({
            type: VALIDATION_ERRORS.NETWORK,
            field: 'network',
            message: createErrorMessage(
              VALIDATION_ERRORS.NETWORK,
              'network',
              null,
              `Network connectivity issue: ${response.status} ${response.statusText}`
            )
          });
        }
      }
    } catch (error) {
      errors.push({
        type: VALIDATION_ERRORS.NETWORK,
        field: 'network',
        message: createErrorMessage(
          VALIDATION_ERRORS.NETWORK,
          'network',
          null,
          `Network connectivity error: ${error.message}`
        )
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Main validation function that orchestrates all validation steps
 * @param {string} content - YAML content to validate
 * @param {string} filePath - Path to the file being validated
 * @param {object} options - Validation options
 * @returns {Promise<object>} Comprehensive validation result
 */
export async function validateInput(content, filePath, options = {}) {
  const {
    checkAPIConfig = true,
    checkNetwork = true,
    sanitize = true
  } = options;
  
  const result = {
    valid: false,
    errors: [],
    warnings: [],
    sanitizedData: null,
    filePath
  };
  
  // Step 1: Validate YAML syntax
  const yamlResult = validateYAMLSyntax(content, filePath);
  if (!yamlResult.valid) {
    result.errors.push(yamlResult.error);
    return result;
  }
  
  // Step 2: Validate required fields
  const requiredResult = validateRequiredFields(yamlResult.data, filePath);
  result.errors.push(...requiredResult.errors);
  
  // Step 3: Validate field values
  const valueResult = validateFieldValues(yamlResult.data);
  result.errors.push(...valueResult.errors);
  
  // Step 4: Sanitize inputs (if requested)
  let dataToUse = yamlResult.data;
  if (sanitize) {
    const sanitizeResult = sanitizeInputs(yamlResult.data);
    result.errors.push(...sanitizeResult.errors);
    if (sanitizeResult.sanitizedData) {
      dataToUse = sanitizeResult.sanitizedData;
      result.sanitizedData = sanitizeResult.sanitizedData;
    }
  }
  
  // Step 5: Validate file path
  const pathResult = validateFilePath(filePath);
  result.errors.push(...pathResult.errors);
  
  // Step 6: Validate API configuration (if requested)
  if (checkAPIConfig && dataToUse.settings) {
    const apiResult = await validateAPIConfiguration(dataToUse.settings);
    result.errors.push(...apiResult.errors);
  }
  
  // Determine overall validity
  result.valid = result.errors.length === 0;
  
  return result;
}

/**
 * Format validation errors for display
 * @param {object} validationResult - Result from validateInput
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(validationResult) {
  if (validationResult.valid) {
    return chalk.green('✓ All validations passed');
  }
  
  let message = chalk.red(`❌ Validation failed for ${validationResult.filePath}\n\n`);
  
  // Group errors by type
  const errorGroups = {};
  validationResult.errors.forEach(error => {
    if (!errorGroups[error.type]) {
      errorGroups[error.type] = [];
    }
    errorGroups[error.type].push(error);
  });
  
  // Display errors by type
  for (const [errorType, errors] of Object.entries(errorGroups)) {
    message += chalk.yellow(`\n${errorType} Errors:\n`);
    errors.forEach(error => {
      message += `  ${error.message}\n`;
    });
  }
  
  // Add summary
  message += chalk.cyan(`\n💡 Total errors: ${validationResult.errors.length}`);
  message += chalk.cyan(`\n💡 For help, see: https://github.com/your-repo/glassbox#test-format`);
  
  return message;
}

/**
 * Validate a directory of test files
 * @param {string} directory - Directory path to validate
 * @param {object} options - Validation options
 * @returns {Promise<object>} Validation results for all files
 */
export async function validateTestDirectory(directory, options = {}) {
  const results = {
    valid: true,
    files: [],
    totalErrors: 0,
    totalWarnings: 0
  };
  
  try {
    const files = fs.readdirSync(directory);
    const yamlFiles = files.filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    for (const file of yamlFiles) {
      const filePath = path.join(directory, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      const validationResult = await validateInput(content, filePath, options);
      
      results.files.push({
        file,
        path: filePath,
        ...validationResult
      });
      
      if (!validationResult.valid) {
        results.valid = false;
        results.totalErrors += validationResult.errors.length;
        results.totalWarnings += validationResult.warnings.length;
      }
    }
    
  } catch (error) {
    results.valid = false;
    results.files.push({
      file: 'directory',
      path: directory,
      valid: false,
      errors: [{
        type: VALIDATION_ERRORS.FILE_PATH,
        message: `Error reading directory: ${error.message}`
      }]
    });
  }
  
  return results;
} 