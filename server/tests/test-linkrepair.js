// Link repair decides whether a site's earned links are quietly dead. Every
// claim it makes has to come from a real fetch, so this stands up a fake
// "internet" of three pages and checks what the service concludes about each.
const Module = require('module');
const http = require('http');
const dns = require('dns');

// The service refuses a "link" whose source host is the site itself, which is
// correct and makes loopback useless as a fixture. So the fake sites get real
// distinct hostnames, and .test resolves to loopback for the duration.
const realLookup = dns.lookup;
dns.lookup = (host, opts, cb) => {
  if (String(host).endsWith('.test')) {
    const all = typeof opts === 'object' && opts && opts.all;
    const done = cb || opts;
    return process.nextTick(() => done(null, all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1', 4));
  }
  return realLookup(host, opts, cb);
};
dns.promises.lookup = async (host, opts) => {
  if (!String(host).endsWith('.test')) throw new Error('unexpected lookup ' + host);
  return (opts && opts.all) ? [{ address: '127.0.0.1', family: 4 }] : { address: '127.0.0.1', family: 4 };
};
const SERVER = "C:/Users/Sam/Downloads/LinkAuthority/server";
process.env.LINK_REPAIR_ALLOW_PRIVATE = "1";

let fail = 0;
const check = (label, cond, detail) => {
  if (!cond) { fail++; console.log('  FAIL  ' + label + (detail ? '  ' + detail : '')); }
  else console.log('  ok    ' + label);
};

// ---- the site under test, plus three other sites linking to it ----
const sites = { me: { id: 'me', url: '', ownerId: 'u1', verificationToken: 'tok-me' } };
const links = {};   // externalLinks docs by id
const pinged = [];

const col = (name) => {
  const store = 'websites' === name ? sites : links;
  return {
    where: (f, op, v) => ({
      limit: () => ({ get: async () => { const d = Object.entries(store).filter(([, s]) => s[f] === v); return { empty: !d.length, size: d.length, docs: d.map(([id, s]) => ({ id, data: () => s })) }; } }),
      get: async () => { const d = Object.entries(store).filter(([, s]) => s[f] === v); return { empty: !d.length, size: d.length, docs: d.map(([id, s]) => ({ id, data: () => s })) }; }
    }),
    get: async () => ({ docs: Object.entries(store).map(([id, s]) => ({ id, data: () => s })) }),
    doc: (id) => ({
      get: async () => ({ exists: !!store[id], id, data: () => store[id] }),
      set: async (v) => { store[id] = { ...(store[id] || {}), ...v }; },
      update: async (v) => { if (!store[id]) throw new Error('no doc ' + id); Object.assign(store[id], v); }
    })
  };
};

const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id.endsWith('services/firebase') || id === './firebase') return { db: { collection: col } };
  if (id.endsWith('services/partnerSync')) return { broadcastRefresh: async () => {}, pingSite: async (s) => { pinged.push(s.id); } };
  if (id.endsWith('middlewares/requireLogin')) return (req, res, next) => { req.user = { id: 'u1' }; next(); };
  if (id.endsWith('services/email')) return new Proxy({}, { get: () => async () => {} });
  if (id.endsWith('services/gemini')) return { analyzeWebsite: async () => ({}), getSEOAdvice: async () => ({}) };
  if (id.endsWith('services/notification')) return { sendNotification: async () => {} };
  if (id === 'adm-zip') return class {};
  return origRequire.apply(this, arguments);
};

// ---- a fake internet ----
// mysite:  /alive 200, /gone 404, /moved 301 -> /alive
// blogA:   links to /gone      (a backlink pointing at a dead page)
// blogB:   links to /alive     (healthy)
// blogC:   no link at all      (the link was removed)
const pages = {
  '/alive': [200, '<h1>alive</h1>'],
  '/moved': [301, '', { location: '/alive' }],
  '/gone': [404, 'not found']
};
let mine, blogA, blogB, blogC;

const serve = (handler) => new Promise(r => { const s = http.createServer(handler); s.listen(0, () => r(s)); });

const run = async () => {
  const mineSrv = await serve((req, res) => {
    const [code, body, headers] = pages[req.url.split('?')[0]] || [404, 'not found'];
    res.writeHead(code, { 'Content-Type': 'text/html', ...(headers || {}) });
    res.end(body);
  });
  mine = `http://mysite.test:${mineSrv.address().port}`;
  sites.me.url = mine;

  const mk = (html) => serve((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); });
  const aSrv = await mk(`<a href="${mine}/gone">Best tree service</a>`);
  const bSrv = await mk(`<a href="${mine}/alive" rel="nofollow">A mention</a>`);
  const cSrv = await mk('<p>We removed that link.</p>');
  blogA = `http://blog-a.test:${aSrv.address().port}/post`;
  blogB = `http://blog-b.test:${bSrv.address().port}/post`;
  blogC = `http://blog-c.test:${cSrv.address().port}/post`;

  const linkRepair = require(SERVER + '/services/linkRepair.js');

  console.log('--- what gets stored ---');
  let r = await linkRepair.recordSighting(sites.me, { sourceUrl: blogA, targetUrl: mine + '/gone', kind: '404' });
  check('a 404 with a referrer is stored as broken', r === 'stored' && Object.values(links)[0].status === 'target-missing');
  r = await linkRepair.recordSighting(sites.me, { sourceUrl: blogB, targetUrl: mine + '/alive', kind: 'referrer' });
  check('a referrer sighting is stored unverified', r === 'stored');
  r = await linkRepair.recordSighting(sites.me, { sourceUrl: blogC, targetUrl: mine + '/alive', kind: 'referrer' });
  check('a third source is stored', r === 'stored' && Object.keys(links).length === 3);

  r = await linkRepair.recordSighting(sites.me, { sourceUrl: blogB, targetUrl: mine + '/alive', kind: 'referrer' });
  check('the same link again updates one row, not two', r === 'updated' && Object.keys(links).length === 3);
  check('hits counted', Object.values(links).find(l => l.sourceUrl === blogB).hits === 2);

  console.log('\n--- what gets refused ---');
  check('self-link ignored', 'ignored' === await linkRepair.recordSighting(sites.me, { sourceUrl: mine + '/a', targetUrl: mine + '/alive', kind: 'referrer' }));
  check('google referrer ignored', 'ignored' === await linkRepair.recordSighting(sites.me, { sourceUrl: 'https://www.google.com/search?q=x', targetUrl: mine + '/alive', kind: 'referrer' }));
  check('facebook referrer ignored', 'ignored' === await linkRepair.recordSighting(sites.me, { sourceUrl: 'https://facebook.com/p/1', targetUrl: mine + '/alive', kind: 'referrer' }));
  check('a target on someone else\u0027s domain ignored', 'ignored' === await linkRepair.recordSighting(sites.me, { sourceUrl: blogA, targetUrl: 'https://elsewhere.example/x', kind: 'referrer' }));
  check('javascript: url ignored', 'ignored' === await linkRepair.recordSighting(sites.me, { sourceUrl: 'javascript:alert(1)', targetUrl: mine + '/alive', kind: 'referrer' }));
  check('still three rows', Object.keys(links).length === 3, String(Object.keys(links).length));

  console.log('\n--- tracking parameters do not multiply a link ---');
  const before = Object.keys(links).length;
  await linkRepair.recordSighting(sites.me, { sourceUrl: blogB + '?utm_source=news&fbclid=abc', targetUrl: mine + '/alive#top', kind: 'referrer' });
  check('utm/fbclid/fragment collapse onto the existing row', Object.keys(links).length === before, String(Object.keys(links).length));

  console.log('\n--- verification fetches both ends ---');
  const result = await linkRepair.verifySite(sites.me, 10);
  check('all three checked', result.checked === 3, JSON.stringify(result));
  const byHost = (url) => Object.values(links).find(l => l.sourceUrl === url);
  check('link to a dead page -> target-missing', byHost(blogA).status === 'target-missing', byHost(blogA).status);
  check('  and it recorded the real 404', byHost(blogA).targetStatus === 404);
  check('  and the anchor text was read', byHost(blogA).anchor === 'Best tree service', String(byHost(blogA).anchor));
  check('  and brokenSince was stamped', !!byHost(blogA).brokenSince);
  check('healthy link -> live', byHost(blogB).status === 'live', byHost(blogB).status);
  check('  and rel=nofollow was read, not assumed', byHost(blogB).dofollow === false && byHost(blogB).rel === 'nofollow');
  check('link taken down -> removed', byHost(blogC).status === 'removed', byHost(blogC).status);
  check('  removed is not counted as broken', result.broken === 1, String(result.broken));

  console.log('\n--- the summary the owner sees ---');
  const all = await linkRepair.linksFor('me');
  const sum = linkRepair.summarise(all);
  check('1 broken, 1 live, 1 removed', sum.broken === 1 && sum.live === 1 && sum.removed === 1, JSON.stringify(sum));
  check('broken domains counted, not broken links', sum.brokenDomains === 1);
  check('broken sorts to the top', all[0].status === 'target-missing');

  console.log('\n--- the guard: which paths must not be renamed ---');
  let guarded = await linkRepair.protectedPaths('me');
  check('/alive is protected (a live link points at it)', !!guarded['/alive'], JSON.stringify(guarded));
  check('/gone is NOT protected - already broken, not an argument for the URL', !guarded['/gone']);
  check('the guard says who would break', guarded['/alive'].domains === 1 && guarded['/alive'].links === 1, JSON.stringify(guarded['/alive']));

  console.log('\n--- a redirect fixes it ---');
  pages['/gone'] = [301, '', { location: '/alive' }];
  await linkRepair.verifySite(sites.me, 10);
  check('the once-broken link now verifies live', byHost(blogA).status === 'live', byHost(blogA).status);
  check('  fixedAt stamped', !!byHost(blogA).fixedAt);
  guarded = await linkRepair.protectedPaths('me');
  check('  and that path is now guarded too', !!guarded['/gone']);

  console.log('\n--- manual entry (a paid placement) ---');
  r = await linkRepair.addManualLink(sites.me, blogC, mine + '/alive');
  check('accepted', r.ok === true);
  r = await linkRepair.addManualLink(sites.me, blogC, 'https://not-my-site.example/x');
  check('a target on another domain is refused', r.ok === false && /your own site/.test(r.reason), JSON.stringify(r));
  r = await linkRepair.addManualLink(sites.me, 'not a url', mine + '/alive');
  check('a junk URL is refused', r.ok === false);

  // The crawler fetches URLs a WordPress install chose. That is only safe
  // because it refuses to be aimed at anything internal, so prove it with the
  // test escape hatch switched off.
  console.log('');
  console.log('--- the crawler refuses to be pointed inwards ---');
  delete process.env.LINK_REPAIR_ALLOW_PRIVATE;
  check('cloud metadata address blocked', false === await linkRepair.isFetchableHost('169.254.169.254'));
  check('loopback blocked', false === await linkRepair.isFetchableHost('127.0.0.1'));
  check('private 10.x blocked', false === await linkRepair.isFetchableHost('10.0.0.5'));
  check('private 192.168.x blocked', false === await linkRepair.isFetchableHost('192.168.1.1'));
  check('172.16-31 blocked', false === await linkRepair.isFetchableHost('172.20.0.1'));
  check('172.32 is public, not blocked by a sloppy range', false === linkRepair.isPrivateAddress('172.32.0.1'));
  check('bare hostname blocked', false === await linkRepair.isFetchableHost('localhost') && false === await linkRepair.isFetchableHost('intranet'));
  check('IPv6 loopback blocked', true === linkRepair.isPrivateAddress('::1'));
  check('a sighting naming an internal address is refused', 'ignored' === await linkRepair.recordSighting(sites.me, { sourceUrl: 'http://169.254.169.254/latest/meta-data', targetUrl: mine + '/alive', kind: 'referrer' }));
  process.env.LINK_REPAIR_ALLOW_PRIVATE = '1';

  // ---- the routes ----
  console.log('\n--- routes ---');
  const express = require(SERVER + '/node_modules/express');
  const app = express();
  app.use(express.json());
  require(SERVER + '/routes/apiRoutes.js')(app);
  require(SERVER + '/routes/integrationRoutes.js')(app);
  const srv = app.listen(0);
  await new Promise(r2 => srv.once('listening', r2));
  const B = `http://127.0.0.1:${srv.address().port}`;
  const j = async (m, p, body) => { const res = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, body: await res.json().catch(() => null) }; };

  let q = await j('POST', '/api/integration/link-sightings', { token: 'tok-me', sightings: [{ sourceUrl: blogA, targetUrl: mine + '/alive', kind: 'referrer' }] });
  check('plugin can report a sighting', q.status === 200 && q.body.stored === 1, JSON.stringify(q.body));
  q = await j('POST', '/api/integration/link-sightings', { token: 'nope', sightings: [] });
  check('bad token -> 404', q.status === 404);
  q = await j('POST', '/api/integration/link-sightings', { token: 'tok-me', sightings: 'lots' });
  check('non-array payload -> 400', q.status === 400);

  const flood = Array.from({ length: 200 }, (_, i) => ({ sourceUrl: `https://spam${i}.example/p`, targetUrl: mine + '/alive', kind: 'referrer' }));
  const countBefore = Object.keys(links).length;
  q = await j('POST', '/api/integration/link-sightings', { token: 'tok-me', sightings: flood });
  check('a flood is capped at 50 per report', Object.keys(links).length - countBefore === 50, String(Object.keys(links).length - countBefore));

  q = await j('GET', '/api/integration/link-repair?token=tok-me');
  check('plugin can read the report', q.status === 200 && typeof q.body.summary.broken === 'number');
  check('  and the guarded paths come with it', !!q.body.protectedPaths['/alive']);

  q = await j('GET', '/api/integration/protected-paths?token=tok-me');
  check('guard route works', q.status === 200 && !!q.body.paths['/alive']);

  const anyId = Object.keys(links)[0];
  q = await j('POST', '/api/integration/link-fixed', { token: 'tok-me', linkId: anyId, redirectTo: '/alive' });
  check('plugin can record a fix', q.status === 200 && !!links[anyId].fixedAt);
  q = await j('POST', '/api/integration/link-fixed', { token: 'tok-me', linkId: 'not-a-real-id', redirectTo: '/x' });
  check('an unknown link id is refused', q.status === 404);

  // Ownership: a link belonging to another site must not be touchable.
  sites.other = { id: 'other', url: 'https://other.example', ownerId: 'u9', verificationToken: 'tok-other' };
  links['foreign'] = { siteId: 'other', sourceUrl: 'https://x.example', targetUrl: 'https://other.example/p', status: 'live' };
  q = await j('POST', '/api/integration/link-fixed', { token: 'tok-me', linkId: 'foreign', redirectTo: '/x' });
  check("cannot fix another site's link with my token", q.status === 404);

  q = await j('GET', '/api/websites/me/links');
  check('dashboard can read its links', q.status === 200 && Array.isArray(q.body.links));
  q = await j('PATCH', '/api/websites/me/links/foreign', { dismissed: true });
  check("dashboard cannot touch another site's link", q.status === 404);
  q = await j('GET', '/api/websites/other/links');
  check("dashboard cannot read another owner's site", q.status === 404);

  q = await j('POST', '/api/websites/me/links', { sourceUrl: 'https://newplacement.example/post', targetUrl: mine + '/alive' });
  check('dashboard can add a placement', q.status === 200);

  q = await j('POST', '/api/websites/me/links/verify');
  check('first verify runs', q.status === 200, JSON.stringify(q.body).slice(0, 120));
  q = await j('POST', '/api/websites/me/links/verify');
  check('second verify is rate limited', q.status === 429 && !!q.body.nextVerifyAt);

  console.log('\n' + (fail ? '*** ' + fail + ' FAILURE(S) ***' : 'All link repair checks pass.'));
  srv.close(); mineSrv.close(); aSrv.close(); bSrv.close(); cSrv.close();
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
