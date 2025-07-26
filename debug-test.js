import { parseTestFiles } from './src/parser.js';
import { runTests } from './src/runner.js';

async function debugTest() {
    console.log('=== DEBUG: Loading and running one test ===\n');
    
    const testSuites = await parseTestFiles('./.glassbox/tests');
    const firstSuite = testSuites[0];
    const firstTest = firstSuite.tests[0];
    
    console.log('Test name:', firstTest.name);
    console.log('Prompt:', firstTest.prompt);
    
    const results = await runTests([firstSuite]);
    
    // ACCESS THE RESULTS CORRECTLY
    const testResult = results.raw[0];  // Use .raw[0] instead
    
    console.log('\n=== TEST RESULT ===');
    console.log('Status:', testResult.pass ? 'PASSED' : 'FAILED');
    console.log('AI Response:', testResult.response);
    console.log('Token count:', testResult.tokenCount);
    console.log('Cost:', testResult.cost);
}

debugTest();