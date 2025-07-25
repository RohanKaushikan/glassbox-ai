import axios from 'axios';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment variables.');
}

// Simple token counter (splits on whitespace)
function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sends a prompt to the OpenAI API and returns the AI response and token count.
 * Retries on failure, handles errors and timeouts.
 * @param {string} prompt
 * @returns {Promise<{response: string, tokenCount: number}>}
 */
export async function generateResponse(prompt) {
  let attempt = 0;
  let lastError;
  while (attempt < MAX_RETRIES) {
    try {
      const res = await axios.post(
        OPENAI_URL,
        {
          model: MODEL,
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_MS
        }
      );
      if (!res.data || !res.data.choices || !res.data.choices[0] || !res.data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }
      const response = res.data.choices[0].message.content;
      const tokenCount = countTokens(response);
      return { response, tokenCount };
    } catch (err) {
      lastError = err;
      if (err.code === 'ECONNABORTED') {
        console.error('OpenAI API request timed out.');
      } else if (err.response) {
        console.error('OpenAI API error:', err.response.status, err.response.data);
      } else {
        console.error('OpenAI API connection error:', err.message);
      }
      attempt++;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        console.log(`Retrying OpenAI request (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      }
    }
  }
  throw new Error(`Failed to get response from OpenAI API after ${MAX_RETRIES} attempts: ${lastError && lastError.message}`);
}
