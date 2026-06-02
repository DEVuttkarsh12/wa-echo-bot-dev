const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sendWhatsAppMessage } = require('./whatsapp');
const { getAIReply } = require('./gemini');
const { saveLead } = require('./sheets');
const { getHistory, saveHistory, clearHistory } = require('./memory');

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
 * Sends an image message to a WhatsApp number with a caption.
 */
async function sendWhatsAppImage(recipientNumber, imageUrl, captionText) {
  const whatsappToken = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  if (!whatsappToken || !phoneNumberId) {
    throw new Error('Missing WhatsApp configuration (WHATSAPP_TOKEN or PHONE_NUMBER_ID)');
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: recipientNumber,
    type: 'image',
    image: {
      link: imageUrl,
      caption: captionText
    }
  };

  const headers = {
    'Authorization': `Bearer ${whatsappToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Meta API Error Response (Image):', JSON.stringify({
        status: error.response.status,
        data: error.response.data
      }));
    } else {
      console.error('Error sending WhatsApp image:', error.message);
    }
    const metaErrorMessage = error.response?.data?.error?.message;
    throw new Error(metaErrorMessage || error.message || 'Failed to send WhatsApp image');
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

        let replyText;
        let imageUrl = null;
        let isLeadComplete = false;
        const userHistory = getHistory(from);

        try {
          // Call getAIReply with the user's message and current history
          const result = await getAIReply(textBody, userHistory);
          replyText = result.replyText;

          // Save the updated history back to the session store
          saveHistory(from, result.updatedHistory);

          // Check if an image is recommended in the reply
          // Format: [IMAGE: http...]
          const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\s\]]+)\]/i;
          const imageMatch = replyText.match(imageRegex);
          if (imageMatch) {
            imageUrl = imageMatch[1];
            // Remove the [IMAGE: ...] tag from the text
            replyText = replyText.replace(imageRegex, '').trim();
          }

          // Check for lead complete marker
          if (replyText.includes('[LEAD_COMPLETE]')) {
            isLeadComplete = true;
            // Remove [LEAD_COMPLETE] and replace with the confirmation message
            replyText = replyText.replace('[LEAD_COMPLETE]', 'Bahut acha! 🎉 Hamari team aapko jald hi contact karegi. Koi aur sawaal ho toh batayein!').trim();
          }
        } catch (error) {
          console.error('Error generating Gemini reply:', error.message);
          replyText = "Oops! Abhi kuch technical issue aa gaya. Thodi der mein dobara try karein 🙏";
        }
        
        try {
          if (imageUrl) {
            // Send image with caption (replyText)
            await sendWhatsAppImage(from, imageUrl, replyText);
            console.log(`Successfully sent image to: ${from}`);
          } else {
            // Send standard text message
            await sendWhatsAppMessage(from, replyText);
            console.log(`Successfully replied to: ${from}`);
          }

          // If the lead was complete, save it to Sheets and clear the history
          if (isLeadComplete) {
            await saveLead(from, textBody, new Date().toISOString());
            console.log("Lead saved for: " + from);
            clearHistory(from);
            console.log("History cleared for completed lead: " + from);
          }
        } catch (error) {
          // Log errors clearly but never crash the server
          console.error(`Failed to reply to ${from}:`, error.message);
        }
      }
    }
  }
}

// POST /webhook - Incoming message handler
router.post('/', (req, res) => {
  console.log("=== INCOMING WEBHOOK ===");
  console.log(JSON.stringify(req.body, null, 2));

  const body = req.body;
  const value = body.entry?.[0]?.changes?.[0]?.value;
  if (!value?.messages || value?.statuses) return res.sendStatus(200);

  const message = value.messages[0];
  if (!message || message.type !== 'text') return res.sendStatus(200);

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
