'use strict';

/**
 * Provider adapters: build authorize URLs, exchange codes, load the account
 * data the WordPress plugin needs (pages / boards / profile), refresh tokens.
 *
 * Uses Node 18+ global fetch. All secrets come from config (env).
 */

const GRAPH = 'https://graph.facebook.com';

async function json(res) {
	const text = await res.text();
	let body;
	try {
		body = text ? JSON.parse(text) : {};
	} catch (e) {
		body = { raw: text };
	}
	return { status: res.status, body };
}

function fail(message, details) {
	const err = new Error(message);
	err.details = details;
	return err;
}

/* -------------------------------------------------------------------------- */
/* Meta: Facebook Pages + Instagram Business                                  */
/* -------------------------------------------------------------------------- */

const meta = {
	scopes: 'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management',

	authorizeUrl(cfg, redirectUri, state) {
		const p = new URLSearchParams({
			client_id: cfg.META_APP_ID,
			redirect_uri: redirectUri,
			state,
			response_type: 'code',
		});
		if (cfg.META_CONFIG_ID) {
			p.set('config_id', cfg.META_CONFIG_ID);
		} else {
			p.set('scope', meta.scopes);
		}
		return 'https://www.facebook.com/dialog/oauth?' + p.toString();
	},

	async exchange(cfg, code, redirectUri) {
		const get = async (path, params) => {
			const r = await json(await fetch(GRAPH + path + '?' + new URLSearchParams(params)));
			if (r.body && r.body.error) {
				throw fail(r.body.error.message || 'Meta API error', r.body.error);
			}
			return r.body;
		};

		const short = await get('/oauth/access_token', {
			client_id: cfg.META_APP_ID,
			client_secret: cfg.META_APP_SECRET,
			redirect_uri: redirectUri,
			code,
		});

		let userToken = short.access_token;
		let expires = Math.floor(Date.now() / 1000) + 60 * 86400;
		try {
			const long = await get('/oauth/access_token', {
				grant_type: 'fb_exchange_token',
				client_id: cfg.META_APP_ID,
				client_secret: cfg.META_APP_SECRET,
				fb_exchange_token: userToken,
			});
			userToken = long.access_token;
			if (long.expires_in) {
				expires = Math.floor(Date.now() / 1000) + Number(long.expires_in);
			}
		} catch (e) {
			/* keep short-lived token */
		}

		let userName = '';
		try {
			const me = await get('/me', { fields: 'id,name', access_token: userToken });
			userName = me.name || '';
		} catch (e) { /* ignore */ }

		const accounts = await get('/me/accounts', {
			fields: 'id,name,access_token,instagram_business_account{id,username}',
			limit: 100,
			access_token: userToken,
		});

		const pages = (accounts.data || []).map((p) => ({
			id: p.id,
			name: p.name,
			access_token: p.access_token,
			ig_id: p.instagram_business_account ? p.instagram_business_account.id : '',
			ig_username: p.instagram_business_account ? p.instagram_business_account.username : '',
		}));
		if (!pages.length) {
			throw fail('No Facebook Pages were returned. Grant access to at least one Page in the Facebook dialog.');
		}

		return {
			user_token: userToken,
			expires,
			user_name: userName,
			pages,
			fb_page_id: '',
			ig_page_id: '',
		};
	},
};

/* -------------------------------------------------------------------------- */
/* Pinterest v5                                                               */
/* -------------------------------------------------------------------------- */

const PIN = 'https://api.pinterest.com/v5';

const pinterest = {
	scopes: 'boards:read,pins:read,pins:write,user_accounts:read',

	authorizeUrl(cfg, redirectUri, state) {
		const p = new URLSearchParams({
			client_id: cfg.PINTEREST_APP_ID,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: pinterest.scopes,
			state,
		});
		return 'https://www.pinterest.com/oauth/?' + p.toString();
	},

	async token(cfg, form) {
		const r = await json(
			await fetch(PIN + '/oauth/token', {
				method: 'POST',
				headers: {
					Authorization: 'Basic ' + Buffer.from(cfg.PINTEREST_APP_ID + ':' + cfg.PINTEREST_APP_SECRET).toString('base64'),
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams(form).toString(),
			})
		);
		if (r.status >= 400 || !r.body.access_token) {
			throw fail(r.body.message || 'Pinterest token request failed', r.body);
		}
		return r.body;
	},

	async exchange(cfg, code, redirectUri) {
		const t = await pinterest.token(cfg, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
		const auth = { Authorization: 'Bearer ' + t.access_token };

		let username = '';
		try {
			const u = await json(await fetch(PIN + '/user_account', { headers: auth }));
			username = u.body.username || '';
		} catch (e) { /* ignore */ }

		const b = await json(await fetch(PIN + '/boards?page_size=100', { headers: auth }));
		if (b.status >= 400) {
			throw fail(b.body.message || 'Could not list Pinterest boards', b.body);
		}
		const boards = (b.body.items || []).map((x) => ({ id: x.id, name: x.name }));
		if (!boards.length) {
			throw fail('No boards found on this Pinterest account. Create a board first.');
		}

		return {
			access_token: t.access_token,
			refresh_token: t.refresh_token || '',
			expires: Math.floor(Date.now() / 1000) + Number(t.expires_in || 30 * 86400),
			username,
			boards,
			board_id: '',
			board_name: '',
		};
	},

	async refresh(cfg, refreshToken) {
		const t = await pinterest.token(cfg, { grant_type: 'refresh_token', refresh_token: refreshToken });
		return {
			access_token: t.access_token,
			refresh_token: t.refresh_token || refreshToken,
			expires: Math.floor(Date.now() / 1000) + Number(t.expires_in || 30 * 86400),
		};
	},
};

/* -------------------------------------------------------------------------- */
/* LinkedIn (personal profile; Company Pages when LINKEDIN_ORG_SCOPES=1)      */
/* -------------------------------------------------------------------------- */

const LI = 'https://api.linkedin.com';

const linkedin = {
	scopes(cfg, wantOrg) {
		const s = ['openid', 'profile', 'w_member_social'];
		if (wantOrg && cfg.LINKEDIN_ORG_SCOPES === '1') {
			s.push('r_organization_admin', 'w_organization_social');
		}
		return s.join(' ');
	},

	authorizeUrl(cfg, redirectUri, state, wantOrg) {
		const p = new URLSearchParams({
			response_type: 'code',
			client_id: cfg.LINKEDIN_CLIENT_ID,
			redirect_uri: redirectUri,
			state,
			scope: linkedin.scopes(cfg, wantOrg),
		});
		return 'https://www.linkedin.com/oauth/v2/authorization?' + p.toString();
	},

	async exchange(cfg, code, redirectUri, wantOrg) {
		const r = await json(
			await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					redirect_uri: redirectUri,
					client_id: cfg.LINKEDIN_CLIENT_ID,
					client_secret: cfg.LINKEDIN_CLIENT_SECRET,
				}).toString(),
			})
		);
		if (r.status >= 400 || !r.body.access_token) {
			throw fail(r.body.error_description || 'LinkedIn token request failed', r.body);
		}
		const access = r.body.access_token;
		const expires = Math.floor(Date.now() / 1000) + Number(r.body.expires_in || 60 * 86400);

		const me = await json(await fetch(LI + '/v2/userinfo', { headers: { Authorization: 'Bearer ' + access } }));
		if (me.status >= 400 || !me.body.sub) {
			throw fail('Could not read the LinkedIn profile (is "Sign In with LinkedIn using OpenID Connect" enabled on the app?)', me.body);
		}
		const name = [me.body.given_name, me.body.family_name].filter(Boolean).join(' ') || me.body.name || '';

		const orgs = [];
		if (wantOrg && cfg.LINKEDIN_ORG_SCOPES === '1') {
			const q = new URLSearchParams({
				q: 'roleAssignee',
				role: 'ADMINISTRATOR',
				state: 'APPROVED',
				projection: '(elements*(organization~(localizedName)))',
			});
			const acl = await json(
				await fetch(LI + '/rest/organizationAcls?' + q, {
					headers: {
						Authorization: 'Bearer ' + access,
						'LinkedIn-Version': cfg.LINKEDIN_API_VERSION || '202601',
						'X-Restli-Protocol-Version': '2.0.0',
					},
				})
			);
			if (acl.status < 400) {
				for (const el of acl.body.elements || []) {
					if (el.organization) {
						orgs.push({ urn: el.organization, name: (el['organization~'] && el['organization~'].localizedName) || el.organization });
					}
				}
			}
		}

		return {
			access_token: access,
			expires,
			person_urn: 'urn:li:person:' + me.body.sub,
			name,
			orgs,
			author_urn: '',
			author_name: '',
		};
	},
};

module.exports = { meta, pinterest, linkedin };
