import { calculateRequestCost } from './src/validators/cost-calculator.js';

async function testCostCalculator() {
    console.log('Testing Cost Calculator...\n');
    
    const testCases = [
        {
            name: "Short GPT-3.5 Response",
            text: "Hello there! How can I help you?",
            model: "gpt-3.5-turbo",
            expectedRange: [0.00001, 0.0001]
        },
        {
            name: "Long GPT-4 Response", 
            text: "This is a much longer response that contains multiple sentences and should cost significantly more to generate using GPT-4 model pricing structure.",
            model: "gpt-4",
            expectedRange: [0.0001, 0.001]
        },
        {
            name: "Medium Claude Response",
            text: "Here's a moderate length response for testing.",
            model: "claude-3-sonnet",
            expectedRange: [0.00005, 0.0005]
        }
    ];
    
    for (const testCase of testCases) {
        const result = calculateRequestCost("test prompt", testCase.text, testCase.model);
        console.log(`✓ ${testCase.name}:`);
        console.log(`  Text length: ${testCase.text.length} chars`);
        console.log(`  Total tokens: ${result.totalTokens}`);
        console.log(`  Prompt tokens: ${result.promptTokens}`);
        console.log(`  Response tokens: ${result.responseTokens}`);
        console.log(`  Model: ${testCase.model}`);
        console.log(`  Total cost: $${result.totalCost.toFixed(6)}`);
        console.log(`  Within expected range: ${result.totalCost >= testCase.expectedRange[0] && result.totalCost <= testCase.expectedRange[1] ? '✅' : '❌'}`);
        console.log('');
    }
}

testCostCalculator();