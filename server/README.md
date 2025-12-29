# LinkAuthority Backend

## Setup

1.  Navigate to the `server` directory: `cd server`
2.  Install dependencies: `npm install`
3.  Create a `.env` file based on `.env.example` and fill in your credentials.
    *   **GOOGLE_CLIENT_ID** & **GOOGLE_CLIENT_SECRET**: Get these from the [Google Cloud Console](https://console.cloud.google.com/).
    *   **MONGO_URI**: Get this from [MongoDB Atlas](https://www.mongodb.com/atlas).
    *   **COOKIE_KEY**: Any random string.
4.  Run the server: `npm start` (or `npm run dev` for development).

## Deployment

Deploy this folder as a Web Service on Render (or similar platform).
Ensure you set the Environment Variables in the deployment settings.
