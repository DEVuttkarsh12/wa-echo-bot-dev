const express = require('express');
const router = express.Router();
const { sendWhatsAppMessage } = require('./whatsapp');

// GET /webhook - Verification Handshake
router.get('/', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedVerifyToken = process.env.VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expectedVerifyToken) {
      console.log('Webhook verification successful.');
      // Challenge should be sent back as plain text
      res.status(200).send(challenge);
    } else {
      console.warn('Webhook verification failed: mode or token mismatch.');
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('Error during webhook verification:', error.message);
    res.sendStatus(500);
  }
});

/**
 * Helper function to determine the appropriate response based on keywords.
 * @param {string} text - The input text from the message.
 * @returns {string} The reply message.
 */
function getReply(text) {
  const normalized = (text || '').toLowerCase().trim();

  // Handles greetings (hi, hello, hey)
  if (/\b(hi|hello|hey)\b/.test(normalized)) {
    return 'Hey there! 👋 Welcome. Type *help* to see what I can do.';
  }
  // Handles help request
  else if (normalized.includes('help')) {
    return `Here's what I can help with:

1️⃣ Type *price* → Pricing info
2️⃣ Type *contact* → Contact details
3️⃣ Type *about* → About us

Just type any keyword above 👆`;
  }
  // Handles pricing information
  else if (normalized.includes('price') || normalized.includes('pricing') || normalized.includes('cost')) {
    return `💰 Our Pricing:

• Basic Plan → ₹999/month
• Pro Plan → ₹2499/month
• Enterprise → Custom pricing

Reply *contact* to talk to us.`;
  }
  // Handles contact details
  else if (normalized.includes('contact') || normalized.includes('call') || normalized.includes('reach')) {
    return `📞 Contact Us:

• WhatsApp: +91 XXXXXXXXXX
• Email: hello@example.com
• Hours: Mon-Sat, 10am - 7pm`;
  }
  // Handles about us details
  else if (normalized.includes('about') || normalized.includes('who are you') || normalized.includes('what do you do')) {
    return `🙋 About Us:

We build WhatsApp automation solutions for businesses.
Fast, reliable, and custom built.

Type *help* to see options.`;
  }
  // Default fallback for unmatched inputs
  else {
    return `Hmm, I didn't understand that 🤔
Type *help* to see available options.`;
  }
}

// Helper function to safely process webhook event asynchronously
async function handleWebhookEvent(body) {
  // Payload validation: must be a valid object
  if (!body || typeof body !== 'object') {
    return;
  }

  // Validate object format belongs to WhatsApp Business Account
  if (body.object !== 'whatsapp_business_account') {
    return;
  }

  const entries = body.entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }

  for (const entry of entries) {
    const changes = entry.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = change.value;
      if (!value || typeof value !== 'object') continue;

      const messages = value.messages;
      // If messages array is empty or undefined (could be a status update), silently return
      if (!Array.isArray(messages) || messages.length === 0) {
        continue;
      }

      for (const msg of messages) {
        // Sanitize check: make sure message object is valid
        if (!msg || typeof msg !== 'object') continue;

        // If message type is not "text", ignore and return (handle only text for now)
        if (msg.type !== 'text') {
          continue;
        }

        const from = msg.from;
        const textBody = msg.text?.body;

        // Basic sanity checks on sender ID and text content
        if (!from || typeof textBody !== 'string') {
          continue;
        }

        const replyText = getReply(textBody);
        
        try {
          await sendWhatsAppMessage(from, replyText);
          console.log(`Successfully replied to: ${from}`);
        } catch (error) {
          // Log errors clearly but never crash the server
          console.error(`Failed to echo message to ${from}:`, error.message);
        }
      }
    }
  }
}

// POST /webhook - Incoming message handler
router.post('/', (req, res) => {
  // Always respond 200 OK immediately to Meta (Meta will retry if you don't)
  res.status(200).send('EVENT_RECEIVED');

  // Then process the payload asynchronously
  try {
    handleWebhookEvent(req.body).catch(error => {
      console.error('Error handling webhook event asynchronously:', error.message);
    });
  } catch (error) {
    console.error('Synchronous error starting webhook event handling:', error.message);
  }
});

module.exports = router;
