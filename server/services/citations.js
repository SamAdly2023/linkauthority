const axios = require('axios');

/**
 * Real citation auditing.
 *
 * The dashboard previously rendered a hardcoded array - "Google Business
 * Profile: synced, 100% consistency" and so on - identically for every site,
 * regardless of whether the business was listed anywhere. This checks the
 * directories that expose an API and reports what is actually found.
 *
 * DIRECTORIES is the single source of truth for the whole citation feature:
 * the audit reads it to decide what can be checked, and the submission
 * checklist reads it to decide what a human still has to do by hand. One list
 * means the two can never drift apart.
 *
 * Each entry declares how it can be SUBMITTED and how it can be CHECKED, which
 * are different questions:
 *
 *   submit: 'api'    - official write API or bulk feed. Automatable.
 *           'form'   - HTML form only. Autofill helps; a human submits.
 *           'manual' - identity, licence or payment verification. Always human.
 *
 *   check:  a checker id, or null when no public lookup exists. A directory
 *           with no checker reports 'unsupported' rather than a guess. An
 *           audit that invents a status is worse than no audit.
 */

const DIRECTORIES = [
  // --- Aggregators: one submission syndicates to hundreds of downstream sites
  { id: 'dataaxle', name: 'Data Axle', url: 'https://www.dataaxleusa.com/', tier: 'A', category: 'Aggregator', submit: 'api', check: null, note: 'Commercial feed agreement required.' },
  { id: 'localeze', name: 'Neustar Localeze', url: 'https://www.neustarlocaleze.biz/', tier: 'A', category: 'Aggregator', submit: 'api', check: null, note: 'Commercial feed agreement required.' },
  { id: 'foursquare', name: 'Foursquare', url: 'https://business.foursquare.com/', tier: 'A', category: 'Aggregator', submit: 'api', check: 'foursquare', env: 'FOURSQUARE_API_KEY' },
  { id: 'tomtom', name: 'TomTom', url: 'https://www.tomtom.com/', tier: 'A', category: 'Aggregator', submit: 'manual', check: null, note: 'Submit via TomTom MapShare.' },
  { id: 'here', name: 'HERE', url: 'https://www.here.com/', tier: 'A', category: 'Aggregator', submit: 'form', check: null, note: 'Feeds in-dash navigation across most car brands.' },
  { id: 'osm', name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/', tier: 'A', category: 'Aggregator', submit: 'api', check: 'osm' },
  { id: 'wikidata', name: 'Wikidata', url: 'https://www.wikidata.org/', tier: 'B', category: 'Knowledge', submit: 'api', check: 'wikidata' },

  // --- Core listings
  { id: 'google', name: 'Google Business Profile', url: 'https://business.google.com/', tier: 'A', category: 'Core', submit: 'api', check: null, note: 'Business Profile API exists but needs owner verification; check in your own dashboard.' },
  { id: 'bing', name: 'Bing Places', url: 'https://www.bingplaces.com/', tier: 'A', category: 'Core', submit: 'api', check: null, note: 'Self-serve CSV bulk upload. No public lookup API.' },
  { id: 'apple', name: 'Apple Business Connect', url: 'https://businessconnect.apple.com/', tier: 'A', category: 'Core', submit: 'api', check: null, note: 'Bulk feed for multi-location. No public lookup API.' },
  { id: 'facebook', name: 'Facebook Page', url: 'https://www.facebook.com/pages/create', tier: 'A', category: 'Core', submit: 'form', check: null, note: 'Page lookup requires an approved Graph API app.' },
  { id: 'yelp', name: 'Yelp', url: 'https://biz.yelp.com/', tier: 'A', category: 'Core', submit: 'form', check: 'yelp', env: 'YELP_API_KEY' },
  { id: 'nextdoor', name: 'Nextdoor', url: 'https://business.nextdoor.com/', tier: 'A', category: 'Core', submit: 'form', check: null, note: 'Hyperlocal - highest conversion for home services.' },
  { id: 'waze', name: 'Waze', url: 'https://www.waze.com/business', tier: 'A', category: 'Core', submit: 'form', check: null, note: 'A separate submission from Google despite the shared ownership.' },
  { id: 'whitepages', name: 'Whitepages', url: 'https://www.whitepages.com/', tier: 'A', category: 'Core', submit: 'form', check: null },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/', tier: 'A', category: 'Core', submit: 'form', check: null },

  // --- Majors
  { id: 'yellowpages', name: 'YellowPages', url: 'https://www.yellowpages.com/', tier: 'A', category: 'Major', submit: 'form', check: null, note: 'One submission covers Superpages and DexKnows.' },
  { id: 'bbb', name: 'Better Business Bureau', url: 'https://www.bbb.org/', tier: 'A', category: 'Major', submit: 'manual', check: null, note: 'Paid, with identity verification.' },
  { id: 'chamberofcommerce', name: 'Chamber of Commerce', url: 'https://www.chamberofcommerce.com/', tier: 'A', category: 'Major', submit: 'form', check: null },
  { id: 'manta', name: 'Manta', url: 'https://www.manta.com/', tier: 'A', category: 'Major', submit: 'form', check: null },
  { id: 'mapquest', name: 'MapQuest', url: 'https://www.mapquest.com/', tier: 'A', category: 'Major', submit: 'manual', check: null, note: 'Low priority - sources from Foursquare and TomTom.' },
  { id: 'trustpilot', name: 'Trustpilot', url: 'https://www.trustpilot.com/', tier: 'A', category: 'Reviews', submit: 'form', check: null, note: 'Ranks on brand-name searches.' },
  { id: 'crunchbase', name: 'Crunchbase', url: 'https://www.crunchbase.com/', tier: 'A', category: 'Business', submit: 'form', check: null },
  { id: 'alignable', name: 'Alignable', url: 'https://www.alignable.com/', tier: 'A', category: 'Business', submit: 'form', check: null },

  // --- Verticals. Only surfaced when the business is actually in one.
  { id: 'houzz', name: 'Houzz', url: 'https://www.houzz.com/pro', tier: 'A', category: 'Vertical', vertical: 'home-services', submit: 'form', check: null, note: 'Top priority for remodeling and home improvement.' },
  { id: 'angi', name: 'Angi', url: 'https://office.angieslist.com/', tier: 'A', category: 'Vertical', vertical: 'home-services', submit: 'manual', check: null },
  { id: 'homeadvisor', name: 'HomeAdvisor', url: 'https://www.homeadvisor.com/', tier: 'A', category: 'Vertical', vertical: 'home-services', submit: 'manual', check: null },
  { id: 'thumbtack', name: 'Thumbtack', url: 'https://www.thumbtack.com/', tier: 'A', category: 'Vertical', vertical: 'home-services', submit: 'manual', check: null },
  { id: 'porch', name: 'Porch', url: 'https://porch.com/', tier: 'B', category: 'Vertical', vertical: 'home-services', submit: 'form', check: null },
  { id: 'buildzoom', name: 'BuildZoom', url: 'https://www.buildzoom.com/', tier: 'B', category: 'Vertical', vertical: 'home-services', submit: 'form', check: null },
  { id: 'networx', name: 'Networx', url: 'https://www.networx.com/', tier: 'B', category: 'Vertical', vertical: 'home-services', submit: 'form', check: null },
  { id: 'modernize', name: 'Modernize', url: 'https://modernize.com/', tier: 'B', category: 'Vertical', vertical: 'home-services', submit: 'form', check: null },
  { id: 'bark', name: 'Bark', url: 'https://www.bark.com/', tier: 'B', category: 'Vertical', vertical: 'home-services', submit: 'form', check: null },
  { id: 'guildquality', name: 'GuildQuality', url: 'https://www.guildquality.com/', tier: 'B', category: 'Vertical', vertical: 'home-services', submit: 'manual', check: null },
  { id: 'nari', name: 'NARI', url: 'https://www.nari.org/', tier: 'B', category: 'Industry', vertical: 'home-services', submit: 'manual', check: null, note: 'Paid membership.' },
  { id: 'cslb', name: 'CSLB (California licence)', url: 'https://www.cslb.ca.gov/', tier: 'A', category: 'Licence', vertical: 'home-services', submit: 'manual', check: null, note: 'State licence board - a citation and a trust signal.' },
  { id: 'tripadvisor', name: 'TripAdvisor', url: 'https://www.tripadvisor.com/', tier: 'A', category: 'Vertical', vertical: 'hospitality', submit: 'form', check: null },
  { id: 'zillow', name: 'Zillow', url: 'https://www.zillow.com/', tier: 'A', category: 'Vertical', vertical: 'real-estate', submit: 'form', check: null },
  { id: 'thomasnet', name: 'Thomasnet', url: 'https://www.thomasnet.com/', tier: 'A', category: 'Vertical', vertical: 'b2b-industrial', submit: 'form', check: null },

  // --- General directories
  { id: 'brownbook', name: 'Brownbook', url: 'https://www.brownbook.net/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'hotfrog', name: 'Hotfrog', url: 'https://www.hotfrog.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'merchantcircle', name: 'MerchantCircle', url: 'https://www.merchantcircle.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'n49', name: 'n49', url: 'https://www.n49.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'citysquares', name: 'CitySquares', url: 'https://citysquares.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'showmelocal', name: 'ShowMeLocal', url: 'https://www.showmelocal.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'iglobal', name: 'iGlobal', url: 'https://www.iglobal.co/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'ibegin', name: 'iBegin', url: 'https://www.ibegin.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'tupalo', name: 'Tupalo', url: 'https://tupalo.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'ezlocal', name: 'EZLocal', url: 'https://dashboard.ezlocal.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'findopen', name: 'Find-Open', url: 'https://find-open.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'opendi', name: 'Opendi', url: 'https://www.opendi.us/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'fyple', name: 'Fyple', url: 'https://www.fyple.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'cataloxy', name: 'Cataloxy', url: 'https://www.cataloxy.us/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'bunity', name: 'Bunity', url: 'https://www.bunity.com/add-your-business', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'callupcontact', name: 'CallUpContact', url: 'https://www.callupcontact.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'fonolive', name: 'Fonolive', url: 'https://fonolive.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'globalcatalog', name: 'GlobalCatalog', url: 'https://globalcatalog.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'azbusinessfinder', name: 'A-Z Business Finder', url: 'https://www.a-zbusinessfinder.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'localstack', name: 'LocalStack', url: 'https://localstack.com/claim-business', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'discoverourtown', name: 'DiscoverOurTown', url: 'https://www.discoverourtown.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'yasabe', name: 'Yasabe', url: 'https://accounts.yasabe.com/', tier: 'B', category: 'Directory', submit: 'form', check: null, note: 'Strong reach in the Hispanic market.' },
  { id: 'lacartes', name: 'LaCartes', url: 'http://www.lacartes.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'cylex', name: 'Cylex', url: 'https://www.cylex.us.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'storeboard', name: 'Storeboard', url: 'https://www.storeboard.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'tuugo', name: 'Tuugo', url: 'https://www.tuugo.us/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'yellowplace', name: 'Yellow.place', url: 'https://yellow.place/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'whereto', name: 'Where To?', url: 'https://whereto.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'upcity', name: 'UpCity', url: 'https://upcity.com/', tier: 'B', category: 'Directory', submit: 'form', check: null },
  { id: 'expertise', name: 'Expertise.com', url: 'https://www.expertise.com/', tier: 'B', category: 'Editorial', submit: 'manual', check: null, note: 'Editorial selection, not a submission.' },
  { id: 'locanto', name: 'Locanto', url: 'https://www.locanto.com/', tier: 'B', category: 'Classifieds', submit: 'form', check: null },
  { id: 'oodle', name: 'Oodle', url: 'https://www.oodle.com/', tier: 'B', category: 'Classifieds', submit: 'form', check: null },

  // --- Business credit
  { id: 'dandb', name: 'Dun and Bradstreet', url: 'https://www.dandb.com/', tier: 'B', category: 'Business Credit', submit: 'manual', check: null, note: 'Identity verification required.' },
  { id: 'cortera', name: 'Cortera', url: 'https://www.cortera.com/', tier: 'B', category: 'Business Credit', submit: 'form', check: null },

  // --- Reviews
  { id: 'sitejabber', name: 'Sitejabber', url: 'https://www.sitejabber.com/', tier: 'B', category: 'Reviews', submit: 'form', check: null },
  { id: 'consumeraffairs', name: 'ConsumerAffairs', url: 'https://www.consumeraffairs.com/', tier: 'B', category: 'Reviews', submit: 'manual', check: null },

  // --- Local
  { id: 'patch', name: 'Patch', url: 'https://patch.com/', tier: 'B', category: 'Local', submit: 'form', check: null, note: 'Use the page for the relevant neighbourhood.' },

  // --- Profiles. Mostly nofollow, but they own the first page of a brand search.
  { id: 'wordpresscom', name: 'WordPress.com', url: 'https://wordpress.com/', tier: 'B', category: 'Profile', submit: 'form', check: null, note: 'Only worth it with real content on the profile.' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', tier: 'B', category: 'Social', submit: 'form', check: null },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', tier: 'B', category: 'Social', submit: 'form', check: null },
  { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/', tier: 'B', category: 'Social', submit: 'form', check: null, note: 'Unusually strong for visual trades - before and after boards.' },
  { id: 'gravatar', name: 'Gravatar', url: 'https://gravatar.com/', tier: 'B', category: 'Profile', submit: 'form', check: null },
  { id: 'aboutme', name: 'About.me', url: 'https://about.me/', tier: 'B', category: 'Profile', submit: 'form', check: null }
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

// Both Nominatim and the Wikimedia APIs require a User-Agent that identifies
// the caller and gives them somewhere to complain to. Sending the default
// axios agent is refused outright - Wikidata answers 403.
const USER_AGENT = 'LinkAuthority-CitationAudit/1.0 (+https://www.linkauthority.live)';

/**
 * OpenStreetMap via Nominatim. Free and keyless, but rate limited to roughly
 * one request a second - fine for a single audit, not for a bulk sweep.
 */
const searchOsm = async (business) => {
  try {
    const query = [business.name, business.address || business.city].filter(Boolean).join(', ');

    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      headers: { 'User-Agent': USER_AGENT },
      params: { q: query, format: 'jsonv2', addressdetails: 1, extratags: 1, limit: 5 },
      timeout: 12000
    });

    const results = Array.isArray(res.data) ? res.data : [];

    // Nominatim matches loosely and will happily return the street on its own.
    // A result only counts as a listing when the business name is actually in
    // it, otherwise every business on a known road reads as "listed".
    const wanted = norm(business.name);
    const hit = results.find((r) => {
      if (norm(r.name) === wanted) return true;
      const label = norm(r.display_name);
      return label === wanted || label.startsWith(wanted + ',');
    });

    if (!hit) return { status: 'not-found' };

    return {
      status: 'listed',
      url: hit.osm_type && hit.osm_id ? `https://www.openstreetmap.org/${hit.osm_type}/${hit.osm_id}` : null,
      listing: {
        name: hit.name || '',
        phone: hit.extratags?.phone || hit.extratags?.['contact:phone'] || '',
        address: hit.display_name || ''
      }
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
};

/**
 * Wikidata. Nofollow, but an item feeds Google's knowledge panel, so it is
 * worth knowing whether one exists.
 */
const searchWikidata = async (business) => {
  try {
    const res = await axios.get('https://www.wikidata.org/w/api.php', {
      headers: { 'User-Agent': USER_AGENT },
      params: {
        action: 'wbsearchentities',
        search: business.name,
        language: 'en',
        uselang: 'en',
        type: 'item',
        format: 'json',
        limit: 5
      },
      timeout: 12000
    });

    const hit = (res.data?.search || []).find(e => norm(e.label) === norm(business.name));

    if (!hit) return { status: 'not-found' };

    return {
      status: 'listed',
      url: hit.concepturi || `https://www.wikidata.org/wiki/${hit.id}`,
      // The search API returns no contact details, so there is nothing to
      // compare against. Returning empty fields keeps the NAP comparison
      // honest rather than scoring a match on data we never received.
      listing: { name: hit.label || '', phone: '', address: '' }
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
};

const CHECKERS = {
  yelp: searchYelp,
  foursquare: searchFoursquare,
  osm: searchOsm,
  wikidata: searchWikidata
};

/** The fields the audit result carries through from the registry. */
const describe = (dir) => ({
  id: dir.id,
  name: dir.name,
  url: dir.url,
  tier: dir.tier,
  category: dir.category,
  submit: dir.submit,
  vertical: dir.vertical || null
});

/**
 * Why a directory could not be checked programmatically. Kept out of the
 * status so the UI can explain itself without a lookup table of its own.
 */
const unsupportedNote = (dir) => {
  if (dir.note) return dir.note;
  if ('manual' === dir.submit) return 'Needs identity, licence or payment verification - check by hand.';
  return 'No public lookup API - check by hand.';
};

/**
 * Audits a business across the directories we can actually check.
 *
 * @param {{name: string, phone?: string, address?: string, city?: string, vertical?: string}} business
 */
const auditCitations = async (business) => {
  if (!business?.name) {
    throw new Error('Business name is required to run a citation audit');
  }

  // A remodeler should not be told it is missing from Zillow. Directories tied
  // to a vertical only appear when the business is in that vertical; with no
  // vertical set, none of them are shown rather than all of them.
  const relevant = DIRECTORIES.filter(d => !d.vertical || d.vertical === business.vertical);

  // The checkable ones hit the network, so run them together - serially, the
  // audit would take as long as the sum of every timeout.
  const checked = await Promise.all(
    relevant.map(async (dir) => {
      if (!dir.check) {
        return { ...describe(dir), status: 'unsupported', note: unsupportedNote(dir) };
      }

      const found = await CHECKERS[dir.check](business);

      if ('listed' !== found.status) {
        return { ...describe(dir), ...found };
      }

      const nap = compareNap(business, found.listing);

      return {
        ...describe(dir),
        status: 'listed',
        url: found.url,
        listing: found.listing,
        napMatches: nap.matches,
        napDiffers: nap.differs,
        consistent: 0 === nap.differs.length
      };
    })
  );

  const count = (status) => checked.filter(r => r.status === status).length;

  return {
    checkedAt: new Date(),
    business: {
      name: business.name,
      phone: business.phone || null,
      address: business.address || null,
      vertical: business.vertical || null
    },
    totals: {
      total: checked.length,
      checked: checked.filter(r => ['listed', 'not-found'].includes(r.status)).length,
      listed: count('listed'),
      missing: count('not-found'),
      inconsistent: checked.filter(r => 'listed' === r.status && false === r.consistent).length,
      unsupported: count('unsupported'),
      notConfigured: count('not-configured'),
      errors: count('error'),
      // How the outstanding work splits, which is the number that actually
      // governs how long the campaign takes.
      automatable: relevant.filter(d => 'api' === d.submit).length,
      formSubmit: relevant.filter(d => 'form' === d.submit).length,
      manualSubmit: relevant.filter(d => 'manual' === d.submit).length
    },
    directories: checked
  };
};

const configuredProviders = () => ({
  yelp: Boolean(process.env.YELP_API_KEY),
  foursquare: Boolean(process.env.FOURSQUARE_API_KEY),
  // Neither of these needs a key, so they are always available.
  osm: true,
  wikidata: true
});

module.exports = { auditCitations, configuredProviders, compareNap, DIRECTORIES, CHECKERS };
