const axios = require('axios');

/**
 * Domain authority from a real link graph.
 *
 * This replaces an earlier implementation that asked an LLM to guess a score
 * from the URL string, and fell back to Math.random() when the API key was
 * missing - so every score in the product was invented. A number presented to
 * users as a measurement has to be measured.
 *
 * Source is Open PageRank (openpagerank.com), which derives scores from the
 * Common Crawl link graph. It is a 0-10 scale, not Moz's 0-100 Domain
 * Authority, and is reported as such rather than relabelled.
 *
 * With no API key configured this returns null. Null means "not measured" and
 * must be displayed that way - never as a zero, and never as a guess.
 */

const SCALE_MAX = 10;

const hostOf = (url) => {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch (err) {
    return null;
  }
};

/**
 * @param {string[]} urls
 * @returns {Promise<Object<string, object|null>>} keyed by hostname
 */
const lookupMany = async (urls) => {
  const key = process.env.OPEN_PAGERANK_API_KEY;
  const hosts = [...new Set(urls.map(hostOf).filter(Boolean))];

  if (!hosts.length) return {};

  if (!key) {
    // No key: every host is explicitly unmeasured rather than silently zero.
    return Object.fromEntries(hosts.map(h => [h, null]));
  }

  const out = {};

  // The API takes up to 100 domains per request.
  for (let i = 0; i < hosts.length; i += 100) {
    const batch = hosts.slice(i, i + 100);
    const qs = batch.map(h => `domains[]=${encodeURIComponent(h)}`).join('&');

    try {
      const res = await axios.get(`https://openpagerank.com/api/v1.0/getPageRank?${qs}`, {
        headers: { 'API-OPR': key },
        timeout: 12000
      });

      for (const row of res.data?.response || []) {
        const host = String(row.domain || '').toLowerCase();
        if (!host) continue;

        const found = 200 === row.status_code && null !== row.page_rank_decimal;

        out[host] = found
          ? {
              score: Number(row.page_rank_decimal),
              scale: SCALE_MAX,
              globalRank: row.rank ? Number(row.rank) : null,
              source: 'Open PageRank',
              checkedAt: new Date()
            }
          : null;
      }
    } catch (err) {
      console.error('Open PageRank lookup failed:', err.message);
      for (const h of batch) {
        if (!(h in out)) out[h] = null;
      }
    }
  }

  for (const h of hosts) {
    if (!(h in out)) out[h] = null;
  }

  return out;
};

/**
 * @param {string} url
 * @returns {Promise<object|null>} null when unmeasured
 */
const lookup = async (url) => {
  const host = hostOf(url);
  if (!host) return null;

  const all = await lookupMany([url]);

  return all[host] || null;
};

const isConfigured = () => Boolean(process.env.OPEN_PAGERANK_API_KEY);

module.exports = { lookup, lookupMany, isConfigured, hostOf, SCALE_MAX };
