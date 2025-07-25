async function test() {
  const { parseTestFiles } = await import('./src/parser.js');
  
  try {
    const tests = await parseTestFiles('./examples/');
    console.log('Parsed tests:', JSON.stringify(tests, null, 2));
    console.log(`Found ${tests.length} total tests`);
  } catch (error) {
    console.error('Parser error:', error);
  }
}

test();