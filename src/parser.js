import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

// Basic schema validation for the test YAML files
function validateSchema(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.name || !obj.description || !obj.settings || !Array.isArray(obj.tests)) return false;
  // Further validation can be added as needed
  return true;
}

/**
 * Reads all .yml files in a directory, parses and validates them, and returns an array of test objects.
 * @param {string} directory - The directory to read .yml files from.
 * @returns {Array<Object>} - Array of parsed and validated test objects.
 */
export function parseTestFiles(directory) {
  const testObjects = [];
  let files;
  try {
    files = fs.readdirSync(directory);
  } catch (err) {
    console.error(`Error reading directory: ${directory}`, err.message);
    return [];
  }

  for (const file of files) {
    if (file.endsWith('.yml')) {
      const filePath = path.join(directory, file);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        console.error(`Error reading file: ${filePath}`, err.message);
        continue;
      }
      let parsed;
      try {
        parsed = yaml.parse(content);
      } catch (err) {
        console.error(`YAML parse error in file: ${filePath}`, err.message);
        continue;
      }
      if (!validateSchema(parsed)) {
        console.error(`Schema validation failed for file: ${filePath}`);
        continue;
      }
      testObjects.push(parsed);
    }
  }
  return testObjects;
}
