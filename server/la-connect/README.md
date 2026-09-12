# LinkAuthority Connect

OAuth relay for the **Manus Auto Blogger** WordPress plugin. Customers click *Connect via LinkAuthority* in the plugin, authorise Facebook/Instagram, Pinterest or LinkedIn against **your** developer apps, and the resulting tokens are handed to their own WordPress site. Your server keeps nothing after the hand-off (temporary payloads expire in 10 minutes and are encrypted at rest).

## How it works

```
WordPress plugin ──popup──▶ /start ──▶ Facebook / Pinterest / LinkedIn login
                                          │
       plugin ◀──redirect (one-time code)── /callback/<provider>
       plugin ──POST /exchange (server-to-server)──▶ tokens + pages/boards/profile
```

* `/start` validates the licence key and the return URL (must be the site's `wp-admin/admin-post.php`), then redirects to the provider with a signed `state`.
* `/callback/<provider>` exchanges the code using your app secret, loads the account data, stores it under a one-time code and sends the popup back to the customer's site.
* `/exchange` returns that payload exactly once to the customer's server.
* `/refresh` refreshes Pinterest tokens (needs the app secret, so it lives here).
* `/verify` lets the plugin show licence status.

## Install

### A. Mount inside the existing Express app (linkauthority.live / web2one.live)

```bash
cd /path/to/your-express-app
git clone <this repo> la-connect   # or copy the folder
npm install express dotenv
```

```js
// in your app.js, after body parsers/before the catch-all route
const createConnect = require('./la-connect');
app.use('/connect', createConnect());   // reads config from process.env
```

Set the variables from `.env.example` in your hosting panel (cPanel → Setup Node.js App → Environment variables, or Plesk → Node.js → Custom environment variables). `BASE_URL` must be `https://www.linkauthority.live/connect` (or wherever you mounted it). Restart the app.

### B. Standalone (subdomain such as connect.linkauthority.live)

Create a Node.js app in the hosting panel with `server.js` as the startup file, copy `.env.example` to `.env`, fill it in, `npm install`, restart. With `MOUNT_PATH=/` the base URL is `https://connect.linkauthority.live`.

Check: `GET https://…/connect/health` → shows which providers are configured and the callback URLs to register.

## Developer apps (one time, on your account)

Register these redirect URIs (replace with your BASE_URL):

| Provider  | Redirect URI                                   |
|-----------|------------------------------------------------|
| Meta      | `https://www.linkauthority.live/connect/callback/meta`      |
| Pinterest | `https://www.linkauthority.live/connect/callback/pinterest` |
| LinkedIn  | `https://www.linkauthority.live/connect/callback/linkedin`  |

Because *other people* will connect through these apps they must be public:

* **Meta** – Business app, Live mode. App Review for `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management` (+ Business Verification). Until approved, only people with a role on the app can connect.
* **Pinterest** – apply for **Standard access** (Trial access only works for the app owner).
* **LinkedIn** – *Share on LinkedIn* + *Sign In with LinkedIn using OpenID Connect* are instant and work for everyone (personal profiles). Set `LINKEDIN_ORG_SCOPES=1` only after the Community Management API is approved.

## Licences

`licenses.json` (path in `LICENSES_FILE`):

```json
{ "MAB-XXXX-YYYY": { "label": "Customer name", "sites": 3, "active": true } }
```

`sites` = how many distinct site origins may use the key (0 = unlimited). Usage is recorded in `STORE_DIR`. Set `"active": false` to revoke. Leave `LICENSES_FILE` unset for open mode while testing.

Customers paste the key in **Auto Blogger → Social Sharing → LinkAuthority licence key**.

## Security notes

* App secrets never leave this server; the plugin only ever receives per-user tokens.
* `state` is HMAC-signed with `CONNECT_SECRET` and expires after 15 minutes; return URLs are restricted to `https://<site>/wp-admin/admin-post.php`.
* Temporary payloads are AES-256-GCM encrypted and deleted on first read or after 10 minutes.
* Put the relay behind HTTPS only. Rotate `CONNECT_SECRET` if it leaks (in-flight connections will simply fail and users reconnect).
