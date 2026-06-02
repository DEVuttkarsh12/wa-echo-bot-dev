const { google } = require('googleapis');

// Configure Google Sheets API client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Saves a lead's contact information to a Google Sheet.
 * @param {string} phone - The lead's phone number.
 * @param {string} message - The message body.
 * @param {string} timestamp - The ISO timestamp when the message was received.
 */
async function saveLead(phone, message, timestamp) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      console.error('Error: GOOGLE_SHEETS_ID is not configured.');
      return;
    }

    const range = 'Sheet1!A:D';
    const valueInputOption = 'USER_ENTERED';

    const values = [[timestamp, phone, message, 'New Lead']];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption,
      resource: {
        values,
      },
    });

    console.log(`Successfully saved lead to Google Sheets for phone: ${phone}`);
  } catch (error) {
    // Log error but do NOT crash the WhatsApp reply
    console.error('Error saving lead to Google Sheets:', error.message);
  }
}

module.exports = {
  saveLead,
};
