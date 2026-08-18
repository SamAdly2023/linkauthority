const SITE_URL = 'https://www.linkauthority.live';
const OG_IMAGE = `${SITE_URL}/link-authority-logo.png`;

/**
 * Per-route metadata for the public pages.
 *
 * The app is a client-rendered SPA, so without this every URL served the same
 * title and description from dist/index.html and only corrected itself once
 * React and Helmet had run. Crawlers that don't execute JS - and Google's own
 * first pass - saw duplicate metadata across the whole site, which is close to
 * the worst thing you can hand a search engine.
 */
const ROUTES = {
  '/': {
    title: 'Free Backlinks From Real Websites | LinkAuthority',
    description: 'Get free dofollow backlinks from hundreds of real websites. Add your site, activate it, and you are automatically featured on every other member\'s Business Partners page. No credits, no outreach, free while we grow.',
    keywords: 'free backlinks, backlink exchange, dofollow links, link building, increase domain authority, SEO backlinks'
  },
  '/about-us': {
    title: 'About LinkAuthority | The Free Backlink Network',
    description: 'LinkAuthority is a free link-exchange network where every active member links to every other. Learn who we are and how the network keeps link exchanges honest.',
    keywords: 'about linkauthority, backlink network, link exchange platform'
  },
  '/contact-us': {
    title: 'Contact LinkAuthority | Support for Members',
    description: 'Questions about backlinks, the WordPress plugin, or your Business Partners page? Get in touch with the LinkAuthority team.',
    keywords: 'linkauthority support, backlink help, contact'
  },
  '/user-guide': {
    title: 'How to Get Free Backlinks | LinkAuthority User Guide',
    description: 'Step-by-step guide to getting free dofollow backlinks: add your website, install the WordPress plugin or paste the snippet, and get listed across the whole network automatically.',
    keywords: 'how to get backlinks, backlink guide, wordpress backlink plugin, link building tutorial'
  },
  '/pricing': {
    title: 'Pricing | LinkAuthority Is Free',
    description: 'LinkAuthority is completely free while the network grows. Unlimited websites, unlimited partner links, the WordPress plugin and support, at no cost.',
    keywords: 'free backlink service, backlink pricing, free seo tools'
  },
  '/privacy-policy': {
    title: 'Privacy Policy | LinkAuthority',
    description: 'How LinkAuthority collects, uses, stores and protects your personal data, what is shared with the websites in the network, and the rights and choices you have over your information.',
    keywords: 'privacy policy'
  },
  '/terms-of-service': {
    title: 'Terms of Service | LinkAuthority',
    description: 'The terms that govern your use of LinkAuthority and the link-exchange network.',
    keywords: 'terms of service'
  }
};

const escapeAttr = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * Normalises a request path to a key in ROUTES, or null when it isn't a public
 * page we have copy for.
 */
const routeKey = (pathname) => {
  const clean = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return Object.prototype.hasOwnProperty.call(ROUTES, clean) ? clean : null;
};

/**
 * Sitewide structured data. Organization and WebSite are what Google uses to
 * build a knowledge panel and sitelinks; the FAQ block only goes on the landing
 * page, where the questions are actually rendered - marking up FAQs that aren't
 * on the page is a manual-action risk, not a shortcut.
 */
const organizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LinkAuthority',
  url: SITE_URL,
  logo: OG_IMAGE,
  description: 'A free link-exchange network where every active member is featured on every other member\'s website.',
  sameAs: []
});

const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'LinkAuthority',
  url: SITE_URL
});

const faqSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What does it cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nothing. LinkAuthority is completely free while we grow the network - unlimited websites, unlimited partner links, the WordPress plugin and support included. All you contribute is a Business Partners page on your own site.'
      }
    },
    {
      '@type': 'Question',
      name: 'How do I get backlinks from the network?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Add your website, then connect it with the WordPress plugin or the JavaScript snippet. The moment it activates, your business is listed on the Business Partners page of every other active member, each with a dofollow link back to you.'
      }
    },
    {
      '@type': 'Question',
      name: 'Are the links dofollow?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Partner links are ordinary dofollow links and open in the same tab. Every Business Partners page also carries Schema.org structured data describing the businesses listed on it.'
      }
    },
    {
      '@type': 'Question',
      name: 'Do the links stay live?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We check every member site daily. If a site stops hosting its Business Partners page, its own listing is paused across the network until the page is restored, so the links you receive come from members who are genuinely participating.'
      }
    },
    {
      '@type': 'Question',
      name: 'Does it work on sites that are not WordPress?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Create a page on your site and paste the JavaScript snippet from your dashboard into it, then verify. The snippet renders the directory live on every page load, with no plugin required.'
      }
    }
  ]
});

/**
 * Rewrites the SPA shell with metadata for the requested route.
 *
 * @param {string} html      Contents of dist/index.html
 * @param {string} pathname  Request path
 * @returns {string}
 */
const injectMeta = (html, pathname) => {
  const key = routeKey(pathname);

  // Unknown path: leave the shell alone but tell crawlers not to index it, so
  // stray URLs don't turn into duplicates of the home page.
  if (!key) {
    return html.replace(
      /<meta\s+name="robots"[^>]*>/i,
      '<meta name="robots" content="noindex, follow" />'
    );
  }

  const meta = ROUTES[key];
  const canonical = key === '/' ? `${SITE_URL}/` : `${SITE_URL}${key}`;

  const schemas = [organizationSchema(), websiteSchema()];
  if ('/' === key) {
    schemas.push(faqSchema());
  }

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeAttr(meta.description)}" />`)
    .replace(/<meta\s+name="keywords"[^>]*>/i, `<meta name="keywords" content="${escapeAttr(meta.keywords)}" />`)
    .replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeAttr(meta.title)}" />`)
    .replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeAttr(meta.description)}" />`)
    .replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeAttr(canonical)}" />`)
    .replace(/<meta\s+property="twitter:title"[^>]*>/i, `<meta property="twitter:title" content="${escapeAttr(meta.title)}" />`)
    .replace(/<meta\s+property="twitter:description"[^>]*>/i, `<meta property="twitter:description" content="${escapeAttr(meta.description)}" />`)
    .replace(/<meta\s+property="twitter:url"[^>]*>/i, `<meta property="twitter:url" content="${escapeAttr(canonical)}" />`);

  // index.html ships a static canonical pointing at the home page. Replace it
  // rather than adding a second one - two canonicals, home page first, would
  // tell Google every page is a duplicate of /.
  out = out.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`
  );

  const head = schemas
    .map(s => `  <script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n');

  return out.replace('</head>', `${head}\n  </head>`);
};

module.exports = { injectMeta, ROUTES, SITE_URL, routeKey };
