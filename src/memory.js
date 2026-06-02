const fs = require('fs');
const path = require('path');

const SESSION_FILE_PATH = path.join(__dirname, '..', 'sessions.json');
const MAX_HISTORY_LENGTH = 10; // Keep last 10 messages (5 turns) to stay under free tier token limits

// In-memory store
let sessions = {};

// Load sessions from disk on startup
try {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    const rawData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
    sessions = JSON.parse(rawData);
    console.log('Sessions loaded successfully from disk.');
  }
} catch (error) {
  console.error('Error loading sessions from disk:', error.message);
  sessions = {};
}

// Helper to save sessions to disk
function saveSessionsToDisk() {
  try {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save sessions to disk:', error.message);
  }
}

/**
 * Retrieves the chat history for a specific user.
 * @param {string} userId - The user's phone number.
 * @returns {Array} Array of message objects in Gemini chat format.
 */
function getHistory(userId) {
  if (!sessions[userId]) {
    sessions[userId] = [];
  }
  return sessions[userId];
}

/**
 * Updates the history for a specific user.
 * @param {string} userId - The user's phone number.
 * @param {Array} history - The updated history array.
 */
function saveHistory(userId, history) {
  // Enforce max history length
  if (history.length > MAX_HISTORY_LENGTH) {
    sessions[userId] = history.slice(history.length - MAX_HISTORY_LENGTH);
  } else {
    sessions[userId] = history;
  }
  saveSessionsToDisk();
}

/**
 * Clears the history for a specific user (e.g. after lead is complete).
 * @param {string} userId - The user's phone number.
 */
function clearHistory(userId) {
  delete sessions[userId];
  saveSessionsToDisk();
}

module.exports = {
  getHistory,
  saveHistory,
  clearHistory,
};
