'use strict';

/**
 * LinkAuthority Connect - OAuth relay for the Manus Auto Blogger WordPress plugin.
 *
 * Mount it in an existing Express app:
 *     const connect = require('./la-connect');
 *     app.use('/connect', connect());            // config from process.env
 *
 * or run it standalone: `node server.js` (see server.js / README.md).
 *
 * Routes (relative to the mount point):
 *   GET  /start?provider=meta|pinterest|linkedin&site=&return=&state=&license=&org=0|1
 *   GET  /callback/:provider            <- registered as the redirect URI at Meta / Pinterest / LinkedIn
 *   POST /exchange   {code, license, site}   -> one-time account payload (tokens + pages/boards/profile)
 *   POST /refresh    {provider, refresh_token, license, site}
 *   POST /verify     {license, site}         -> licence status
 *   GET  /health
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const providers = require('./lib/providers');
const Store = require('./lib/store');

const STATE_TTL_MS = 15 * 60 * 1000;

function b64url(buf) {
	return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
	return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

module.exports = function createConnect(options = {}) {
	const cfg = Object.assign({}, process.env, options);

	if (!cfg.CONNECT_SECRET || cfg.CONNECT_SECRET.length < 24) {
		throw new Error('CONNECT_SECRET must be set (a random string of at least 24 characters).');
	}
	if (!cfg.BASE_URL) {
		throw new Error('BASE_URL must be set, e.g. https://www.linkauthority.live/connect');
	}
	const base = cfg.BASE_URL.replace(/\/+$/, '');
	const store = new Store(cfg.STORE_DIR || path.join(os.tmpdir(), 'la-connect'), cfg.CONNECT_SECRET);
	const allowHttp = cfg.ALLOW_HTTP === '1';

	/* ---------------------------------------------------------------- */
	/* Licences                                                          */
	/* ---------------------------------------------------------------- */

	function loadLicenses() {
		// Priority: LICENSES_FILE (JSON) > LICENSES env (comma-separated keys) > open mode.
		if (cfg.LICENSES_FILE) {
			try {
				return JSON.parse(fs.readFileSync(cfg.LICENSES_FILE, 'utf8'));
			} catch (e) {
				console.error('[la-connect] Cannot read LICENSES_FILE:', e.message);
				return {};
			}
		}
		if (cfg.LICENSES) {
			const out = {};
			for (const k of cfg.LICENSES.split(',').map((s) => s.trim()).filter(Boolean)) {
				out[k] = { label: k, sites: 0, active: true };
			}
			return out;
		}
		return null; // open mode
	}

	/**
	 * @return {{ok:boolean, message?:string, label?:string, sites_max?:number, sites_used?:number}}
	 */
	function checkLicense(key, site) {
		const list = loadLicenses();
		if (list === null) {
			return { ok: true, label: 'open', sites_max: 0, sites_used: 0 };
		}
		key = String(key || '').trim();
		const lic = key && list[key];
		if (!lic || lic.active === false) {
			return { ok: false, message: 'Invalid or inactive licence key.' };
		}
		const usage = store.usage(key);
		const sites = Object.keys(usage.sites);
		const max = Number(lic.sites || 0);
		if (max > 0 && !usage.sites[site] && sites.length >= max) {
			return { ok: false, message: `This licence is already used on ${sites.length} site(s) (limit ${max}).` };
		}
		return { ok: true, label: lic.label || key, sites_max: max, sites_used: sites.length };
	}

	/* ---------------------------------------------------------------- */
	/* Signed OAuth state (stateless across Passenger processes)         */
	/* ---------------------------------------------------------------- */

	function sign(payload) {
		const body = b64url(JSON.stringify(payload));
		const mac = b64url(crypto.createHmac('sha256', cfg.CONNECT_SECRET).update(body).digest());
		return body + '.' + mac;
	}
	function verify(state) {
		const [body, mac] = String(state || '').split('.');
		if (!body || !mac) {
			return null;
		}
		const expect = b64url(crypto.createHmac('sha256', cfg.CONNECT_SECRET).update(body).digest());
		if (expect.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(mac))) {
			return null;
		}
		try {
			const p = JSON.parse(unb64url(body).toString('utf8'));
			if (!p.t || Date.now() - p.t > STATE_TTL_MS) {
				return null;
			}
			return p;
		} catch (e) {
			return null;
		}
	}

	/* ---------------------------------------------------------------- */
	/* Helpers                                                           */
	/* ---------------------------------------------------------------- */

	function siteOf(url) {
		try {
			const u = new URL(url);
			return u.origin;
		} catch (e) {
			return '';
		}
	}

	function validReturn(url) {
		let u;
		try {
			u = new URL(url);
		} catch (e) {
			return false;
		}
		if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) {
			return false;
		}
		return /\/wp-admin\/admin-post\.php$/.test(u.pathname);
	}

	function sendBack(res, returnUrl, params) {
		const u = new URL(returnUrl);
		for (const [k, v] of Object.entries(params)) {
			u.searchParams.set(k, v);
		}
		res.redirect(302, u.toString());
	}

	function page(res, title, message, status = 400) {
		res.status(status).type('html').send(
			`<!doctype html><meta charset="utf-8"><title>${title}</title>` +
			`<body style="font-family:system-ui,sans-serif;background:#f1f5f9;padding:40px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 10px 30px -12px rgba(2,6,23,.25)">` +
			`<h1 style="font-size:20px;margin:0 0 10px">${title}</h1><p style="color:#475569">${message}</p>` +
			`<button onclick="window.close()" style="border:0;border-radius:999px;padding:10px 20px;background:#64748b;color:#fff;font-weight:700">Close</button></div>`
		);
	}

	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

	/* ---------------------------------------------------------------- */
	/* Router                                                            */
	/* ---------------------------------------------------------------- */

	const router = express.Router();
	router.use(express.json({ limit: '64kb' }));
	router.use(express.urlencoded({ extended: false, limit: '64kb' }));

	router.get('/health', (req, res) => {
		res.json({
			ok: true,
			providers: {
				meta: !!(cfg.META_APP_ID && cfg.META_APP_SECRET),
				pinterest: !!(cfg.PINTEREST_APP_ID && cfg.PINTEREST_APP_SECRET),
				linkedin: !!(cfg.LINKEDIN_CLIENT_ID && cfg.LINKEDIN_CLIENT_SECRET),
			},
			licensing: loadLicenses() === null ? 'open' : 'required',
			callbacks: ['meta', 'pinterest', 'linkedin'].map((p) => `${base}/callback/${p}`),
		});
	});

	/* Step 1 ---------------------------------------------------------- */
	router.get('/start', (req, res) => {
		const { provider, site, state, license } = req.query;
		const returnUrl = req.query.return;
		const org = req.query.org === '1';

		if (!providers[provider]) {
			return page(res, 'Unknown provider', 'The provider parameter is invalid.');
		}
		if (!validReturn(returnUrl) || !site || siteOf(returnUrl) !== siteOf(site)) {
			return page(res, 'Invalid return URL', 'The return URL must be the https admin-post.php endpoint of the requesting WordPress site.');
		}
		if (!state || String(state).length < 8) {
			return page(res, 'Missing state', 'The request is missing its security token.');
		}
		const lic = checkLicense(license, siteOf(site));
		if (!lic.ok) {
			return sendBack(res, returnUrl, { state, error: lic.message });
		}
		const credsOk = {
			meta: cfg.META_APP_ID && cfg.META_APP_SECRET,
			pinterest: cfg.PINTEREST_APP_ID && cfg.PINTEREST_APP_SECRET,
			linkedin: cfg.LINKEDIN_CLIENT_ID && cfg.LINKEDIN_CLIENT_SECRET,
		}[provider];
		if (!credsOk) {
			return sendBack(res, returnUrl, { state, error: `The ${provider} connection is not configured on the connect server yet.` });
		}

		const signed = sign({ p: provider, r: returnUrl, s: String(state), l: String(license || ''), site: siteOf(site), org: org ? 1 : 0, t: Date.now() });
		const redirectUri = `${base}/callback/${provider}`;
		const url = providers[provider].authorizeUrl(cfg, redirectUri, signed, org);
		res.redirect(302, url);
	});

	/* Step 2 ---------------------------------------------------------- */
	router.get('/callback/:provider', async (req, res) => {
		const provider = req.params.provider;
		const st = verify(req.query.state);
		if (!st || st.p !== provider || !providers[provider]) {
			return page(res, 'Session expired', 'The sign-in session is invalid or expired. Close this window and click Connect again.');
		}
		if (req.query.error) {
			const msg = req.query.error_description || req.query.error_message || req.query.error;
			return sendBack(res, st.r, { state: st.s, error: `Authorisation was cancelled or failed: ${msg}` });
		}
		if (!req.query.code) {
			return sendBack(res, st.r, { state: st.s, error: 'No authorisation code was returned.' });
		}

		try {
			const account = await providers[provider].exchange(cfg, String(req.query.code), `${base}/callback/${provider}`, !!st.org);
			const code = store.put({ provider, site: st.site, license: st.l, account }, 600);
			if (st.l) {
				store.recordUsage(st.l, st.site);
			}
			return sendBack(res, st.r, { state: st.s, code });
		} catch (e) {
			console.error('[la-connect] exchange failed:', provider, e.message, e.details || '');
			return sendBack(res, st.r, { state: st.s, error: e.message || 'Token exchange failed.' });
		}
	});

	/* Step 3 (server-to-server from the WordPress site) ----------------- */
	router.post('/exchange', (req, res) => {
		const { code, license, site } = req.body || {};
		const lic = checkLicense(license, siteOf(site));
		if (!lic.ok) {
			return res.status(403).json({ ok: false, message: lic.message });
		}
		const rec = code ? store.take(String(code)) : null;
		if (!rec) {
			return res.status(404).json({ ok: false, message: 'The connection code is invalid or has expired. Please connect again.' });
		}
		if (rec.site !== siteOf(site)) {
			return res.status(403).json({ ok: false, message: 'This connection belongs to a different site.' });
		}
		res.json({ ok: true, provider: rec.provider, account: rec.account });
	});

	/* Token refresh (Pinterest) ---------------------------------------- */
	router.post('/refresh', async (req, res) => {
		const { provider, refresh_token, license, site } = req.body || {};
		const lic = checkLicense(license, siteOf(site));
		if (!lic.ok) {
			return res.status(403).json({ ok: false, message: lic.message });
		}
		if (provider !== 'pinterest' || !refresh_token) {
			return res.status(400).json({ ok: false, message: 'Only Pinterest tokens can be refreshed.' });
		}
		try {
			const t = await providers.pinterest.refresh(cfg, String(refresh_token));
			res.json({ ok: true, tokens: t });
		} catch (e) {
			res.status(502).json({ ok: false, message: e.message });
		}
	});

	/* Licence check ----------------------------------------------------- */
	router.post('/verify', (req, res) => {
		const { license, site } = req.body || {};
		const lic = checkLicense(license, siteOf(site));
		res.status(lic.ok ? 200 : 403).json(Object.assign({ ok: lic.ok }, lic));
	});

	router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
		console.error('[la-connect]', err);
		res.status(500).json({ ok: false, message: 'Internal error.' });
	});

	// Expose for tests / admin tooling.
	router.checkLicense = checkLicense;
	router.esc = esc;
	return router;
};
