# Glassbox Input Validation System

The Glassbox CLI includes a comprehensive input validation system that ensures your test files are secure, properly formatted, and ready for execution. This system provides robust validation with clear, actionable error messages.

## Features

### 1. YAML Syntax Validation
- **Validates YAML syntax** with helpful error messages
- **Provides specific guidance** for common YAML errors (indentation, quotes, duplicate keys)
- **Catches syntax errors** before test execution

### 2. Required Fields Validation
- **Checks for required fields** at root level and test level
- **Validates nested structures** (settings, tests array)
- **Provides clear feedback** on missing fields

### 3. Field Value Validation
- **Validates data types** (string, number, array)
- **Enforces length constraints** (min/max character limits)
- **Checks value ranges** (reasonable token limits, cost limits)
- **Validates patterns** (alphanumeric names, safe characters)

### 4. Input Sanitization
- **Prevents injection attacks** by detecting dangerous patterns
- **Sanitizes user inputs** to remove malicious content
- **Blocks common attack vectors** (XSS, code injection, command injection)

### 5. File Path Validation
- **Validates file paths** for security
- **Checks file permissions** (read/write access)
- **Prevents directory traversal** attacks
- **Validates output directories**

### 6. API Configuration Validation
- **Checks API keys** for required providers
- **Validates network connectivity** for cloud providers
- **Tests API endpoints** before execution
- **Provides clear setup instructions**

## Usage

### Basic Validation
```bash
# Validate all test files in the default directory
glassbox validate

# Validate files in a custom directory
glassbox validate --test-dir ./my-tests

# Validate without API checks (faster)
glassbox validate --no-check-api

# Validate without sanitization
glassbox validate --no-sanitize
```

### Validation During Testing
```bash
# Run tests with full validation
glassbox test

# Run tests with custom validation options
glassbox test --test-dir ./my-tests
```

## Validation Rules

### Required Fields
```yaml
# Root level required fields
name: "test_suite_name"           # Required
description: "Test description"    # Required
settings:                         # Required
  provider: "openai"              # Required
  model: "gpt-3.5-turbo"         # Required
tests:                            # Required
  - name: "test_name"             # Required
    description: "Test description" # Required
    prompt: "Test prompt"          # Required
    expect_contains: ["keyword"]   # Required
```

### Field Constraints

| Field | Type | Constraints | Example |
|-------|------|-------------|---------|
| `name` | string | 1-100 chars, alphanumeric + `-_` | `"fibonacci_test"` |
| `description` | string | 10-500 chars | `"Test that generates Fibonacci function"` |
| `prompt` | string | 5-2000 chars | `"Write a Python function"` |
| `expect_contains` | array | 1-20 string items | `["def", "return"]` |
| `max_tokens` | number | 1-4000 | `200` |
| `max_cost_usd` | number | 0.001-1.0 | `0.005` |

### Security Patterns Blocked

The validation system detects and blocks these dangerous patterns:

- **Script injection**: `<script>`, `javascript:`
- **Code execution**: `eval()`, `exec()`, `system()`
- **Command injection**: `` `command` ``, `${command}`
- **File system access**: `os.system()`, `subprocess.call()`
- **Directory traversal**: `../`, `/etc/passwd`

## Error Messages

The validation system provides clear, actionable error messages with:

- **Error categorization** (YAML_SYNTAX, REQUIRED_FIELD, etc.)
- **Field identification** with full path
- **Value context** showing the problematic value
- **Helpful examples** of correct format
- **Actionable suggestions** for fixing issues

### Example Error Messages

```
❌ Validation Error: Missing required field: name
Field: name
💡 Example: "fibonacci_function" or "hello_world_test"

❌ Validation Error: Name contains invalid characters
Field: name
Value: test@suite
💡 Example: "fibonacci_function" or "hello_world_test"

❌ Validation Error: max_tokens must be between 1 and 4000
Field: tests[0].max_tokens
Value: 5000
💡 Example: 200
```

## Configuration Options

### Validation Options
```javascript
const validationOptions = {
  checkAPIConfig: true,    // Check API keys and connectivity
  checkNetwork: true,      // Test network connectivity
  sanitize: true          // Sanitize inputs
};
```

### Environment Variables
```bash
# Required for OpenAI
export OPENAI_API_KEY="your-api-key"

# Required for Anthropic
export ANTHROPIC_API_KEY="your-api-key"

# Not required for local models
```

## Examples

### Valid Test File
```yaml
name: fibonacci_suite
description: Test suite for Fibonacci function generation with proper error handling and validation
settings:
  provider: openai
  model: gpt-3.5-turbo
  max_tokens: 1000
  temperature: 0.7

tests:
  - name: fibonacci_function
    description: Ensure clean, correct implementation of Fibonacci in Python
    prompt: "Write a Python function to compute the nth Fibonacci number."
    expect_contains: ["def", "return", "fibonacci"]
    expect_not_contains: ["eval", "import os"]
    max_tokens: 200
    max_cost_usd: 0.005
```

### Invalid Test File (with errors)
```yaml
name: test@suite  # Invalid: contains @
description: Too short  # Invalid: less than 10 chars
settings:
  provider: openai
  # Missing model field
tests:
  - name: test_with_invalid_tokens
    description: This test has an invalid max_tokens value
    prompt: "Write a Python function"
    expect_contains: ["def", "return"]
    max_tokens: 5000  # Invalid: too high
    max_cost_usd: 2.0  # Invalid: too high
```

## Integration

The validation system is automatically integrated into:

- **Test execution** (`glassbox test`)
- **File parsing** (all YAML files)
- **CLI commands** (with validation options)

## Troubleshooting

### Common Issues

1. **YAML Syntax Errors**
   - Check indentation (use spaces, not tabs)
   - Ensure proper quotes around strings with special characters
   - Verify no duplicate keys

2. **Missing API Keys**
   - Set required environment variables
   - Check provider configuration
   - Verify API key permissions

3. **Network Connectivity**
   - Check internet connection
   - Verify firewall settings
   - Test API endpoint accessibility

4. **File Permissions**
   - Ensure read access to test files
   - Check write access to output directories
   - Verify directory permissions

### Getting Help

```bash
# Show validation help
glassbox validate --help

# Run validation with verbose output
glassbox validate --verbose

# Check specific validation aspects
glassbox validate --check-api
```

## Security Considerations

- **Input sanitization** prevents injection attacks
- **Path validation** prevents directory traversal
- **API key validation** ensures proper authentication
- **Network testing** verifies connectivity before execution
- **Permission checking** ensures secure file access

The validation system is designed to catch security issues early and provide clear guidance for fixing them. 