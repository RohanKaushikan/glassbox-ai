import axios from 'axios';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'mistral:7b';
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Simple token counter (splits on whitespace)
function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sends a prompt to the Ollama server and returns the AI response and token count.
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
        OLLAMA_URL,
        { model: OLLAMA_MODEL, prompt, stream: false },
        { timeout: TIMEOUT_MS }
      );
      if (!res.data || !res.data.response === undefined) {
        throw new Error('Invalid response from Ollama API');
      }
      const response = res.data.response;
      const tokenCount = countTokens(response);
      return { response, tokenCount };
    } catch (err) {
      lastError = err;
      if (err.code === 'ECONNABORTED') {
        console.error('Ollama API request timed out.');
      } else if (err.response) {
        console.error('Ollama API error:', err.response.status, err.response.data);
      } else {
        console.error('Ollama API connection error:', err.message);
      }
      attempt++;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        console.log(`Retrying Ollama request (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      }
    }
  }
  throw new Error(`Failed to get response from Ollama API after ${MAX_RETRIES} attempts: ${lastError && lastError.message}`);
}
