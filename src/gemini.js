const { GoogleGenerativeAI } = require('@google/generative-ai');

// Fetch the API key from environment variables
const apiKey = process.env.GEMINI_API_KEY;

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(apiKey);

const systemInstruction = `You are Aryan, a friendly and professional real estate assistant 
for a leading Indian real estate agency. You help customers with 
both residential and commercial properties.

Your personality:
- Warm, helpful, and conversational
- Reply in Hinglish (mix of Hindi and English naturally)
- Keep replies short — max 3-4 lines per message
- Use emojis occasionally to keep it friendly
- Never sound robotic or scripted

Your job is to:
1. Greet the user warmly if they say hi/hello
2. Understand what kind of property they are looking for
3. Ask qualifying questions ONE at a time (never ask multiple 
   questions together):
   - Are they looking to buy or rent?
   - Residential or commercial?
   - Which city or area?
   - What is their budget range?
   - What is their name?
   - What is a good time to call them?
4. Answer any property related questions intelligently
5. When you have collected: name, property type, city, budget 
   and contact preference — end your reply with this exact 
   marker on a new line: [LEAD_COMPLETE]

Rules:
- Never ask more than one question at a time
- Never make up property listings or fake addresses
- If user asks something unrelated to real estate, politely 
  redirect them back
- Always be helpful and never rude
- If user seems ready to visit, tell them our team will 
  contact them shortly`;

// Initialize the model with the system instruction
const model = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  systemInstruction: systemInstruction,
});

/**
 * Helper to retry an async function with exponential backoff on transient/rate-limit errors.
 */
async function retryWithBackoff(fn, retries = 3, delay = 1500) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    
    // Retry on rate limits (429), timeouts/aborts, transient server errors (5xx), or network errors (no status)
    const isRateLimit = error.status === 429 || (error.message && error.message.includes('429'));
    const isTimeout = error.message && (error.message.includes('timeout') || error.message.includes('abort') || error.message.includes('fetch'));
    const isServerError = error.status >= 500 || (error.message && error.message.includes('503'));

    if (isRateLimit || isTimeout || isServerError || !error.status) {
      console.warn(`Gemini call failed: ${error.message}. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Generates a reply from Gemini based on the user message.
 * @param {string} userMessage - The message sent by the user.
 * @returns {Promise<string>} The reply message from Gemini.
 */
async function getAIReply(userMessage) {
  const executeCall = async () => {
    // Generate content with a 10-second timeout to prevent hanging requests
    const result = await model.generateContent(userMessage, { timeout: 10000 });
    return result.response.text();
  };

  try {
    return await retryWithBackoff(executeCall, 3, 1500);
  } catch (error) {
    console.error('Gemini Error Full:', error.message, error.status, error.errorDetails);
    throw error;
  }
}

module.exports = {
  getAIReply,
};
