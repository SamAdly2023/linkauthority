const { db } = require('./firebase');

/**
 * What each plan allows.
 *
 * The free plan is a working product, not a demo: one site, its broken links
 * found and listed, the redirect guard, and a check every day. What Pro buys
 * is scale and speed - more sites, checks on demand, and being told the day
 * something breaks rather than finding out on the next visit.
 *
 * Deliberately not gated: finding a broken link, and the guard that writes a
 * redirect when you rename a page. Charging for those would mean a paying
 * customer's links survive and a free user's quietly die, which is the exact
 * harm the product exists to prevent.
 */

const PRO = {
  name: 'Pro',
  price: '29',
  currency: 'USD',
  interval: 'month',
  includes: [
    'Unlimited websites on one account',
    'Check links on demand, as often as you like',
    'Unlimited placements you add by hand',
    'Email alert the day a link breaks'
  ]
};

const FREE_LIMITS = {
  websites: 1,
  manualLinks: 5,
  verifyEveryHours: 24
};

const PRO_VERIFY_MINUTES = 15;

/**
 * @param {object|null} user
 * @returns {boolean}
 */
const isPro = (user) => 'pro' === (user && user.plan);

/**
 * Reads the plan for a user id. Anything unreadable is treated as free, which
 * fails towards the limit rather than towards giving away the paid tier.
 *
 * @param {string} userId
 * @returns {Promise<{plan: string, pro: boolean}>}
 */
const planFor = async (userId) => {
  if (!userId) return { plan: 'free', pro: false };

  try {
    const doc = await db.collection('users').doc(String(userId)).get();
    const plan = doc.exists ? doc.data().plan || 'free' : 'free';

    return { plan, pro: 'pro' === plan };
  } catch (err) {
    console.error('Plan lookup failed:', err.message);
    return { plan: 'free', pro: false };
  }
};

/**
 * How long a site must wait between on-demand link checks.
 *
 * @param {boolean} pro
 * @returns {number} milliseconds
 */
const verifyIntervalMs = (pro) =>
  pro ? PRO_VERIFY_MINUTES * 60 * 1000 : FREE_LIMITS.verifyEveryHours * 60 * 60 * 1000;

/**
 * The message shown when a free account reaches a limit. Says what the limit
 * is and what lifts it, so it reads as information rather than a wall.
 *
 * @param {'websites'|'manualLinks'|'verify'} limit
 * @returns {string}
 */
const limitMessage = (limit) => ({
  websites: `A free account covers ${FREE_LIMITS.websites} website. Pro covers as many as you like.`,
  manualLinks: `A free account can track ${FREE_LIMITS.manualLinks} links you add by hand. Links discovered from your own traffic are never limited.`,
  verify: `Free accounts check links once every ${FREE_LIMITS.verifyEveryHours} hours. Pro checks on demand.`
}[limit] || 'That is beyond what a free account covers.');

module.exports = { PRO, FREE_LIMITS, PRO_VERIFY_MINUTES, isPro, planFor, verifyIntervalMs, limitMessage };
