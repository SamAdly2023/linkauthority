'use strict';

/**
 * Tiny file-backed store for one-time payloads and licence usage.
 *
 * File-based on purpose: Passenger runs several Node processes for one app,
 * so an in-memory Map would not be shared between them. Everything written
 * here is encrypted with the CONNECT_SECRET and expires quickly.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Store {
	constructor(dir, secret) {
		this.dir = dir;
		this.key = crypto.createHash('sha256').update(String(secret)).digest();
		fs.mkdirSync(dir, { recursive: true });
	}

	file(name) {
		return path.join(this.dir, name.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
	}

	encrypt(obj) {
		const iv = crypto.randomBytes(12);
		const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
		const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
		return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
	}

	decrypt(b64) {
		const buf = Buffer.from(b64, 'base64');
		const iv = buf.subarray(0, 12);
		const tag = buf.subarray(12, 28);
		const enc = buf.subarray(28);
		const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
		decipher.setAuthTag(tag);
		return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
	}

	/** Save an object under a random one-time code (default TTL 10 minutes). */
	put(obj, ttlSeconds = 600) {
		const code = crypto.randomBytes(24).toString('hex');
		fs.writeFileSync(this.file(code), JSON.stringify({ exp: Date.now() + ttlSeconds * 1000, data: this.encrypt(obj) }));
		this.sweep();
		return code;
	}

	/** Read and delete. Returns null when missing/expired. */
	take(code) {
		const f = this.file(code);
		if (!fs.existsSync(f)) {
			return null;
		}
		let rec;
		try {
			rec = JSON.parse(fs.readFileSync(f, 'utf8'));
		} catch (e) {
			rec = null;
		}
		try {
			fs.unlinkSync(f);
		} catch (e) { /* ignore */ }
		if (!rec || rec.exp < Date.now()) {
			return null;
		}
		try {
			return this.decrypt(rec.data);
		} catch (e) {
			return null;
		}
	}

	/** Remove expired files occasionally. */
	sweep() {
		if (Math.random() > 0.1) {
			return;
		}
		try {
			for (const name of fs.readdirSync(this.dir)) {
				if (!name.endsWith('.json') || name.startsWith('usage-')) {
					continue;
				}
				const f = path.join(this.dir, name);
				try {
					const rec = JSON.parse(fs.readFileSync(f, 'utf8'));
					if (rec.exp && rec.exp < Date.now()) {
						fs.unlinkSync(f);
					}
				} catch (e) {
					fs.unlinkSync(f);
				}
			}
		} catch (e) { /* ignore */ }
	}

	/** Licence usage: which sites have connected with a key. */
	usage(licenseKey) {
		const f = this.file('usage-' + crypto.createHash('sha1').update(licenseKey).digest('hex'));
		try {
			return JSON.parse(fs.readFileSync(f, 'utf8'));
		} catch (e) {
			return { sites: {} };
		}
	}

	recordUsage(licenseKey, site) {
		const f = this.file('usage-' + crypto.createHash('sha1').update(licenseKey).digest('hex'));
		const u = this.usage(licenseKey);
		u.sites[site] = { last: new Date().toISOString(), count: ((u.sites[site] && u.sites[site].count) || 0) + 1 };
		fs.writeFileSync(f, JSON.stringify(u));
		return u;
	}
}

module.exports = Store;
