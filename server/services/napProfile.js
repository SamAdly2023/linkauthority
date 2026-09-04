/**
 * The canonical business record, and the paste-ready payload built from it.
 *
 * Most of the directories on the list have no write API, so a human fills the
 * form. The expensive part of that is not the clicking - it is retyping the
 * same details sixty times and getting them subtly wrong. One directory ends
 * up with "Ste 4" and another with "Suite 4", the phone is punctuated three
 * ways, the description is truncated mid-word to fit a field, and the NAP
 * inconsistency that results costs more ranking than the citations gained.
 *
 * So: one record, derived once, rendered per directory. Every field a form
 * asks for comes out of the same source, formatted the way that form wants it,
 * ready to paste. Nothing here submits anything - it prepares what a person
 * submits.
 */

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
  'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

/**
 * Splits a single-line US address into its parts.
 *
 * Directories ask for street, city, state and postcode separately far more
 * often than they accept one line, and splitting it once here is what stops
 * three different people splitting it three different ways.
 *
 * @param {string} address
 * @returns {{street: string, city: string, state: string, postalCode: string}}
 */
const splitAddress = (address) => {
  const empty = { street: '', city: '', state: '', postalCode: '' };
  const raw = String(address || '').trim();
  if (!raw) return empty;

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return { ...empty, street: raw };

  // The last part carries state and postcode: "AZ 85745".
  const tail = parts[parts.length - 1];
  const m = tail.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  if (!m || !US_STATES.has(m[1].toUpperCase())) {
    // Not a shape we recognise. Keep the whole thing as the street rather than
    // splitting it wrongly - a wrong split is worse than an unsplit line.
    return { ...empty, street: raw };
  }

  return {
    street: parts.slice(0, -2).join(', '),
    city: parts[parts.length - 2] || '',
    state: m[1].toUpperCase(),
    postalCode: m[2]
  };
};

/** Digits only, so formatting never counts as a difference. */
const phoneDigits = (v) => String(v || '').replace(/\D/g, '');

/**
 * The three formats forms ask for. Same number every time, punctuated the way
 * each field wants it.
 */
const phoneFormats = (phone) => {
  const d = phoneDigits(phone);
  const ten = 11 === d.length && d.startsWith('1') ? d.slice(1) : d;

  if (10 !== ten.length) {
    // Not a US number we can format. Pass it through untouched rather than
    // mangling an international one.
    return { plain: d, dashed: String(phone || '').trim(), parens: String(phone || '').trim(), e164: d ? `+${d}` : '' };
  }

  const [a, b, c] = [ten.slice(0, 3), ten.slice(3, 6), ten.slice(6)];

  return {
    plain: ten,
    dashed: `${a}-${b}-${c}`,
    parens: `(${a}) ${b}-${c}`,
    e164: `+1${ten}`
  };
};

/**
 * Truncates to a hard character limit without cutting a word in half.
 *
 * Forms enforce these limits by silently chopping the paste, which is how a
 * description ends up finishing mid-word on forty directories.
 */
const truncate = (text, limit) => {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (s.length <= limit) return s;

  const cut = s.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');

  // Fall back to a hard cut only when there is no space to break on.
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '');
};

/** The description lengths the directories on the list actually enforce. */
const DESCRIPTION_LIMITS = [80, 160, 250, 500, 750];

/**
 * Builds the canonical record.
 *
 * @param {object} business
 * @param {string} business.name
 * @param {string} [business.phone]
 * @param {string} [business.address]  Single line; split automatically.
 * @param {string} [business.email]
 * @param {string} [business.website]
 * @param {string} [business.description]
 * @param {string[]} [business.categories]
 * @param {string[]} [business.services]
 * @param {object} [business.social]   Keyed by network.
 * @param {string} [business.hours]
 * @returns {object} The record, plus everything derived from it.
 */
const buildProfile = (business) => {
  if (!business?.name) {
    throw new Error('Business name is required to build a profile');
  }

  const address = splitAddress(business.address);
  const phone = phoneFormats(business.phone);

  const descriptions = {};
  for (const limit of DESCRIPTION_LIMITS) {
    descriptions[limit] = truncate(business.description, limit);
  }

  const website = String(business.website || '').trim().replace(/\/+$/, '');

  return {
    // The name is the one field that must never vary. It is not truncated,
    // not title-cased, not abbreviated - byte-identical everywhere.
    name: String(business.name).trim(),

    phone,
    address: { ...address, singleLine: String(business.address || '').trim() },

    email: String(business.email || '').trim(),
    website,
    // Several forms want the domain without a scheme.
    domain: website.replace(/^https?:\/\//, '').replace(/^www\./, ''),

    description: {
      full: String(business.description || '').trim().replace(/\s+/g, ' '),
      ...descriptions
    },

    categories: (business.categories || []).map(c => String(c).trim()).filter(Boolean),
    services: (business.services || []).map(s => String(s).trim()).filter(Boolean),
    social: business.social || {},
    hours: String(business.hours || '').trim(),

    // What the audit needs, so one record feeds both.
    audit: {
      name: String(business.name).trim(),
      phone: business.phone || '',
      address: String(business.address || '').trim(),
      city: address.city,
      state: address.state,
      vertical: business.vertical || null
    }
  };
};

/**
 * Everything a directory form typically asks for, ready to paste.
 *
 * @param {object} profile          From buildProfile.
 * @param {object} [opts]
 * @param {number} [opts.descriptionLimit]  Nearest supported cap, default 500.
 * @returns {Array<{label: string, value: string, note?: string}>}
 */
const renderFields = (profile, opts = {}) => {
  const limit = DESCRIPTION_LIMITS.includes(opts.descriptionLimit) ? opts.descriptionLimit : 500;

  const rows = [
    { label: 'Business name', value: profile.name, note: 'Paste exactly - never abbreviate or reword' },
    { label: 'Phone', value: profile.phone.dashed, note: `Also: ${profile.phone.parens} / ${profile.phone.plain}` },
    { label: 'Street', value: profile.address.street },
    { label: 'City', value: profile.address.city },
    { label: 'State', value: profile.address.state },
    { label: 'Postcode', value: profile.address.postalCode },
    { label: 'Full address', value: profile.address.singleLine, note: 'For forms with one address field' },
    { label: 'Website', value: profile.website },
    { label: 'Email', value: profile.email },
    { label: `Description (${limit} char)`, value: profile.description[limit] },
    { label: 'Categories', value: profile.categories.join(', ') },
    { label: 'Services', value: profile.services.join(', ') },
    { label: 'Hours', value: profile.hours }
  ];

  for (const [network, url] of Object.entries(profile.social || {})) {
    rows.push({ label: network.charAt(0).toUpperCase() + network.slice(1), value: String(url) });
  }

  // Empty fields are noise on a form you are working through by hand.
  return rows.filter(r => r.value);
};

/**
 * Flags anything that will cause trouble before sixty forms have been filled
 * with it. Cheap to fix now, expensive to correct across every directory later.
 *
 * @returns {Array<{field: string, severity: 'error'|'warning', message: string}>}
 */
const validateProfile = (profile) => {
  const issues = [];

  if (!profile.address.state || !profile.address.postalCode) {
    issues.push({
      field: 'address',
      severity: 'warning',
      message: 'Address did not split into street, city, state and postcode. Most forms ask for them separately.'
    });
  }

  if (10 !== profile.phone.plain.length) {
    issues.push({ field: 'phone', severity: 'warning', message: 'Phone is not a 10-digit US number.' });
  }

  if (!profile.website) {
    issues.push({ field: 'website', severity: 'error', message: 'A website URL is required by nearly every directory.' });
  }

  if (!profile.description.full) {
    issues.push({ field: 'description', severity: 'error', message: 'A description is required by nearly every directory.' });
  } else if (profile.description.full.length < 160) {
    issues.push({
      field: 'description',
      severity: 'warning',
      message: 'Description is under 160 characters, so the longer fields will look thin. Aim for 500 or more.'
    });
  }

  if (!profile.categories.length) {
    issues.push({ field: 'categories', severity: 'warning', message: 'No category set. Most directories require one and will pick badly on your behalf.' });
  }

  if (!profile.email) {
    issues.push({ field: 'email', severity: 'warning', message: 'No email set. Nearly every signup verifies one.' });
  }

  return issues;
};

module.exports = {
  buildProfile,
  renderFields,
  validateProfile,
  splitAddress,
  phoneFormats,
  truncate,
  DESCRIPTION_LIMITS
};
