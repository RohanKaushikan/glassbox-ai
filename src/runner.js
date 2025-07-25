import { generateResponse } from './models/ollama-client.js';

/**
 * Validates the AI response against the test's expect criteria.
 * @param {string} response
 * @param {object} expect
 * @returns {object} { pass: boolean, details: string[] }
 */
function validateResponse(response, expect) {
  const details = [];
  let pass = true;
  if (expect.contains) {
    for (const phrase of expect.contains) {
      if (!response.includes(phrase)) {
        pass = false;
        details.push(`Missing required phrase: "${phrase}"`);
      }
    }
  }
  if (expect.not_contains) {
    for (const phrase of expect.not_contains) {
      if (response.includes(phrase)) {
        pass = false;
        details.push(`Should not contain: "${phrase}"`);
      }
    }
  }
  return { pass, details };
}

/**
 * Runs all tests in the provided test objects.
 * @param {Array<Object>} testObjects
 * @returns {Promise<Array<Object>>} Array of test result objects
 */
export async function runTests(testObjects) {
  const results = [];
  for (const testFile of testObjects) {
    const { name: suiteName, settings, tests } = testFile;
    for (const test of tests) {
      const { name, description, prompt, expect } = test;
      const start = Date.now();
      let response = '';
      let tokenCount = 0;
      let error = null;
      let pass = false;
      let details = [];
      try {
        const aiResult = await generateResponse(prompt);
        response = aiResult.response;
        tokenCount = aiResult.tokenCount;
        const validation = validateResponse(response, expect);
        pass = validation.pass;
        details = validation.details;
      } catch (err) {
        error = err.message;
        pass = false;
        details = [err.message];
      }
      const end = Date.now();
      const durationMs = end - start;
      const cost = settings && settings.max_cost_usd && tokenCount
        ? (settings.max_cost_usd * (tokenCount / settings.max_tokens)).toFixed(6)
        : null;
      results.push({
        suite: suiteName,
        test: name,
        description,
        prompt,
        response,
        pass,
        details,
        tokenCount,
        cost,
        durationMs,
        error
      });
    }
  }
  return results;
}
