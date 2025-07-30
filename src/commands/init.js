import { platformUtils } from '../utils/platform-utils.js';
import fs from 'fs';
import path from 'path';

export function initCommand() {
  console.log('🚀 Initializing Glassbox test environment...');
  
  try {
    // Create platform-specific directories
    const dirs = platformUtils.createPlatformDirs();
    console.log('✅ Created platform directories:', dirs);
    
    // Create .glassbox directory in current working directory
    const glassboxDir = platformUtils.joinPaths(process.cwd(), '.glassbox');
    const testsDir = platformUtils.joinPaths(glassboxDir, 'tests');
    
    fs.mkdirSync(testsDir, { recursive: true });
    console.log('✅ Created test directory:', testsDir);
    
    // Create sample test file
    const sampleFile = platformUtils.joinPaths(testsDir, 'sample-test.yml');
    const sampleContent = `name: "Sample AI Test"
description: "A sample test to get you started"

settings:
  provider: "openai"
  model: "gpt-3.5-turbo"
  timeout_ms: 30000
  max_retries: 2

tests:
  - name: "Basic Response Test"
    description: "Test basic AI response"
    prompt: "Hello, how are you today?"
    expect:
      contains: ["hello", "hi", "good", "fine"]
      not_contains: ["error", "sorry", "cannot"]
    max_tokens: 100
    temperature: 0.7

  - name: "Code Generation Test"
    description: "Test code generation capabilities"
    prompt: "Write a simple JavaScript function to add two numbers"
    expect:
      contains: ["function", "return", "add", "numbers"]
      not_contains: ["error", "cannot", "sorry"]
    max_tokens: 200
    temperature: 0.3
`;

    fs.writeFileSync(sampleFile, sampleContent);
    console.log('✅ Created sample test file:', sampleFile);
    
    console.log('🎉 Glassbox initialized successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Edit the sample test file in .glassbox/tests/');
    console.log('   2. Set your API keys as environment variables');
    console.log('   3. Run: glassbox test');
    
  } catch (error) {
    console.error('❌ Initialization failed:', platformUtils.getPlatformErrorMessage(error));
    process.exit(1);
  }
} 