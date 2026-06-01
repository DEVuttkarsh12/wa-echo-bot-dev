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

        const replyText = `You said: ${textBody}`;
        
        try {
          await sendWhatsAppMessage(from, replyText);
          console.log(`Successfully echoed message back to: ${from}`);
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
