const Groq = require('groq-sdk');

// Initialize the Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';

const systemPrompt = `You are Aryan, a friendly and professional real estate assistant 
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

/**
 * Helper to retry an async function with exponential backoff.
 */
async function retryWithBackoff(fn, retries = 2, delay = 2000) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    const status = error.status || error.statusCode;
    const msg = error.message || '';
    const isRateLimit = status === 429 || msg.includes('429');
    const isTransient = status >= 500 || msg.includes('timeout') || msg.includes('abort');

    if (isRateLimit) {
      console.warn(`Groq rate limit hit. Waiting 5s before retry...`);
      await new Promise(r => setTimeout(r, 5000));
      return retryWithBackoff(fn, retries - 1, 5000);
    } else if (isTransient || !status) {
      console.warn(`Groq call failed: ${msg}. Retrying in ${delay}ms... (${retries} left)`);
      await new Promise(r => setTimeout(r, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Generates a reply using Groq (Llama 3.3 70B) with conversation history.
 * @param {string} userMessage - The message sent by the user.
 * @param {Array} history - Chat history in OpenAI format: [{ role, content }]
 * @returns {Promise<object>} Object containing replyText and updatedHistory.
 */
async function getAIReply(userMessage, history = []) {
  const executeCall = async () => {
    // Build the messages array: system + history + new user message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const chatCompletion = await groq.chat.completions.create({
      model: MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const replyText = chatCompletion.choices[0]?.message?.content || '';

    // Build updated history (old history + this turn)
    const updatedHistory = [
      ...history,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: replyText },
    ];

    return { replyText, updatedHistory };
  };

  try {
    return await retryWithBackoff(executeCall, 2, 2000);
  } catch (error) {
    console.error('Groq Error:', error.message, error.status);
    throw error;
  }
}

module.exports = {
  getAIReply,
};
