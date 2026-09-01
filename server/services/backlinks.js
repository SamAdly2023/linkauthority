const axios = require('axios');
const cheerio = require('cheerio');

const { db } = require('./firebase');
const { findLiveDirectory } = require('./reciprocity');

/**
 * Verified backlink analytics for a member site.
 *
 * Every other network member hosts a directory that should contain a link back
 * to this site. Rather than estimating anything, this fetches those pages and
 * records what is actually on them: whether the link is present, what anchor
 * text it uses, and whether it is dofollow. A member can then be shown the
 * links they are genuinely receiving, not a number we invented.
 */

const hostOf = (url) => {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch (err) {
    return null;
  }
};

/**
 * Looks for a link to `targetUrl` in the given HTML.
 *
 * @param {string} html
 * @param {string} targetUrl
 * @returns {{found: boolean, href: string|null, anchor: string|null, dofollow: boolean|null}}
 */
const findLinkTo = (html, targetUrl) => {
  const target = hostOf(targetUrl);
  if (!target) {
    return { found: false, href: null, anchor: null, dofollow: null };
  }

  const $ = cheerio.load(html);
  let hit = null;

  $('a[href]').each((_, el) => {
    if (hit) return;

    const href = $(el).attr('href');
    if (hostOf(href) !== target) return;

    const rel = String($(el).attr('rel') || '').toLowerCase();

    hit = {
      found: true,
      href,
      anchor: $(el).text().trim().slice(0, 120) || null,
      // Anything that strips equity counts as not dofollow.
      dofollow: !/\b(nofollow|ugc|sponsored)\b/.test(rel),
      rel: rel || null
    };
  });

  return hit || { found: false, href: null, anchor: null, dofollow: null, rel: null };
};

/**
 * Checks every other active member for a live link back to this site.
 *
 * @param {object} website  The site being audited.
 * @returns {Promise<object>} Report, also suitable for storing.
 */
const auditBacklinks = async (website) => {
  const targetHost = hostOf(website.url);
  if (!targetHost) {
    throw new Error('Website has no usable URL');
  }

  const snap = await db.collection('websites').where('isActive', '==', true).get();
  const others = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(s => s.id !== website.id && s.url && hostOf(s.url) !== targetHost);

  const links = [];

  for (const source of others) {
    const pageUrl = await findLiveDirectory(source);

    if (!pageUrl) {
      links.push({
        from: source.url,
        page: null,
        status: 'no-directory',
        anchor: null,
        dofollow: null
      });
      continue;
    }

    try {
      const res = await axios.get(pageUrl, {
        headers: { 'User-Agent': 'LinkAuthority-Bot/1.0' },
        timeout: 10000,
        maxRedirects: 5
      });

      const hit = findLinkTo(res.data, website.url);

      links.push({
        from: source.url,
        page: pageUrl,
        status: hit.found ? 'live' : 'missing',
        anchor: hit.anchor,
        dofollow: hit.dofollow,
        rel: hit.rel || null
      });
    } catch (err) {
      links.push({
        from: source.url,
        page: pageUrl,
        status: 'unreachable',
        anchor: null,
        dofollow: null
      });
    }
  }

  const live = links.filter(l => 'live' === l.status);

  return {
    checkedAt: new Date(),
    networkSize: others.length,
    totals: {
      live: live.length,
      dofollow: live.filter(l => true === l.dofollow).length,
      nofollow: live.filter(l => false === l.dofollow).length,
      missing: links.filter(l => 'missing' === l.status).length,
      unreachable: links.filter(l => 'unreachable' === l.status).length,
      noDirectory: links.filter(l => 'no-directory' === l.status).length
    },
    links
  };
};

/**
 * Runs the audit and caches it on the website document.
 */
const refreshBacklinks = async (website) => {
  const report = await auditBacklinks(website);
  await db.collection('websites').doc(website.id).update({ backlinkReport: report });

  return report;
};

module.exports = { auditBacklinks, refreshBacklinks, findLinkTo, hostOf };
