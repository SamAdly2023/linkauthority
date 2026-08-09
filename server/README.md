# LinkAuthority Backend

## Setup

1.  Navigate to the `server` directory: `cd server`
2.  Install dependencies: `npm install`
3.  Create a `.env` file based on `.env.example` and fill in your credentials.
    *   **FIREBASE_SERVICE_ACCOUNT**: JSON service account key from your [Firebase Console](https://console.firebase.google.com/) (Project Settings > Service Accounts). Alternatively, place the file at `server/config/firebase-service-account.json`.
    *   **GEMINI_API_KEY**: Get this from [Google AI Studio](https://aistudio.google.com/).
    *   **EMAIL_USER** / **EMAIL_PASS**: SMTP credentials used to send transactional emails.
    *   **GHL_WEBHOOK_URL**: Optional GoHighLevel webhook for CRM sync and notifications.
4.  Run the server: `npm start` (or `npm run dev` for development).

## Deployment

Deploy this folder as a Web Service on Render (or similar platform).
Ensure you set the Environment Variables in the deployment settings.
