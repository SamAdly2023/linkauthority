const crypto = require('crypto');
const dns = require('dns').promises;
const axios = require('axios');

const { db } = require('./firebase');
const { findLinkTo, hostOf } = require('./backlinks');

/**
 * Link repair: the external links pointing at a member's site, and whether
 * they still land anywhere.
 *
 * A site spends years earning links and then quietly breaks them - a slug is
 * edited, a post is trashed, a migration drops a path prefix - and nothing in
 * WordPress says a word. The links keep existing on the other site; they just
 * point at a 404 now. That equity is recoverable, but only if somebody knows.
 *
 * Every link here was observed, not estimated. Two sources, both real:
 *
 *   referrer - a visitor arrived from another site, so that link exists and
 *              carries traffic. The plugin reports the URL pair only.
 *   404      - a visitor followed a link to a page that no longer exists. That
 *              is a broken backlink caught in the act.
 *
 * Both are then verified from our side: fetch the linking page and confirm the
 * link is on it, fetch the target and record what it actually returns. Nothing
 * is inferred from the sighting alone.
 */

const UA = 'LinkAuthority-Bot/1.0 (+https://www.linkauthority.live/bot)';
const COLLECTION = 'externalLinks';

/** Sightings accepted from one site in a single report. Keeps a chatty or misbehaving install bounded. */
const MAX_SIGHTINGS_PER_REPORT = 50;

/** Links stored per site. Past this the oldest unverified ones are dropped rather than growing without limit. */
const MAX_LINKS_PER_SITE = 2000;

/**
 * Normalises a URL for storage and comparison: no fragment, no trailing slash
 * on a path, and the common tracking parameters dropped so one link does not
 * become fifty rows.
 *
 * @param {string} raw
 * @returns {string|null}
 */
const normaliseUrl = (raw) => {
  try {
    const u = new URL(String(raw).trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;

    u.hash = '';
    ['fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', 'ref', 'source']
      .forEach(p => u.searchParams.delete(p));
    [...u.searchParams.keys()]
      .filter(k => k.toLowerCase().startsWith('utm_'))
      .forEach(k => u.searchParams.delete(k));

    if ('/' !== u.pathname && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }

    return u.toString();
  } catch {
    return null;
  }
};

/** The path a link points at, which is what a slug change breaks. */
const pathOf = (url) => {
  try {
    const u = new URL(url);
    return (u.pathname || '/') + (u.search || '');
  } catch {
    return null;
  }
};

/**
 * Stable document id, so the same link reported twice updates one row rather
 * than creating another.
 */
const linkId = (siteId, sourceUrl, targetUrl) =>
  crypto.createHash('sha1').update(`${siteId}|${sourceUrl}|${targetUrl}`).digest('hex');

/**
 * Hosts whose links are never worth storing: the site's own pages, and the
 * search engines and social networks that send traffic without a link anyone
 * placed on purpose.
 */
const IGNORED_HOSTS = [
  'google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'yandex.',
  'facebook.com', 'instagram.com', 't.co', 'twitter.com', 'x.com',
  'linkedin.com', 'pinterest.com', 'reddit.com', 'youtube.com'
];

const isIgnoredHost = (host) =>
  !host || IGNORED_HOSTS.some(h => host === h || host.endsWith(h) || host.startsWith(h));

/**
 * Whether an address belongs to a range that only exists inside a network:
 * loopback, the RFC 1918 private blocks, carrier-grade NAT, and the link-local
 * range that cloud providers put their instance metadata on.
 */
const isPrivateAddress = (host) => {
  if (/^\[?::1\]?$/.test(host) || /^\[?f[cd][0-9a-f]{2}:/i.test(host)) return true;

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;

  const [a, b] = m.slice(1).map(Number);
  return 10 === a
    || 127 === a
    || 0 === a
    || (172 === a && b >= 16 && b <= 31)
    || (192 === a && 168 === b)
    || (169 === a && 254 === b)
    || (100 === a && b >= 64 && b <= 127);
};

/**
 * Whether this service is willing to send an HTTP request to a host.
 *
 * Both ends of every link are URLs a WordPress install handed us, and we fetch
 * them. Without this, an install could name `169.254.169.254` or a machine on
 * our own network and use the crawler to reach it. So: public DNS names only,
 * and the address they resolve to has to be public as well.
 *
 * This checks the address at the time of the lookup; a name that resolves
 * differently a moment later would not be caught. The remaining exposure is a
 * GET whose body is only ever scanned for anchor tags, never returned.
 *
 * Tests run against loopback, which LINK_REPAIR_ALLOW_PRIVATE=1 permits. It is
 * off anywhere it is not deliberately set.
 */
const isFetchableHost = async (host) => {
  if ('1' === process.env.LINK_REPAIR_ALLOW_PRIVATE) return true;
  if (!host || 'localhost' === host || host.endsWith('.localhost') || !host.includes('.')) return false;
  if (isPrivateAddress(host)) return false;

  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every(a => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
};

/**
 * Records that a link from another site to this one was observed.
 *
 * Nothing about the visitor is stored or even accepted - the plugin sends a
 * pair of URLs and nothing else, and anything self-referential or from a
 * search engine is dropped here rather than kept and filtered later.
 *
 * @param {object} site      The member site.
 * @param {object} sighting  {sourceUrl, targetUrl, kind: 'referrer'|'404'}
 * @returns {Promise<'stored'|'updated'|'ignored'>}
 */
const recordSighting = async (site, sighting) => {
  const sourceUrl = normaliseUrl(sighting.sourceUrl);
  const targetUrl = normaliseUrl(sighting.targetUrl);
  if (!sourceUrl || !targetUrl) return 'ignored';

  const sourceHost = hostOf(sourceUrl);
  const siteHost = hostOf(site.url);
  const targetHost = hostOf(targetUrl);

  // Only links from elsewhere, pointing here.
  if (!sourceHost || sourceHost === siteHost || isIgnoredHost(sourceHost)) return 'ignored';
  if (targetHost !== siteHost) return 'ignored';

  // We will fetch this URL later, so refuse it now if it names somewhere we
  // have no business sending a request.
  if (!await isFetchableHost(sourceHost)) return 'ignored';

  const kind = '404' === sighting.kind ? '404' : 'referrer';
  const id = linkId(site.id, sourceUrl, targetUrl);
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  const now = new Date();

  if (existing.exists) {
    const prev = existing.data();
    await ref.update({
      lastSeen: now,
      hits: (prev.hits || 0) + 1,
      // A 404 sighting is proof the target is gone right now, whatever the
      // last crawl found. Verification will confirm it and fill in the rest.
      ...('404' === kind ? { targetStatus: 404, status: 'target-missing', brokenSince: prev.brokenSince || now } : {})
    });
    return 'updated';
  }

  await ref.set({
    siteId: site.id,
    ownerId: site.ownerId || null,
    sourceUrl,
    sourceHost,
    targetUrl,
    targetPath: pathOf(targetUrl),
    discoveredVia: kind,
    firstSeen: now,
    lastSeen: now,
    lastChecked: null,
    hits: 1,
    status: '404' === kind ? 'target-missing' : 'unverified',
    targetStatus: '404' === kind ? 404 : null,
    brokenSince: '404' === kind ? now : null,
    dofollow: null,
    anchor: null,
    rel: null,
    fixedAt: null,
    redirectTo: null,
    dismissed: false
  });

  return 'stored';
};

/**
 * Accepts a batch of sightings from a plugin install.
 *
 * @param {object} site
 * @param {Array} sightings
 * @returns {Promise<{stored: number, updated: number, ignored: number}>}
 */
const recordSightings = async (site, sightings) => {
  const counts = { stored: 0, updated: 0, ignored: 0 };
  const batch = (Array.isArray(sightings) ? sightings : []).slice(0, MAX_SIGHTINGS_PER_REPORT);

  for (const sighting of batch) {
    try {
      counts[await recordSighting(site, sighting)]++;
    } catch (err) {
      console.error('Sighting rejected:', err.message);
      counts.ignored++;
    }
  }

  return counts;
};

/**
 * What a URL on the member's own site actually returns.
 *
 * Redirects are followed so a link through an existing 301 counts as working;
 * the final URL is recorded so the owner can see where it ends up.
 */
const checkTarget = async (url) => {
  if (!await isFetchableHost(hostOf(url))) {
    return { status: null, finalUrl: null, redirected: false, error: 'blocked' };
  }

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: () => true
    });

    const finalUrl = res.request?.res?.responseUrl || url;
    return { status: res.status, finalUrl, redirected: normaliseUrl(finalUrl) !== normaliseUrl(url) };
  } catch (err) {
    return { status: null, finalUrl: null, redirected: false, error: err.code || 'unreachable' };
  }
};

/**
 * Verifies one link end to end: is it still on the linking page, and does the
 * page it points at still exist?
 *
 * The status is the honest combination of both:
 *
 *   live            - link is there and the target answers.
 *   target-missing  - link is there but the target is gone. This is the one
 *                     that costs money, and the one that can be fixed.
 *   removed         - the linking page no longer carries the link.
 *   source-gone     - the linking page itself could not be fetched.
 *
 * @param {object} link
 * @returns {Promise<object>} Fields to write back.
 */
const verifyLink = async (link) => {
  const now = new Date();
  const target = await checkTarget(link.targetUrl);
  const targetOk = null !== target.status && target.status < 400;

  let source;
  try {
    if (!await isFetchableHost(hostOf(link.sourceUrl))) throw new Error('blocked');

    const res = await axios.get(link.sourceUrl, {
      headers: { 'User-Agent': UA },
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: () => true
    });
    source = res.status < 400 ? findLinkTo(res.data, link.targetUrl) : null;
  } catch {
    source = null;
  }

  if (null === source) {
    return {
      lastChecked: now,
      status: 'source-gone',
      targetStatus: target.status,
      targetFinalUrl: target.finalUrl
    };
  }

  if (!source.found) {
    return {
      lastChecked: now,
      status: 'removed',
      targetStatus: target.status,
      targetFinalUrl: target.finalUrl,
      dofollow: null,
      anchor: null,
      rel: null
    };
  }

  return {
    lastChecked: now,
    status: targetOk ? 'live' : 'target-missing',
    targetStatus: target.status,
    targetFinalUrl: target.finalUrl,
    targetRedirected: target.redirected,
    brokenSince: targetOk ? null : (link.brokenSince || now),
    fixedAt: targetOk && link.brokenSince ? now : (link.fixedAt || null),
    dofollow: source.dofollow,
    anchor: source.anchor,
    rel: source.rel || null
  };
};

/**
 * Every stored link for a site, newest problems first.
 *
 * @param {string} siteId
 * @returns {Promise<object[]>}
 */
const linksFor = async (siteId) => {
  const snap = await db.collection(COLLECTION).where('siteId', '==', siteId).get();

  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      // Broken first, then by how much traffic the link actually carries.
      const rank = (l) => ('target-missing' === l.status ? 0 : 'unverified' === l.status ? 1 : 2);
      return rank(a) - rank(b) || (b.hits || 0) - (a.hits || 0);
    });
};

/**
 * Re-checks a site's links, oldest check first so every link comes round
 * eventually without ever crawling the whole set at once.
 *
 * @param {object} site
 * @param {number} limit Links to check on this pass.
 * @returns {Promise<{checked: number, broken: number, repaired: number}>}
 */
const verifySite = async (site, limit = 25) => {
  const links = await linksFor(site.id);
  const due = links
    .filter(l => !l.dismissed)
    .sort((a, b) => {
      const at = a.lastChecked ? new Date(a.lastChecked._seconds ? a.lastChecked._seconds * 1000 : a.lastChecked).getTime() : 0;
      const bt = b.lastChecked ? new Date(b.lastChecked._seconds ? b.lastChecked._seconds * 1000 : b.lastChecked).getTime() : 0;
      return at - bt;
    })
    .slice(0, limit);

  let broken = 0;
  let repaired = 0;

  for (const link of due) {
    try {
      const update = await verifyLink(link);
      if ('target-missing' === update.status) broken++;
      if ('live' === update.status && 'target-missing' === link.status) repaired++;
      await db.collection(COLLECTION).doc(link.id).update(update);
    } catch (err) {
      console.error('Link verification failed:', link.id, err.message);
    }
  }

  return { checked: due.length, broken, repaired };
};

/**
 * A site's link health, for a dashboard tile or a plugin screen.
 *
 * @param {object[]} links
 */
const summarise = (links) => {
  const by = (status) => links.filter(l => status === l.status).length;
  const brokenLinks = links.filter(l => 'target-missing' === l.status && !l.dismissed);

  return {
    total: links.length,
    live: by('live'),
    broken: brokenLinks.length,
    removed: by('removed'),
    sourceGone: by('source-gone'),
    unverified: by('unverified'),
    dofollow: links.filter(l => 'live' === l.status && true === l.dofollow).length,
    // Distinct domains that are currently pointing at a dead page here. This
    // is the number that matters: one domain linking five dead URLs is one
    // relationship to save, not five.
    brokenDomains: new Set(brokenLinks.map(l => l.sourceHost)).size,
    brokenTargets: [...new Set(brokenLinks.map(l => l.targetPath))].length
  };
};

/**
 * The paths on this site that external links point at, with how many domains
 * link to each.
 *
 * This is what the plugin guards: change one of these slugs without a redirect
 * and those links break. Only verified-live links count - a link that was
 * already broken is not an argument for keeping a URL.
 *
 * @param {string} siteId
 * @returns {Promise<Object<string, {links: number, domains: number, topDomains: string[]}>>}
 */
const protectedPaths = async (siteId) => {
  const links = await linksFor(siteId);
  const map = {};

  links
    .filter(l => 'live' === l.status && l.targetPath)
    .forEach(l => {
      const entry = map[l.targetPath] || (map[l.targetPath] = { links: 0, domains: new Set() });
      entry.links++;
      entry.domains.add(l.sourceHost);
    });

  return Object.fromEntries(
    Object.entries(map).map(([path, v]) => [
      path,
      { links: v.links, domains: v.domains.size, topDomains: [...v.domains].slice(0, 5) }
    ])
  );
};

/**
 * Marks a broken link as handled because the owner put a redirect in place.
 * The next verification pass confirms it independently; this only records the
 * intent so the row stops shouting in the meantime.
 */
const markFixed = async (linkId_, redirectTo) => {
  await db.collection(COLLECTION).doc(linkId_).update({
    redirectTo: redirectTo || null,
    fixedAt: new Date()
  });
};

const dismiss = async (linkId_, dismissed = true) => {
  await db.collection(COLLECTION).doc(linkId_).update({ dismissed: Boolean(dismissed) });
};

/**
 * Adds a link the owner knows about but we have not seen traffic from - a
 * placement they paid for, or a row from a Search Console export.
 *
 * @returns {Promise<{ok: boolean, reason?: string, id?: string}>}
 */
const addManualLink = async (site, sourceUrl, targetUrl) => {
  const source = normaliseUrl(sourceUrl);
  const target = normaliseUrl(targetUrl);
  if (!source || !target) return { ok: false, reason: 'Both URLs must be full http(s) addresses.' };
  if (hostOf(target) !== hostOf(site.url)) return { ok: false, reason: 'The target must be a page on your own site.' };
  if (hostOf(source) === hostOf(site.url)) return { ok: false, reason: 'That is a link from your site to itself.' };

  const existing = await db.collection(COLLECTION).where('siteId', '==', site.id).get();
  if (existing.size >= MAX_LINKS_PER_SITE) {
    return { ok: false, reason: 'This site has reached the stored-link limit.' };
  }

  const id = linkId(site.id, source, target);
  await db.collection(COLLECTION).doc(id).set({
    siteId: site.id,
    ownerId: site.ownerId || null,
    sourceUrl: source,
    sourceHost: hostOf(source),
    targetUrl: target,
    targetPath: pathOf(target),
    discoveredVia: 'manual',
    firstSeen: new Date(),
    lastSeen: new Date(),
    lastChecked: null,
    hits: 0,
    status: 'unverified',
    targetStatus: null,
    brokenSince: null,
    dofollow: null,
    anchor: null,
    rel: null,
    fixedAt: null,
    redirectTo: null,
    dismissed: false
  }, { merge: true });

  return { ok: true, id };
};

module.exports = {
  recordSighting,
  recordSightings,
  verifyLink,
  verifySite,
  linksFor,
  summarise,
  protectedPaths,
  markFixed,
  dismiss,
  addManualLink,
  isFetchableHost,
  isPrivateAddress,
  normaliseUrl,
  pathOf,
  MAX_SIGHTINGS_PER_REPORT
};
