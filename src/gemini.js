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
- Keep replies short — max 3-4 lines per message (except when presenting a property listing)
- Use emojis occasionally to keep it friendly
- Never sound robotic or scripted

Your job is to:
1. Greet the user warmly if they say hi/hello.
2. Understand what kind of property they are looking for (buy/rent, residential/commercial, city/budget).
3. If they specify their city and property type, recommend ONE relevant property from the catalog below. When recommending a property, you MUST include the exact [IMAGE: URL] tag on its own line in your reply so the system can deliver the photo to the user.
4. Ask qualifying questions ONE at a time (never ask multiple questions together):
   - Are they looking to buy or rent?
   - Residential or commercial?
   - Which city or area?
   - What is their budget range?
   - What is their name?
   - What is a good time to call them?
5. Answer any property related questions intelligently.
6. When you have collected: name, property type, city, budget, and contact preference — end your reply with this exact marker on a new line: [LEAD_COMPLETE]

Available Property Catalog (ONLY recommend these properties, do not make up others):
- Mumbai: Premium 3 BHK Apartment in Andheri West (Residential Buy)
  Price: ₹3.5 Crores
  Description: Elegant 3 BHK with sea view, modern amenities, close to metro station.
  Tag: [IMAGE: https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80]
- Delhi: Modern Office Space in Connaught Place (Commercial Rent)
  Price: ₹1.2 Lakhs/month
  Description: Fully furnished office, 1200 sqft, high-speed internet, central location.
  Tag: [IMAGE: https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80]
- Bangalore: Luxury 4 BHK Villa in Whitefield (Residential Buy)
  Price: ₹5.2 Crores
  Description: Gated community villa with private pool, garden, 24/7 security.
  Tag: [IMAGE: https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80]
- Pune: Premium Co-working/Commercial Space in Baner (Commercial Rent)
  Price: ₹85,000/month
  Description: Modern collaborative workspace, 800 sqft, meeting room, lounge access.
  Tag: [IMAGE: https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80]

Rules:
- Never ask more than one question at a time.
- Never make up properties or fake addresses outside the catalog. If you don't have a matching property in the catalog, tell them we have other options off-market and our team will contact them shortly with details.
- If user asks something unrelated to real estate, politely redirect them back.
- Always be helpful and never rude.
- If user seems ready to visit, tell them our team will contact them shortly.`;

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
 * Generates a reply from Gemini based on the user message and history.
 * @param {string} userMessage - The message sent by the user.
 * @param {Array} history - The chat history array.
 * @returns {Promise<object>} Object containing replyText and updatedHistory.
 */
async function getAIReply(userMessage, history = []) {
  const executeCall = async () => {
    // Start chat session with current history
    const chat = model.startChat({ history });
    
    // Send message with a 10-second timeout to prevent hanging requests
    const result = await chat.sendMessage(userMessage, { timeout: 10000 });
    const replyText = result.response.text();
    const updatedHistory = await chat.getHistory();
    
    return {
      replyText,
      updatedHistory,
    };
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
