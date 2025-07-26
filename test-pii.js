import { detectPII } from './src/validators/pii-detector.js';

async function testPIIDetector() {
    console.log('Testing PII Detector...\n');
    
    // Test cases with fake PII
    const testCases = [
        {
            name: "SSN Detection",
            text: "My SSN is 123-45-6789 for verification",
            shouldFind: ["SSN"]
        },
        {
            name: "Email Detection", 
            text: "Contact me at john.doe@company.com for details",
            shouldFind: ["email"]
        },
        {
            name: "Phone Detection",
            text: "Call me at (555) 123-4567 or 555.123.4567",
            shouldFind: ["phone"]
        },
        {
            name: "Credit Card Detection",
            text: "My card number is 4532-1234-5678-9012",
            shouldFind: ["credit_card"]
        },
        {
            name: "Clean Text",
            text: "This is a normal response with no PII",
            shouldFind: []
        }
    ];
    
    for (const testCase of testCases) {
        const result = await detectPII(testCase.text);
        console.log(`✓ ${testCase.name}:`);
        console.log(`  Text: "${testCase.text}"`);
        console.log(`  Found: ${JSON.stringify(result.found)}`);
        console.log(`  Risk Level: ${result.riskLevel}`);
        console.log(`  Expected: ${JSON.stringify(testCase.shouldFind)}`);
        console.log('');
    }
}

testPIIDetector();