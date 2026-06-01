// Load environment variables locally if dotenv is available
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (error) {
    // dotenv is a devDependency and may not be present in production
  }
}

const express = require('express');
const webhookRouter = require('./webhook');


// List of required environment variables
const REQUIRED_ENV_VARS = ['VERIFY_TOKEN', 'WHATSAPP_TOKEN', 'PHONE_NUMBER_ID'];

// Check environment variables on startup
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('================================================================');
  console.error('CRITICAL WARNING: Missing required environment variables on startup!');
  console.error(`Missing variables: ${missingVars.join(', ')}`);
  console.error('Please configure these in your .env file or deployment dashboard.');
  console.error('================================================================');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON payloads
app.use(express.json());

// Root route (Render health check)
app.get('/', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send('WhatsApp Echo Bot is running ✅');
  } catch (error) {
    console.error('Error handling root health check:', error.message);
    res.status(500).send('Error');
  }
});

// Register webhook routes
app.use('/webhook', webhookRouter);

// Global 404 handler for unmatched routes
app.use((req, res) => {
  res.sendStatus(404);
});

// Global error handler to prevent server crashes from bad payloads or request parsing failures
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err.message);
  res.status(500).send('Internal Server Error');
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});

// Handle unhandled promise rejections globally
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason?.message || reason);
});

// Handle uncaught exceptions globally
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error.message);
});
