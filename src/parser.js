import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { validateInput, formatValidationErrors } from './validators/input-validator.js';
import { 
  safeReadFile, 
  safeCreateDirectory, 
  validateFileSystem,
  getFileSystemInfo,
  logger 
} from './fs-error-handler.js';

/**
 * Reads all .yml files in a directory, parses and validates them, and returns an array of test objects.
 * @param {string} directory - The directory to read .yml files from.
 * @param {object} options - Validation options
 * @returns {Promise<Array<Object>>} - Array of parsed and validated test objects.
 */
export async function parseTestFiles(directory, options = {}) {
  const testObjects = [];
  let files;
  
  try {
    files = fs.readdirSync(directory);
  } catch (err) {
    console.error(`Error reading directory: ${directory}`, err.message);
    return [];
  }

  const yamlFiles = files.filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
  
  if (yamlFiles.length === 0) {
    console.warn(`No YAML files found in directory: ${directory}`);
    return [];
  }

  for (const file of yamlFiles) {
    const filePath = path.join(directory, file);
    
    // Use safe file reading with comprehensive error handling
    const readResult = await safeReadFile(filePath, {
      checkIntegrity: true,
      resolveSymlinks: true
    });
    
    if (!readResult.success) {
      logger.error(`Failed to read file: ${filePath}`, {
        error: readResult.error.type,
        message: readResult.error.message
      });
      console.error(`Error reading file: ${filePath}`, readResult.error.message);
      continue;
    }

    // Use the comprehensive validation system
    const validationResult = await validateInput(readResult.content, filePath, options);
    
    if (!validationResult.valid) {
      console.error(formatValidationErrors(validationResult));
      continue;
    }

    // Use sanitized data if available, otherwise use original parsed data
    const testData = validationResult.sanitizedData || yaml.parse(readResult.content);
    testObjects.push(testData);
  }

  return testObjects;
}

/**
 * Parse and validate a single test file
 * @param {string} filePath - Path to the test file
 * @param {object} options - Validation options
 * @returns {Promise<Object|null>} - Parsed and validated test object or null if invalid
 */
export async function parseTestFile(filePath, options = {}) {
  // Use safe file reading with comprehensive error handling
  const readResult = await safeReadFile(filePath, {
    checkIntegrity: true,
    resolveSymlinks: true
  });
  
  if (!readResult.success) {
    logger.error(`Failed to read file: ${filePath}`, {
      error: readResult.error.type,
      message: readResult.error.message
    });
    console.error(`Error reading file: ${filePath}`, readResult.error.message);
    return null;
  }

  // Use the comprehensive validation system
  const validationResult = await validateInput(readResult.content, filePath, options);
  
  if (!validationResult.valid) {
    console.error(formatValidationErrors(validationResult));
    return null;
  }

  // Use sanitized data if available, otherwise use original parsed data
  return validationResult.sanitizedData || yaml.parse(readResult.content);
}
