const axios = require('axios');
const keys = require('../config/keys');

// You should add GHL_WEBHOOK_URL to your .env file or keys.js
// Example: https://services.leadconnectorhq.com/hooks/your-webhook-id

const sendNotification = async (event, user, data = {}) => {
  const webhookUrl = keys.ghlWebhookUrl || process.env.GHL_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('GHL_WEBHOOK_URL not configured. Skipping notification.');
    return;
  }

  const payload = {
    event,
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      id: user._id
    },
    data,
    timestamp: new Date().toISOString()
  };

  try {
    await axios.post(webhookUrl, payload);
    console.log(`Notification sent to GHL: ${event}`);
  } catch (error) {
    console.error('Failed to send GHL notification:', error.message);
  }
};

module.exports = { sendNotification };
