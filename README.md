# WhatsApp Cloud API Real Estate AI Agent

A production-ready Node.js and Express AI Agent for WhatsApp Cloud API. This application handles the webhook verification handshake from Meta, integrates with Gemini AI to converse as a real estate assistant (Aryan), and saves complete lead details to a Google Sheet automatically.

## Table of Contents
- [Folder Structure](#folder-structure)
- [Local Setup & Installation](#local-setup--installation)
- [How to Run Locally](#how-to-run-locally)
- [File Explanations](#file-explanations)
- [Deployment to Render](#deployment-to-render)
- [Meta Webhook Configuration](#meta-webhook-configuration)

---

## Folder Structure

```text
wa-echo-bot-dev/
├── src/
│   ├── index.js          (Express server entry point)
│   ├── webhook.js        (webhook verification + incoming message handler)
│   ├── whatsapp.js       (reusable function to send WhatsApp messages)
│   ├── gemini.js         (Gemini AI assistant integration)
│   └── sheets.js         (Google Sheets lead saving integration)
├── .env.example          (template showing required variables, no real values)
├── .gitignore            (must block .env, node_modules, .DS_Store)
├── package.json
└── README.md
```

---

## Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd wa-echo-bot-dev
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create your local `.env` file from the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and populate it with your configuration:
   ```env
   VERIFY_TOKEN=wh_verify_x9k2m7p4q1
   WHATSAPP_TOKEN=your_meta_system_user_access_token_here
   PHONE_NUMBER_ID=your_whatsapp_phone_number_id_here
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   GOOGLE_SHEETS_ID=your_google_sheets_id_here
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email_here
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   ```
   > **Note:** The `.env` file is excluded from Git to prevent exposing credentials.

---

## How to Run Locally

Start the development server with local environment variables loaded:
```bash
npm run dev
```
The server will start on http://localhost:3000.

---

## File Explanations

* `src/index.js` - Express server entry point that verifies environment variables, exposes the health check route, and registers the webhook route.
* `src/webhook.js` - Router containing webhook verification handshake (GET) and incoming message processing via Gemini AI and Google Sheets (POST).
* `src/whatsapp.js` - Reusable module that makes requests using Axios to the Meta Graph API to send WhatsApp messages.
* `src/gemini.js` - Integration wrapper for `@google/generative-ai` SDK using `gemini-1.5-flash` with a tailored system instruction for real estate lead qualification.
* `src/sheets.js` - Helper that authenticates with Google Sheets API using service account credentials and appends completed lead data.
* `.env.example` - A template containing all required environment variables with empty values.
* `.gitignore` - Configures Git to ignore Node dependencies, system files, and local configuration containing credentials.
* `package.json` - Manages project metadata, Node.js engine specification, scripts, and dependencies.

---

## Deployment to Render

This project is configured to run smoothly on the **Render Free Tier**.

1. **Push your code to GitHub or GitLab:**
   Ensure all local changes are committed and pushed to a repository on GitHub or GitLab.

2. **Create a New Web Service on Render:**
   - Log in to your [Render Dashboard](https://dashboard.render.com/).
   - Click **New +** and select **Web Service**.
   - Connect your GitHub/GitLab repository.

3. **Configure the Web Service Settings:**
   - **Name:** `wa-echo-bot-dev`
   - **Language:** `Node`
   - **Branch:** `main` (or your default branch)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

4. **Set up Environment Variables on Render:**
   Under the **Environment** tab, click **Add Environment Variable** and enter:
   - `VERIFY_TOKEN`: Choose a secure verification token (e.g., `wh_verify_x9k2m7p4q1`).
   - `WHATSAPP_TOKEN`: Your Meta Permanent Access Token.
   - `PHONE_NUMBER_ID`: The Phone Number ID from your App Dashboard.
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - `GOOGLE_SHEETS_ID`: The target Google Spreadsheet ID.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Your Google Service Account email.
   - `GOOGLE_PRIVATE_KEY`: Your Google Service Account Private Key.
   - (Optional) `PORT`: Render sets this automatically, but you can explicitly specify it.

5. **Deploy:**
   Click **Create Web Service**. Render will build and start your application. Once complete, your service will be live at a URL like `https://wa-echo-bot-dev.onrender.com`.

---

## Meta Webhook Configuration

1. **Select Your App:**
   Go to the [Meta App Dashboard](https://developers.facebook.com/) and navigate to your WhatsApp app.

2. **Setup Webhooks:**
   - On the left-hand sidebar, under **WhatsApp**, click **Configuration**.
   - Under **Webhook**, click **Edit**.
   - **Callback URL:** Enter your Render application URL followed by `/webhook` (e.g., `https://wa-echo-bot-dev.onrender.com/webhook`).
   - **Verify Token:** Enter the value matching your `VERIFY_TOKEN` (e.g., `wh_verify_x9k2m7p4q1`).
   - Click **Verify and save**.

3. **Subscribe to Message Events:**
   - Under **Webhook fields**, locate **messages**.
   - Click **Subscribe** next to it.
   - The bot is now ready to receive WhatsApp text messages and respond!
