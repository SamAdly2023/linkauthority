const axios = require('axios');

/**
 * PayPal subscriptions.
 *
 * The whole of billing rests on one rule: a paid plan is granted only on
 * PayPal's own word. The browser tells us a subscription id; we ask PayPal
 * what that id actually is before believing any of it. Webhooks are verified
 * with PayPal's signature endpoint for the same reason - an unverified POST to
 * a billing webhook is a free upgrade for anyone who finds the URL.
 *
 * Configure with:
 *   PAYPAL_CLIENT_ID      - REST app client id
 *   PAYPAL_CLIENT_SECRET  - REST app secret
 *   PAYPAL_PLAN_ID        - the subscription plan being sold
 *   PAYPAL_WEBHOOK_ID     - id of the webhook registered in the PayPal app
 *   PAYPAL_ENV            - 'live' or 'sandbox' (default sandbox, so a missing
 *                           value can never take real money by accident)
 */

const isLive = () => 'live' === String(process.env.PAYPAL_ENV || '').toLowerCase();

const apiBase = () => (isLive() ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

const clientId = () => process.env.PAYPAL_CLIENT_ID || '';
const clientSecret = () => process.env.PAYPAL_CLIENT_SECRET || '';
const planId = () => process.env.PAYPAL_PLAN_ID || '';
const webhookId = () => process.env.PAYPAL_WEBHOOK_ID || '';

/** Billing is off until every part of it is configured, rather than half-working. */
const enabled = () => Boolean(clientId() && clientSecret() && planId());

let cachedToken = null;

/**
 * An OAuth2 access token, reused until shortly before it expires.
 *
 * @returns {Promise<string>}
 */
const accessToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.value;
  }

  const res = await axios.post(
    `${apiBase()}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: clientId(), password: clientSecret() },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    }
  );

  cachedToken = {
    value: res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in || 3000) * 1000
  };

  return cachedToken.value;
};

/**
 * What PayPal says about a subscription.
 *
 * @param {string} subscriptionId
 * @returns {Promise<object>}
 */
const getSubscription = async (subscriptionId) => {
  const token = await accessToken();
  const res = await axios.get(`${apiBase()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000
  });

  return res.data;
};

/**
 * Cancels a subscription. PayPal keeps it active until the period ends.
 *
 * @param {string} subscriptionId
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
const cancelSubscription = async (subscriptionId, reason = 'Cancelled from the LinkAuthority dashboard') => {
  const token = await accessToken();
  await axios.post(
    `${apiBase()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { reason: String(reason).slice(0, 127) },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
  );

  return true;
};

/**
 * Whether a webhook really came from PayPal.
 *
 * Returns false on any doubt at all, including a missing PAYPAL_WEBHOOK_ID:
 * an event we cannot verify is an event we do not act on.
 *
 * @param {object} headers Request headers.
 * @param {object} event   Parsed webhook body.
 * @returns {Promise<boolean>}
 */
const verifyWebhook = async (headers, event) => {
  if (!webhookId() || !event) return false;

  const required = [
    'paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id',
    'paypal-transmission-sig', 'paypal-transmission-time'
  ];
  if (required.some(h => !headers[h])) return false;

  try {
    const token = await accessToken();
    const res = await axios.post(
      `${apiBase()}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId(),
        webhook_event: event
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );

    return 'SUCCESS' === res.data.verification_status;
  } catch (err) {
    console.error('PayPal webhook verification failed:', err.response?.data || err.message);
    return false;
  }
};

/**
 * The statuses that mean the customer is currently paying. PayPal keeps a
 * cancelled subscription ACTIVE until the paid period ends, which is the
 * behaviour we want: cancelling should not cut off access already bought.
 */
const ACTIVE_STATUSES = ['ACTIVE', 'APPROVED'];

/**
 * Turns a PayPal subscription into what we store on the user.
 *
 * @param {object} subscription
 * @returns {{plan: 'pro'|'free', status: string, subscriptionId: string, renewsAt: string|null}}
 */
const planFrom = (subscription) => ({
  plan: ACTIVE_STATUSES.includes(subscription.status) ? 'pro' : 'free',
  status: subscription.status,
  subscriptionId: subscription.id,
  renewsAt: subscription.billing_info?.next_billing_time || null
});

module.exports = {
  enabled,
  isLive,
  clientId,
  planId,
  webhookId,
  accessToken,
  getSubscription,
  cancelSubscription,
  verifyWebhook,
  planFrom,
  ACTIVE_STATUSES
};
