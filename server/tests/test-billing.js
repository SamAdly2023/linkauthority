// Billing grants paid features, so every way of claiming one without paying
// has to fail. PayPal is stubbed at the HTTP client so the real request shapes
// still run: activation asks PayPal what a subscription id really is, and the
// webhook is verified with PayPal's signature endpoint before it is believed.
const Module = require('module');
const SERVER = 'C:/Users/Sam/Downloads/LinkAuthority/server';

process.env.PAYPAL_CLIENT_ID = 'test-client';
process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
process.env.PAYPAL_PLAN_ID = 'P-OURPLAN';
process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST';
process.env.PAYPAL_ENV = 'sandbox';

let fail = 0;
const check = (label, cond, detail) => {
  if (!cond) { fail++; console.log('  FAIL  ' + label + (detail ? '  ' + detail : '')); }
  else console.log('  ok    ' + label);
};

// ---- stores ----
const users = {
  u1: { name: 'Sam', email: 'sam@example.com' },
  u2: { name: 'Ada', email: 'ada@example.com' }
};
const websites = {};
const links = {};
let currentUser = 'u1';

const storeFor = (name) => ('users' === name ? users : 'websites' === name ? websites : links);

const col = (name) => {
  const store = storeFor(name);
  const query = (preds) => ({
    where: (f, op, v) => query([...preds, [f, v]]),
    limit: (n) => ({ get: async () => snap(preds, n) }),
    get: async () => snap(preds)
  });
  const valueAt = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  const snap = (preds, n) => {
    let rows = Object.entries(store).filter(([, doc]) => preds.every(([f, v]) => valueAt(doc, f) === v));
    if (n) rows = rows.slice(0, n);
    return { empty: !rows.length, size: rows.length, docs: rows.map(([id, d]) => ({ id, data: () => d })) };
  };

  return {
    ...query([]),
    // Firestore hands out an id when called with none; the code under test
    // relies on that to mint a new document.
    doc: (id) => ((id = id || name + "-" + (Object.keys(store).length + 1) + "-" + Math.random().toString(36).slice(2, 8)), {
      id,
      get: async () => ({ exists: !!store[id], id, data: () => store[id] }),
      set: async (v, opts) => { store[id] = opts && opts.merge ? { ...(store[id] || {}), ...v } : v; },
      update: async (v) => { Object.assign(store[id] = store[id] || {}, v); }
    })
  };
};

// ---- PayPal, stubbed at the wire ----
const paypalState = {
  subscriptions: {
    'I-ACTIVE': { id: 'I-ACTIVE', status: 'ACTIVE', plan_id: 'P-OURPLAN', billing_info: { next_billing_time: '2026-11-01T00:00:00Z' } },
    'I-CANCELLED': { id: 'I-CANCELLED', status: 'CANCELLED', plan_id: 'P-OURPLAN' },
    'I-OTHERPLAN': { id: 'I-OTHERPLAN', status: 'ACTIVE', plan_id: 'P-SOMEONE-ELSES' }
  },
  verifyResult: 'SUCCESS',
  calls: []
};

const fakeAxios = {
  post: async (url, body, opts) => {
    paypalState.calls.push(url);
    if (url.endsWith('/v1/oauth2/token')) return { data: { access_token: 'tok', expires_in: 3000 } };
    if (url.endsWith('/verify-webhook-signature')) return { data: { verification_status: paypalState.verifyResult } };
    const cancel = url.match(/subscriptions\/([^/]+)\/cancel$/);
    if (cancel) {
      const sub = paypalState.subscriptions[decodeURIComponent(cancel[1])];
      if (!sub) throw new Error('404');
      sub.status = 'CANCELLED';
      return { data: {} };
    }
    throw new Error('unexpected POST ' + url);
  },
  get: async (url) => {
    paypalState.calls.push(url);
    const m = url.match(/subscriptions\/([^/?]+)$/);
    if (m) {
      const sub = paypalState.subscriptions[decodeURIComponent(m[1])];
      if (!sub) { const e = new Error('not found'); e.response = { data: { name: 'RESOURCE_NOT_FOUND' } }; throw e; }
      return { data: sub };
    }
    throw new Error('unexpected GET ' + url);
  }
};

const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id.endsWith('services/firebase') || id === './firebase') return { db: { collection: col } };
  if (id.endsWith('middlewares/requireLogin')) return (req, res, next) => { req.user = { id: currentUser, email: users[currentUser].email }; next(); };
  if (id.endsWith('services/partnerSync')) return { broadcastRefresh: async () => {}, pingSite: async () => {} };
  if (id.endsWith('services/email')) return new Proxy({}, { get: () => async () => {} });
  if (id.endsWith('services/gemini')) return { analyzeWebsite: async () => ({}), getSEOAdvice: async () => ({}) };
  if (id.endsWith('services/notification')) return { sendNotification: async () => {} };
  if (id.endsWith('services/authority')) return { lookup: async () => null };
  if (id.endsWith('services/linkRepair')) return {
    linksFor: async (siteId) => Object.entries(links).filter(([, l]) => l.siteId === siteId).map(([id, l]) => ({ id, ...l })),
    addManualLink: async (site, source, target) => {
      const id = 'l' + (Object.keys(links).length + 1);
      links[id] = { siteId: site.id, sourceUrl: source, targetUrl: target, discoveredVia: 'manual', status: 'unverified' };
      return { ok: true, id };
    },
    verifySite: async () => ({ checked: 0, broken: 0, repaired: 0 }),
    summarise: () => ({ broken: 0 }),
    protectedPaths: async () => ({}),
    dismiss: async () => {},
    markFixed: async () => {},
    recordSightings: async () => ({ stored: 0, updated: 0, ignored: 0 }),
    MAX_SIGHTINGS_PER_REPORT: 50
  };
  if (id === 'adm-zip') return class {};
  if (id === 'axios' && (this.filename || '').includes('paypal')) return fakeAxios;
  return origRequire.apply(this, arguments);
};

const run = async () => {
  const express = require(SERVER + '/node_modules/express');
  const app = express();
  app.use(express.json());
  require(SERVER + '/routes/apiRoutes.js')(app);
  require(SERVER + '/routes/billingRoutes.js')(app);

  const srv = app.listen(0);
  await new Promise(r => srv.once('listening', r));
  const B = `http://127.0.0.1:${srv.address().port}`;
  const j = async (m, p, body, headers) => {
    const res = await fetch(B + p, {
      method: m,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const paypalHeaders = {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.sandbox.paypal.com/cert.pem',
    'paypal-transmission-id': 'tid',
    'paypal-transmission-sig': 'sig',
    'paypal-transmission-time': '2026-09-25T00:00:00Z'
  };

  console.log('--- billing status ---');
  let r = await j('GET', '/api/billing');
  check('200 with the plan on offer', r.status === 200 && r.body.pro.price === '29');
  check('starts free', r.body.plan === 'free');
  check('client id is published (it is public)', r.body.clientId === 'test-client');
  check('the secret never appears', !JSON.stringify(r.body).includes('test-secret'));

  console.log('\n--- activating a subscription ---');
  r = await j('POST', '/api/billing/activate', { subscriptionId: 'I-ACTIVE' });
  check('an active subscription for our plan upgrades the account', r.status === 200 && r.body.plan === 'pro', JSON.stringify(r.body));
  check('it was PayPal that was asked, not the request body', paypalState.calls.some(u => u.includes('/v1/billing/subscriptions/I-ACTIVE')));
  check('stored against the user', users.u1.plan === 'pro' && users.u1.billing.subscriptionId === 'I-ACTIVE');
  check('renewal date kept', users.u1.billing.renewsAt === '2026-11-01T00:00:00Z');

  console.log('\n--- ways of not paying ---');
  users.u1.plan = 'free'; delete users.u1.billing;
  r = await j('POST', '/api/billing/activate', { subscriptionId: 'I-CANCELLED' });
  check('a cancelled subscription does not upgrade', r.status === 400 && users.u1.plan === 'free', JSON.stringify(r.body));
  r = await j('POST', '/api/billing/activate', { subscriptionId: 'I-OTHERPLAN' });
  check('a subscription to a different plan does not upgrade', r.status === 400 && users.u1.plan === 'free');
  r = await j('POST', '/api/billing/activate', { subscriptionId: 'I-DOES-NOT-EXIST' });
  check('an invented id does not upgrade', r.status === 502 && users.u1.plan === 'free');
  r = await j('POST', '/api/billing/activate', { subscriptionId: '../../etc/passwd' });
  check('a malformed id is rejected before any call', r.status === 400);
  r = await j('POST', '/api/billing/activate', {});
  check('a missing id is rejected', r.status === 400);

  console.log('\n--- one subscription, one account ---');
  r = await j('POST', '/api/billing/activate', { subscriptionId: 'I-ACTIVE' });
  check('u1 subscribes', r.status === 200 && users.u1.plan === 'pro');
  currentUser = 'u2';
  r = await j('POST', '/api/billing/activate', { subscriptionId: 'I-ACTIVE' });
  check('u2 cannot reuse the same subscription id', r.status === 409 && (users.u2.plan || 'free') === 'free', JSON.stringify(r.body));
  currentUser = 'u1';

  console.log('\n--- webhooks ---');
  paypalState.subscriptions['I-ACTIVE'].status = 'SUSPENDED';
  r = await j('POST', '/api/billing/webhook', {
    event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
    resource: { id: 'I-ACTIVE' }
  }, paypalHeaders);
  check('a verified webhook downgrades a suspended subscription', r.status === 200 && users.u1.plan === 'free', users.u1.plan);

  paypalState.subscriptions['I-ACTIVE'].status = 'ACTIVE';
  r = await j('POST', '/api/billing/webhook', {
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource: { id: 'I-ACTIVE' }
  }, paypalHeaders);
  check('and restores it when PayPal says active again', r.status === 200 && users.u1.plan === 'pro');

  users.u1.plan = 'free';
  paypalState.verifyResult = 'FAILURE';
  r = await j('POST', '/api/billing/webhook', {
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource: { id: 'I-ACTIVE' }
  }, paypalHeaders);
  check('a webhook that fails signature verification is refused', r.status === 400 && users.u1.plan === 'free');
  paypalState.verifyResult = 'SUCCESS';

  r = await j('POST', '/api/billing/webhook', {
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource: { id: 'I-ACTIVE' }
  });
  check('a webhook with no PayPal headers at all is refused', r.status === 400 && users.u1.plan === 'free');

  r = await j('POST', '/api/billing/webhook', {
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource: { id: 'I-NOBODY-HAS-THIS' }
  }, paypalHeaders);
  check('an event for an unknown subscription is acknowledged, not acted on', r.status === 200 && r.body.unknown === true);

  console.log('\n--- the gates ---');
  currentUser = 'u1';
  users.u1.plan = 'free';

  r = await j('POST', '/api/websites', { url: 'https://first.example', category: 'Law' });
  check('a free account can add its first site', r.status === 200 || r.status === 201, String(r.status));
  const siteCount = () => Object.keys(websites).length;
  check('  and it was stored', siteCount() === 1);

  r = await j('POST', '/api/websites', { url: 'https://second.example', category: 'Law' });
  check('a second site is refused with a reason, not a generic error', r.status === 402 && /free account covers 1 website/i.test(r.body.error), JSON.stringify(r.body));
  check('  and nothing was created', siteCount() === 1);

  users.u1.plan = 'pro';
  r = await j('POST', '/api/websites', { url: 'https://second.example', category: 'Law' });
  check('Pro can add more', (r.status === 200 || r.status === 201) && siteCount() === 2, String(r.status));

  const siteId = Object.keys(websites)[0];
  websites[siteId].ownerId = 'u1';

  console.log('\n--- on-demand checks follow the plan ---');
  users.u1.plan = 'free';
  websites[siteId].linksVerifiedAt = new Date(Date.now() - 60 * 60 * 1000); // an hour ago
  r = await j('POST', `/api/websites/${siteId}/links/verify`);
  check('free: an hour after the last check is too soon', r.status === 429 && r.body.upgrade === true, JSON.stringify(r.body));

  users.u1.plan = 'pro';
  r = await j('POST', `/api/websites/${siteId}/links/verify`);
  check('pro: an hour later is fine', r.status === 200, JSON.stringify(r.body).slice(0, 100));

  console.log('\n--- hand-added placements ---');
  users.u1.plan = 'free';
  let added = 0;
  for (let i = 0; i < 6; i++) {
    const res = await j('POST', `/api/websites/${siteId}/links`, {
      sourceUrl: `https://placement${i}.example/post`,
      targetUrl: 'https://first.example/page'
    });
    if (res.status === 200) added++;
    if (i === 5) check('the sixth is refused with the limit explained', res.status === 402 && /5 links you add by hand/.test(res.body.error), JSON.stringify(res.body));
  }
  check('five hand-added links accepted on free', added === 5, String(added));

  users.u1.plan = 'pro';
  r = await j('POST', `/api/websites/${siteId}/links`, { sourceUrl: 'https://placement9.example/post', targetUrl: 'https://first.example/page' });
  check('Pro is not capped', r.status === 200);

  console.log('\n--- cancelling ---');
  users.u1.plan = 'pro';
  users.u1.billing = { subscriptionId: 'I-ACTIVE', status: 'ACTIVE' };
  paypalState.subscriptions['I-ACTIVE'].status = 'ACTIVE';
  r = await j('POST', '/api/billing/cancel');
  check('cancel is accepted', r.status === 200, JSON.stringify(r.body).slice(0, 120));
  check('PayPal was told', paypalState.calls.some(u => u.includes('/I-ACTIVE/cancel')));

  currentUser = 'u2';
  r = await j('POST', '/api/billing/cancel');
  check('a user with no subscription gets a clear 400', r.status === 400);

  console.log('\n' + (fail ? '*** ' + fail + ' FAILURE(S) ***' : 'All billing checks pass.'));
  srv.close();
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
