/**
 * PII Detector for sensitive information
 * Detects SSNs, emails, phone numbers, credit cards, names, and addresses
 */

// Regex patterns for different PII types
const PATTERNS = {
  ssn: /(\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b)/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b|\b\d{10}\b)/g,
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  name: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
  address: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Circle|Cir)\b/gi
};

// Credit card issuer patterns
const CREDIT_CARD_ISSUERS = {
  visa: /^4/,
  mastercard: /^5[1-5]/,
  amex: /^3[47]/,
  discover: /^6(?:011|5)/
};

/**
 * Luhn algorithm for credit card validation
 * @param {string} cardNumber
 * @returns {boolean}
 */
function luhnCheck(cardNumber) {
  const digits = cardNumber.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Determine credit card issuer
 * @param {string} cardNumber
 * @returns {string}
 */
function getCreditCardIssuer(cardNumber) {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  for (const [issuer, pattern] of Object.entries(CREDIT_CARD_ISSUERS)) {
    if (pattern.test(cleanNumber)) {
      return issuer;
    }
  }
  return 'unknown';
}

/**
 * Calculate risk level based on PII type and context
 * @param {string} piiType
 * @param {string} value
 * @returns {string}
 */
function calculateRiskLevel(piiType, value) {
  const riskLevels = {
    ssn: 'HIGH',
    creditCard: 'HIGH',
    email: 'MEDIUM',
    phone: 'MEDIUM',
    name: 'LOW',
    address: 'LOW'
  };
  
  return riskLevels[piiType] || 'MEDIUM';
}

/**
 * Mask sensitive information for logging
 * @param {string} value
 * @param {string} type
 * @returns {string}
 */
function maskPII(value, type) {
  switch (type) {
    case 'ssn':
      return value.replace(/(\d{3})-(\d{2})-(\d{4})/, 'XXX-XX-$3');
    case 'creditCard':
      return value.replace(/(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})/, '****-****-****-$4');
    case 'phone':
      return value.replace(/(\d{3})[-.]?(\d{3})[-.]?(\d{4})/, '($1) ***-$3');
    case 'email':
      const [local, domain] = value.split('@');
      return `${local.charAt(0)}***@${domain}`;
    default:
      return value;
  }
}

/**
 * Main PII detection function
 * @param {string} text
 * @returns {object} PII detection results
 */
export function detectPII(text) {
  const results = {
    found: [],
    riskLevel: 'LOW',
    totalCount: 0,
    summary: {}
  };
  
  const summary = {};
  
  // Check each PII type
  for (const [type, pattern] of Object.entries(PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      const uniqueMatches = [...new Set(matches)];
      const riskLevel = calculateRiskLevel(type, uniqueMatches[0]);
      
      const piiItems = uniqueMatches.map(match => ({
        type,
        value: match,
        masked: maskPII(match, type),
        riskLevel
      }));
      
      results.found.push(...piiItems);
      summary[type] = {
        count: uniqueMatches.length,
        riskLevel,
        examples: piiItems.slice(0, 3).map(item => item.masked)
      };
    }
  }
  
  // Special handling for credit cards (Luhn validation)
  const creditCardMatches = results.found.filter(item => item.type === 'creditCard');
  for (const item of creditCardMatches) {
    const isValid = luhnCheck(item.value);
    if (isValid) {
      item.issuer = getCreditCardIssuer(item.value);
      item.valid = true;
    } else {
      item.valid = false;
      item.riskLevel = 'LOW'; // Invalid cards are less risky
    }
  }
  
  // Calculate overall risk level
  const riskScores = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const totalRisk = results.found.reduce((sum, item) => sum + riskScores[item.riskLevel], 0);
  const avgRisk = results.found.length > 0 ? totalRisk / results.found.length : 1;
  
  if (avgRisk >= 2.5) results.riskLevel = 'HIGH';
  else if (avgRisk >= 1.5) results.riskLevel = 'MEDIUM';
  else results.riskLevel = 'LOW';
  
  results.totalCount = results.found.length;
  results.summary = summary;
  
  return results;
}

/**
 * Check if text contains any PII
 * @param {string} text
 * @returns {boolean}
 */
export function hasPII(text) {
  const results = detectPII(text);
  return results.totalCount > 0;
}

/**
 * Get PII risk assessment
 * @param {string} text
 * @returns {object}
 */
export function assessPIIRisk(text) {
  const results = detectPII(text);
  return {
    hasPII: results.totalCount > 0,
    riskLevel: results.riskLevel,
    piiTypes: Object.keys(results.summary),
    totalItems: results.totalCount
  };
}
