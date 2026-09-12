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

    // What the source is worth as a linker travels with the link, so the
    // report can be valued without a second lookup per row. Authority is the
    // source's own measured score, or null when it was never measured - never
    // a zero standing in for "unknown".
    const origin = {
      from: source.url,
      fromAuthority: Number.isFinite(source.domainAuthority) ? source.domainAuthority : null,
      fromCategory: source.category || null
    };

    if (!pageUrl) {
      links.push({
        ...origin,
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
        ...origin,
        page: pageUrl,
        status: hit.found ? 'live' : 'missing',
        anchor: hit.anchor,
        dofollow: hit.dofollow,
        rel: hit.rel || null
      });
    } catch (err) {
      links.push({
        ...origin,
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

/**
 * What one backlink is worth to the site receiving it.
 *
 * This is a label with its reasoning, not a score. The inputs are all real -
 * whether the link is live, whether it passes equity, the measured authority
 * of the domain sending it, and whether that domain is in the same line of
 * business - and the label says which of them drove it. The thresholds are
 * on Open PageRank's 0-10 scale, where most small-business sites sit between
 * one and three and anything at four or above is genuinely well linked.
 *
 * Nothing here estimates traffic, guesses a "link juice" figure, or invents a
 * number where the authority was never measured.
 *
 * @param {object} link           One entry from a report's `links`.
 * @param {string|null} category  The receiving site's category.
 * @returns {{label: 'strong'|'useful'|'modest'|'citation'|'none', reason: string, relevant: boolean}}
 */
const valueOf = (link, category) => {
  const relevant = Boolean(category && link.fromCategory && link.fromCategory === category);
  const relevance = relevant ? ' Same category as you, which search engines weight.' : '';

  if ('live' !== link.status) {
    const why = {
      missing: 'The partner page is up but the link to you is not on it.',
      unreachable: 'The partner page could not be fetched, so nothing can be confirmed.',
      'no-directory': 'The partner has no Business Partners page live.'
    }[link.status] || 'No live link.';
    return { label: 'none', reason: why, relevant };
  }

  if (false === link.dofollow) {
    return {
      label: 'citation',
      reason: 'Nofollow. Counts as a mention of your business but passes no ranking equity.' + relevance,
      relevant
    };
  }

  const auth = link.fromAuthority;

  if (null === auth || undefined === auth) {
    return {
      label: 'useful',
      reason: 'Dofollow. The source domain has not been measured yet, so its weight is unknown.' + relevance,
      relevant
    };
  }
  if (auth >= 4) {
    return { label: 'strong', reason: `Dofollow from a well-linked domain (${auth}/10).` + relevance, relevant };
  }
  if (auth >= 2) {
    return { label: 'useful', reason: `Dofollow from an established domain (${auth}/10).` + relevance, relevant };
  }
  return {
    label: 'modest',
    reason: `Dofollow, but the source has little authority of its own yet (${auth}/10). It will grow as they do.` + relevance,
    relevant
  };
};

/**
 * A report with every link valued, plus counts by value. Applied at read time
 * so reports cached before valuation existed are covered too.
 */
const valueReport = (report, category) => {
  if (!report) return null;

  const links = (report.links || []).map(l => ({ ...l, value: valueOf(l, category) }));
  const count = (label) => links.filter(l => l.value.label === label).length;

  return {
    ...report,
    links,
    byValue: {
      strong: count('strong'),
      useful: count('useful'),
      modest: count('modest'),
      citation: count('citation'),
      none: count('none'),
      relevant: links.filter(l => l.value.relevant && 'live' === l.status).length
    }
  };
};

module.exports = { auditBacklinks, refreshBacklinks, findLinkTo, hostOf, valueOf, valueReport };
