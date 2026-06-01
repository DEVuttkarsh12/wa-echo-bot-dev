const axios = require('axios');

/**
 * Sends a text message to a WhatsApp number.
 * @param {string} recipientNumber - The WhatsApp number of the recipient.
 * @param {string} messageText - The message to be sent.
 * @returns {Promise<object>} The response data from Meta API.
 */
async function sendWhatsAppMessage(recipientNumber, messageText) {
  const whatsappToken = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  if (!whatsappToken || !phoneNumberId) {
    throw new Error('Missing WhatsApp configuration (WHATSAPP_TOKEN or PHONE_NUMBER_ID)');
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: recipientNumber,
    type: 'text',
    text: { body: messageText }
  };

  const headers = {
    'Authorization': `Bearer ${whatsappToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
    // Avoid logging the entire Axios error object, which contains request config/headers that expose the token.
    if (error.response) {
      console.error('Meta API Error Response:', JSON.stringify({
        status: error.response.status,
        data: error.response.data
      }));
    } else {
      console.error('Error sending WhatsApp message:', error.message);
    }
    
    // Throw a clean error message derived from Meta response or connection error
    const metaErrorMessage = error.response?.data?.error?.message;
    throw new Error(metaErrorMessage || error.message || 'Failed to send WhatsApp message');
  }
}

module.exports = { sendWhatsAppMessage };
