const requireLogin = require('../middlewares/requireLogin');
const { db } = require('../services/firebase');
const paypal = require('../services/paypal');
const { PRO, FREE_LIMITS } = require('../services/plan');

/**
 * Billing.
 *
 * A subscription id arriving from a browser is a claim, not a fact, so every
 * path here asks PayPal what that id really is before writing a plan. The
 * webhook is verified with PayPal's signature endpoint, without which the URL
 * would be a free upgrade for anyone who found it.
 */

module.exports = (app) => {
  const userDoc = (id) => db.collection('users').doc(String(id));

  const readUser = async (id) => {
    const doc = await userDoc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  };

  /**
   * Stores what PayPal reported. Nothing here is taken from the request body.
   */
  const applySubscription = async (userId, subscription) => {
    const state = paypal.planFrom(subscription);

    await userDoc(userId).set(
      {
        plan: state.plan,
        billing: {
          provider: 'paypal',
          subscriptionId: state.subscriptionId,
          status: state.status,
          renewsAt: state.renewsAt,
          planId: subscription.plan_id || null,
          updatedAt: new Date()
        }
      },
      { merge: true }
    );

    return state;
  };

  // What the pricing screen needs to render itself, including whether billing
  // is configured at all - an unconfigured deployment shows no buy button
  // rather than one that fails on click.
  app.get('/api/billing', requireLogin, async (req, res) => {
    try {
      const user = await readUser(req.user.id);

      res.send({
        enabled: paypal.enabled(),
        live: paypal.isLive(),
        clientId: paypal.enabled() ? paypal.clientId() : null,
        planId: paypal.enabled() ? paypal.planId() : null,
        plan: user?.plan || 'free',
        billing: user?.billing
          ? {
              status: user.billing.status || null,
              renewsAt: user.billing.renewsAt || null,
              subscriptionId: user.billing.subscriptionId || null
            }
          : null,
        pro: PRO,
        freeLimits: FREE_LIMITS
      });
    } catch (err) {
      console.error('Billing status failed:', err);
      res.status(500).send({ error: 'Could not load billing' });
    }
  });

  // Called once the buyer approves in PayPal's popup. The id is checked
  // against PayPal, and against the plan we actually sell, before it counts.
  app.post('/api/billing/activate', requireLogin, async (req, res) => {
    if (!paypal.enabled()) return res.status(503).send({ error: 'Billing is not configured' });

    const { subscriptionId } = req.body || {};
    if (!subscriptionId || !/^[A-Za-z0-9-]{3,64}$/.test(String(subscriptionId))) {
      return res.status(400).send({ error: 'A subscription id is required' });
    }

    try {
      const subscription = await paypal.getSubscription(subscriptionId);

      if (subscription.plan_id !== paypal.planId()) {
        return res.status(400).send({ error: 'That subscription is for a different plan' });
      }

      if (!paypal.ACTIVE_STATUSES.includes(subscription.status)) {
        return res.status(400).send({ error: `PayPal reports this subscription as ${subscription.status}` });
      }

      // One subscription, one account. Without this the same id could be
      // pasted into a second account to upgrade it for free.
      const claimed = await db.collection('users').where('billing.subscriptionId', '==', subscription.id).get();
      const otherOwner = claimed.docs.find(d => d.id !== String(req.user.id));
      if (otherOwner) {
        return res.status(409).send({ error: 'That subscription is already linked to another account' });
      }

      const state = await applySubscription(req.user.id, subscription);

      res.send({ ok: true, ...state });
    } catch (err) {
      console.error('Subscription activation failed:', err.response?.data || err.message);
      res.status(502).send({ error: 'PayPal could not confirm that subscription' });
    }
  });

  // Re-reads the subscription from PayPal. Useful after a payment failure, and
  // as a fallback if a webhook was ever missed.
  app.post('/api/billing/refresh', requireLogin, async (req, res) => {
    if (!paypal.enabled()) return res.status(503).send({ error: 'Billing is not configured' });

    try {
      const user = await readUser(req.user.id);
      const id = user?.billing?.subscriptionId;
      if (!id) return res.send({ plan: user?.plan || 'free', status: null });

      const state = await applySubscription(req.user.id, await paypal.getSubscription(id));
      res.send({ ok: true, ...state });
    } catch (err) {
      console.error('Subscription refresh failed:', err.response?.data || err.message);
      res.status(502).send({ error: 'PayPal could not be reached' });
    }
  });

  app.post('/api/billing/cancel', requireLogin, async (req, res) => {
    if (!paypal.enabled()) return res.status(503).send({ error: 'Billing is not configured' });

    try {
      const user = await readUser(req.user.id);
      const id = user?.billing?.subscriptionId;
      if (!id) return res.status(400).send({ error: 'There is no subscription to cancel' });

      await paypal.cancelSubscription(id);

      // Deliberately not downgraded here. PayPal leaves the subscription
      // running until the paid period ends, and so do we; the webhook moves
      // the account to free when it actually expires.
      const subscription = await paypal.getSubscription(id);
      const state = await applySubscription(req.user.id, subscription);

      res.send({ ok: true, ...state, message: 'Cancelled. Pro stays on until the end of the period you have paid for.' });
    } catch (err) {
      console.error('Subscription cancel failed:', err.response?.data || err.message);
      res.status(502).send({ error: 'PayPal could not cancel that subscription' });
    }
  });

  // PayPal's own notifications. Always answers 200 once the signature checks
  // out, because a non-2xx makes PayPal retry an event we have already stored.
  app.post('/api/billing/webhook', async (req, res) => {
    const event = req.body;

    if (!await paypal.verifyWebhook(req.headers, event)) {
      console.warn('Rejected an unverified PayPal webhook:', event?.event_type);
      return res.status(400).send({ error: 'Signature verification failed' });
    }

    try {
      const subscriptionId = event.resource?.id || event.resource?.billing_agreement_id;
      if (!subscriptionId) return res.send({ ok: true, ignored: event.event_type });

      const snap = await db.collection('users').where('billing.subscriptionId', '==', subscriptionId).limit(1).get();
      if (snap.empty) {
        console.warn('PayPal event for an unknown subscription:', subscriptionId, event.event_type);
        return res.send({ ok: true, unknown: true });
      }

      // Ask PayPal for the subscription rather than trusting the event body,
      // so one code path decides what a status means.
      const subscription = await paypal.getSubscription(subscriptionId);
      await applySubscription(snap.docs[0].id, subscription);

      res.send({ ok: true });
    } catch (err) {
      console.error('PayPal webhook handling failed:', err.response?.data || err.message);
      res.status(500).send({ error: 'Webhook handling failed' });
    }
  });
};

