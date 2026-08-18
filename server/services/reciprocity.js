const axios = require('axios');
const cheerio = require('cheerio');

const { db } = require('./firebase');
const { sendNotification } = require('./notification');
const { broadcastRefresh } = require('./partnerSync');

// A site is only deactivated after this many consecutive failed checks, so a
// morning of downtime or a slow host doesn't cost someone their listing.
const FAILURES_BEFORE_DEACTIVATION = 3;

/**
 * Candidate URLs for a site's partner directory, most likely first.
 */
const candidateUrls = (website) => {
  const base = String(website.url || '').replace(/\/$/, '');
  const urls = [];

  if (website.partnersPageUrl) urls.push(website.partnersPageUrl);
  urls.push(`${base}/business-partners/`);
  urls.push(`${base}/partners`);

  return [...new Set(urls)];
};

/**
 * True when the HTML actually renders the directory - either plugin's container,
 * or the JS widget's container/script tag.
 */
const pageHostsDirectory = (html) => {
  const $ = cheerio.load(html);

  return $('.linkauthority-partners-silo').length > 0
    || $('#linkauthority-partners-widget').length > 0
    || $('script[src*="widget.js"]').length > 0;
};

/**
 * Checks one site. Returns the URL that worked, or null.
 */
const findLiveDirectory = async (website) => {
  for (const url of candidateUrls(website)) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'LinkAuthority-Bot/1.0' },
        timeout: 10000,
        maxRedirects: 5
      });

      if (res.status === 200 && pageHostsDirectory(res.data)) {
        return url;
      }
    } catch (err) {
      // Try the next candidate; a 404 here just means "not at this path".
    }
  }

  return null;
};

/**
 * Daily reciprocity sweep.
 *
 * Members are listed on every other site in the network, so the network only
 * works if they are hosting it in return. Deactivating the plugin already
 * disconnects a site, but trashing the page, removing the shortcode, or never
 * creating the page at all were all invisible - the site stayed listed while
 * hosting nothing. This closes that.
 */
const checkReciprocity = async () => {
  console.log('RECIPROCITY: sweep starting');

  try {
    const snap = await db.collection('websites').where('isActive', '==', true).get();
    const sites = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.url);

    let ok = 0;
    let warned = 0;
    let deactivated = 0;

    for (const site of sites) {
      const liveUrl = await findLiveDirectory(site);

      if (liveUrl) {
        ok++;
        await db.collection('websites').doc(site.id).update({
          partnersPageUrl: liveUrl,
          reciprocityFailures: 0,
          reciprocityCheckedAt: new Date()
        });
        continue;
      }

      const failures = (site.reciprocityFailures || 0) + 1;

      if (failures < FAILURES_BEFORE_DEACTIVATION) {
        warned++;
        await db.collection('websites').doc(site.id).update({
          reciprocityFailures: failures,
          reciprocityCheckedAt: new Date()
        });

        if (1 === failures) {
          notifyOwner(site, 'warning',
            `We could not find the Business Partners directory on ${site.url}. Your listing stays live for now, but if we still can't find it after ${FAILURES_BEFORE_DEACTIVATION} daily checks it will be paused.`);
        }
        continue;
      }

      deactivated++;
      await db.collection('websites').doc(site.id).update({
        isActive: false,
        reciprocityFailures: failures,
        reciprocityCheckedAt: new Date(),
        deactivatedReason: 'partners-page-missing'
      });

      notifyOwner(site, 'error',
        `${site.url} has been paused because its Business Partners page could not be found for ${FAILURES_BEFORE_DEACTIVATION} days running. Restore the page and your links go straight back onto every partner site.`);

      broadcastRefresh(site.id).catch(err => console.error('RECIPROCITY broadcast failed:', err.message));
    }

    console.log(`RECIPROCITY: ${sites.length} checked - ${ok} ok, ${warned} warned, ${deactivated} paused`);
  } catch (err) {
    console.error('RECIPROCITY sweep failed:', err);
  }
};

const notifyOwner = (website, type, message) => {
  if (!website.ownerId) return;

  db.collection('users').doc(website.ownerId).get()
    .then(doc => {
      if (!doc.exists) return;
      return sendNotification('RECIPROCITY', { id: doc.id, _id: doc.id, ...doc.data() }, { type, message });
    })
    .catch(err => console.error('RECIPROCITY notify failed:', err.message));
};

module.exports = { checkReciprocity, findLiveDirectory, pageHostsDirectory };
