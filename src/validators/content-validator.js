import { distance } from 'fastest-levenshtein';

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 * @param {string} str1
 * @param {string} str2
 * @returns {number}
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  const editDistance = distance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - (editDistance / maxLength);
}

/**
 * Check if response contains expected keywords with fuzzy matching
 * @param {string} response
 * @param {Array<string>} keywords
 * @returns {Array<{keyword: string, found: boolean, score: number, match: string}>}
 */
function checkKeywords(response, keywords) {
  const results = [];
  const responseLower = response.toLowerCase();
  
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    let bestScore = 0;
    let bestMatch = '';
    
    // Split response into words and check each word
    const words = responseLower.split(/\s+/);
    for (const word of words) {
      const score = calculateSimilarity(word, keywordLower);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = word;
      }
    }
    
    // Also check if keyword is contained within any word
    for (const word of words) {
      if (word.includes(keywordLower) || keywordLower.includes(word)) {
        const score = Math.max(bestScore, 0.8);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = word;
        }
      }
    }
    
    results.push({
      keyword,
      found: bestScore > 0.6, // Threshold for "found"
      score: bestScore,
      match: bestMatch
    });
  }
  
  return results;
}

/**
 * Validate response length and coherence
 * @param {string} response
 * @returns {object}
 */
function validateResponseQuality(response) {
  const words = response.trim().split(/\s+/);
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLength: sentences.length > 0 ? words.length / sentences.length : 0,
    hasContent: words.length > 0,
    isCoherent: sentences.length > 0 && words.length >= 3
  };
}

/**
 * Check if response actually answers the prompt
 * @param {string} prompt
 * @param {string} response
 * @returns {object}
 */
function validatePromptAnswering(prompt, response) {
  const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const responseWords = response.toLowerCase().split(/\s+/);
  
  let relevantWords = 0;
  for (const promptWord of promptWords) {
    for (const responseWord of responseWords) {
      if (calculateSimilarity(promptWord, responseWord) > 0.7) {
        relevantWords++;
        break;
      }
    }
  }
  
  const relevanceScore = promptWords.length > 0 ? relevantWords / promptWords.length : 0;
  
  return {
    relevanceScore,
    relevantWords,
    totalPromptWords: promptWords.length,
    isRelevant: relevanceScore > 0.3
  };
}

/**
 * Main content validation function
 * @param {string} response
 * @param {object} expect - Expected criteria
 * @param {string} prompt - Original prompt
 * @returns {object} Detailed validation results
 */
export function validateContent(response, expect, prompt = '') {
  const results = {
    overall: {
      pass: true,
      score: 0,
      details: []
    },
    keywordChecks: [],
    quality: {},
    relevance: {},
    errors: []
  };
  
  try {
    // Check expected keywords
    if (expect.contains) {
      results.keywordChecks = checkKeywords(response, expect.contains);
      const failedKeywords = results.keywordChecks.filter(k => !k.found);
      if (failedKeywords.length > 0) {
        results.overall.pass = false;
        results.overall.details.push(`Missing keywords: ${failedKeywords.map(k => k.keyword).join(', ')}`);
      }
    }
    
    // Check forbidden keywords
    if (expect.not_contains) {
      const forbiddenChecks = checkKeywords(response, expect.not_contains);
      const foundForbidden = forbiddenChecks.filter(k => k.found);
      if (foundForbidden.length > 0) {
        results.overall.pass = false;
        results.overall.details.push(`Contains forbidden keywords: ${foundForbidden.map(k => k.keyword).join(', ')}`);
      }
    }
    
    // Validate response quality
    results.quality = validateResponseQuality(response);
    if (!results.quality.hasContent) {
      results.overall.pass = false;
      results.overall.details.push('Response is empty');
    }
    if (!results.quality.isCoherent) {
      results.overall.details.push('Response lacks coherence');
    }
    
    // Check if response answers the prompt
    if (prompt) {
      results.relevance = validatePromptAnswering(prompt, response);
      if (!results.relevance.isRelevant) {
        results.overall.details.push('Response does not appear to answer the prompt');
      }
    }
    
    // Calculate overall score
    const scores = [
      ...results.keywordChecks.map(k => k.score),
      results.quality.hasContent ? 1 : 0,
      results.quality.isCoherent ? 0.8 : 0.4,
      results.relevance.relevanceScore || 0
    ];
    results.overall.score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
  } catch (error) {
    results.errors.push(error.message);
    results.overall.pass = false;
  }
  
  return results;
}
