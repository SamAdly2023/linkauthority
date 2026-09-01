const axios = require('axios');

/**
 * Real citation auditing.
 *
 * The dashboard previously rendered a hardcoded array - "Google Business
 * Profile: synced, 100% consistency" and so on - identically for every site,
 * regardless of whether the business was listed anywhere. This checks the
 * directories that expose an API and reports what is actually found.
 *
 * Directories without a usable public API are reported as 'unsupported' rather
 * than guessed at. An audit that invents a status is worse than no audit.
 */

const DIRECTORIES = [
  { id: 'yelp', name: 'Yelp', api: true, env: 'YELP_API_KEY' },
  { id: 'foursquare', name: 'Foursquare', api: true, env: 'FOURSQUARE_API_KEY' },
  { id: 'google', name: 'Google Business Profile', api: false, note: 'Requires owner verification; check manually in your Google Business Profile.' },
  { id: 'bing', name: 'Bing Places', api: false, note: 'No public lookup API.' },
  { id: 'apple', name: 'Apple Business Connect', api: false, note: 'No public lookup API.' },
  { id: 'facebook', name: 'Facebook Page', api: false, note: 'Page lookup requires an approved Graph API app.' }
];

/**
 * Normalises a phone number to digits so formatting differences don't read as
 * an inconsistency.
 */
const digits = (v) => String(v || '').replace(/\D/g, '');

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Compares a found listing against the business's own details.
 *
 * @returns {{matches: string[], differs: string[]}}
 */
const compareNap = (business, listing) => {
  const matches = [];
  const differs = [];

  const pairs = [
    ['name', norm(business.name), norm(listing.name)],
    ['phone', digits(business.phone), digits(listing.phone)],
    ['address', norm(business.address), norm(listing.address)]
  ];

  for (const [field, ours, theirs] of pairs) {
    if (!ours || !theirs) continue;
    (ours === theirs ? matches : differs).push(field);
  }

  return { matches, differs };
};

const searchYelp = async (business) => {
  const key = process.env.YELP_API_KEY;
  if (!key) return { status: 'not-configured' };

  try {
    const res = await axios.get('https://api.yelp.com/v3/businesses/search', {
      headers: { Authorization: `Bearer ${key}` },
      params: { term: business.name, location: business.address || business.city, limit: 5 },
      timeout: 12000
    });

    const hit = (res.data?.businesses || []).find(
      b => norm(b.name) === norm(business.name) || digits(b.phone) === digits(business.phone)
    );

    if (!hit) return { status: 'not-found' };

    return {
      status: 'listed',
      url: hit.url,
      listing: {
        name: hit.name,
        phone: hit.phone,
        address: (hit.location?.display_address || []).join(', ')
      }
    };
  } catch (err) {
    return { status: 'error', error: err.response?.status === 401 ? 'Invalid API key' : err.message };
  }
};

const searchFoursquare = async (business) => {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return { status: 'not-configured' };

  try {
    const res = await axios.get('https://api.foursquare.com/v3/places/search', {
      headers: { Authorization: key },
      params: { query: business.name, near: business.city || business.address, limit: 5 },
      timeout: 12000
    });

    const hit = (res.data?.results || []).find(p => norm(p.name) === norm(business.name));

    if (!hit) return { status: 'not-found' };

    return {
      status: 'listed',
      url: hit.fsq_id ? `https://foursquare.com/v/${hit.fsq_id}` : null,
      listing: {
        name: hit.name,
        phone: hit.tel || '',
        address: hit.location?.formatted_address || ''
      }
    };
  } catch (err) {
    return { status: 'error', error: err.response?.status === 401 ? 'Invalid API key' : err.message };
  }
};

/**
 * Audits a business across the directories we can actually check.
 *
 * @param {{name: string, phone?: string, address?: string, city?: string}} business
 */
const auditCitations = async (business) => {
  if (!business?.name) {
    throw new Error('Business name is required to run a citation audit');
  }

  const results = [];

  for (const dir of DIRECTORIES) {
    if (!dir.api) {
      results.push({ id: dir.id, name: dir.name, status: 'unsupported', note: dir.note });
      continue;
    }

    const found = 'yelp' === dir.id ? await searchYelp(business) : await searchFoursquare(business);

    if ('listed' === found.status) {
      const nap = compareNap(business, found.listing);
      results.push({
        id: dir.id,
        name: dir.name,
        status: 'listed',
        url: found.url,
        listing: found.listing,
        napMatches: nap.matches,
        napDiffers: nap.differs,
        consistent: 0 === nap.differs.length
      });
    } else {
      results.push({ id: dir.id, name: dir.name, ...found });
    }
  }

  const checkable = results.filter(r => ['listed', 'not-found'].includes(r.status));

  return {
    checkedAt: new Date(),
    business: { name: business.name, phone: business.phone || null, address: business.address || null },
    totals: {
      checked: checkable.length,
      listed: results.filter(r => 'listed' === r.status).length,
      missing: results.filter(r => 'not-found' === r.status).length,
      inconsistent: results.filter(r => 'listed' === r.status && false === r.consistent).length,
      unsupported: results.filter(r => 'unsupported' === r.status).length,
      notConfigured: results.filter(r => 'not-configured' === r.status).length
    },
    directories: results
  };
};

const configuredProviders = () => ({
  yelp: Boolean(process.env.YELP_API_KEY),
  foursquare: Boolean(process.env.FOURSQUARE_API_KEY)
});

module.exports = { auditCitations, configuredProviders, compareNap, DIRECTORIES };
