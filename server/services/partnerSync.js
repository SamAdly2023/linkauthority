const axios = require('axios');
const { db } = require('./firebase');

// Best-effort push: ask every other currently-active site's plugin to refresh its
// cached partner directory immediately, instead of waiting for its own cron tick.
// Called whenever the directory's contents change - a site connecting or
// disconnecting, or an owner editing the logo/description shown on their card.
const broadcastRefresh = async (excludeWebsiteId) => {
  const snap = await db.collection('websites').where('isActive', '==', true).get();
  const targets = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(site => site.id !== excludeWebsiteId && site.url && site.verificationToken);

  await Promise.allSettled(targets.map(site => {
    const restUrl = `${site.url.replace(/\/$/, '')}/wp-json/linkauthority/v1/update`;
    return axios.post(restUrl, { token: site.verificationToken }, { timeout: 5000 });
  }));
};

module.exports = { broadcastRefresh };
