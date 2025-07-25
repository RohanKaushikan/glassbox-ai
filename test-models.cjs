async function testModel() {
  try {
    const { generateResponse } = await import('./src/models/ollama-client.js');
    console.log('Testing local model...');
    const response = await generateResponse('Hello world');
    console.log('Response:', response);
    console.log('✅ Local model works!');
  } catch (error) {
    console.error('❌ Model error:', error);
  }
}

testModel();