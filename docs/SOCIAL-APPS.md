# Registering the social media apps

Publisher users connect their Facebook Page, Instagram, LinkedIn and Pinterest
accounts with one click because they authorise against **LinkAuthority's** developer
apps, not their own. This is the one-time setup of those apps, in the order that
gets something working soonest.

The honest headline first: **LinkedIn works for everyone today. Pinterest and Meta
work for you today, and for everyone else only after each platform approves the
app.** Meta's approval is the slow one - weeks, and often a rejection first.
Start it now and let it run while the others are already live.

The relay code is `server/la-connect/`. Every redirect URI below is one it serves;
`GET https://www.linkauthority.live/connect/health` lists them and shows which
providers are configured.

---

## Step 0 - Turn the relay on (5 minutes)

Without these two variables the relay answers 503 and nothing else matters.

In cPanel → **Setup Node.js App** → the linkauthority app → **Environment variables**:

| Variable | Value |
|---|---|
| `CONNECT_SECRET` | A random string, 32+ characters. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BASE_URL` | `https://www.linkauthority.live/connect` |

Restart the app. Then `https://www.linkauthority.live/connect/health` should return JSON with
all three providers `false`. That's correct - it's live and empty.

**Do not commit `CONNECT_SECRET` anywhere.** If it ever leaks, change it; in-flight
connections fail and users just click Connect again.

---

## 1. LinkedIn - instant, do this first

Proves the whole flow end to end in about 15 minutes, because the two products
Publisher needs are self-serve.

### Prerequisite
A **LinkedIn Company Page** for LinkAuthority. Apps must be attached to one. If there
isn't one: linkedin.com → Work → Create a Company Page. Takes five minutes.

### Create the app
1. https://www.linkedin.com/developers/apps → **Create app**
2. App name: `LinkAuthority Connect`. Company: the page above. Upload a logo. Agree to terms.
3. **Auth** tab → note **Client ID** and **Primary Client Secret**
4. Same tab → **Authorized redirect URLs for your app** → add exactly:
   ```
   https://www.linkauthority.live/connect/callback/linkedin
   ```
5. **Products** tab → **Request access** on both:
   - **Share on LinkedIn** (gives `w_member_social`)
   - **Sign In with LinkedIn using OpenID Connect** (gives `openid`, `profile`)

   Both are granted immediately.
6. **Settings** tab → **Verify** → send the verification link to a page admin (you) →
   approve. Unverified apps show a warning to users.

### Env vars
```
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_ORG_SCOPES=0
LINKEDIN_API_VERSION=202601
```

### What this gives users
Posting to their **personal profile**. Works for every user, right now.

### Company Page posting - later
Posting to a Company Page needs the **Community Management API** product, which is an
application (Marketing Developer Platform), takes weeks, and LinkedIn restricts it.
Apply from the Products tab when the personal flow is proven. Only once approved, set
`LINKEDIN_ORG_SCOPES=1` - setting it earlier makes every LinkedIn connection fail.

### Known limitation
LinkedIn tokens last **60 days** and these products issue no refresh token. Users
reconnect from the plugin when it expires; the plugin shows the expiry date.

---

## 2. Pinterest - works for you now, everyone after approval

### Prerequisite
A **Pinterest Business account**. Convert a personal one at
pinterest.com/business/convert, or create a new one.

### Create the app
1. https://developers.pinterest.com/apps/ → **Connect app** (Create app)
2. Name: `LinkAuthority Connect`. Description: what it does - "Lets WordPress sites
   running the Publisher plugin pin each new blog post, with its featured image,
   to a board the site owner chooses."
3. Once created, open it → note **App ID** and **App secret key**
4. **Redirect URIs** → add exactly:
   ```
   https://www.linkauthority.live/connect/callback/pinterest
   ```
5. Scopes the relay requests: `boards:read`, `pins:read`, `pins:write`,
   `user_accounts:read`. Make sure the app is allowed those.

### Env vars
```
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
```

### The access tiers - this is the part that bites
- **Trial access** (what you get on creation): the app works **only for the account
  that owns it.** You can test the full flow. Nobody else can connect.
- **Standard access**: required for other people to connect. Apply from the app page.
  You describe the use case, the platform it runs on (WordPress plugin) and may be
  asked for a short video of the flow. Turnaround is days to a couple of weeks.

Apply for Standard as soon as the app exists. There is nothing to wait for.

Pinterest tokens **do** refresh; the relay handles that at `/connect/refresh`.

---

## 3. Meta (Facebook + Instagram) - start today, expect weeks

This is the platform where "let all users connect their own accounts" costs the most.
Until Meta approves the app, **only people with a role on the app can connect** - you,
plus anyone you add as an admin, developer or tester. That is fine for proving it
works and useless for the public. Public use needs **App Review** for six permissions
and **Business Verification** of LinkAuthority as a company.

### Prerequisites
- A **Facebook Business Portfolio** (business.facebook.com) owned by you
- For Instagram: the user's Instagram must be a **Business or Creator** account
  **linked to a Facebook Page**. Personal Instagram accounts cannot be posted to by
  any third-party app - that is Meta's rule, not ours. Tell users this up front.

### Create the app
1. https://developers.facebook.com/apps → **Create App**
2. Use case: **Other** → App type: **Business**. Name: `LinkAuthority Connect`.
   Attach the Business Portfolio.
3. **App settings → Basic** → note **App ID** and **App secret**. Fill in:
   - **Privacy Policy URL**: `https://www.linkauthority.live/privacy-policy`
   - **Terms of Service URL**: `https://www.linkauthority.live/terms-of-service`
   - **App icon** (1024×1024), **Category** (Business and Pages)
   - **User data deletion**: choose "Data deletion instructions URL". LinkAuthority
     stores no tokens - they live on the user's WordPress site - so the instructions
     are "disconnect the network in Publisher → Social Sharing, which deletes the
     token". You need a public page saying that; the User Guide is the natural home.
4. **Add product → Facebook Login for Business** → Settings →
   **Valid OAuth Redirect URIs** → add exactly:
   ```
   https://www.linkauthority.live/connect/callback/meta
   ```
5. **Add product → Instagram** (Instagram Graph API). No extra settings needed.

### Env vars
```
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=          (optional - leave empty to request scopes directly)
```

### Test it before review
With the app in **Development mode**, add yourself under **App roles** and connect
from a test WordPress site. Everything works for role-holders. Use this to record the
screencast review needs.

### App Review - the permissions the relay requests
Go to **App Review → Permissions and features** and request **Advanced Access** on:

| Permission | Why the reviewer needs to see it |
|---|---|
| `pages_show_list` | Listing the user's Pages so they can pick one |
| `pages_manage_posts` | Publishing the post to that Page |
| `pages_read_engagement` | Reading the Page to confirm the post went up |
| `instagram_basic` | Finding the Instagram account linked to the Page |
| `instagram_content_publish` | Publishing the image post to Instagram |
| `business_management` | Accessing Pages owned by a Business Portfolio |

For each one you supply a written justification and a **screencast** showing exactly
that permission in use: the plugin's Connect button → the Meta popup → choosing a
Page → a post appearing on it. One recording covering the whole flow can be attached
to all six.

Rejections are normal on the first pass and usually cite an unclear video or a
permission that wasn't visibly exercised. Read the note, re-record, resubmit.

### Business Verification
Required for Advanced Access. **Business settings → Security Centre → Start
verification.** Upload a business document (registration, tax document, or a
utility bill showing the business name and address). Typically a few days.

### Switch to Live
Once review passes: **App settings → Basic → App mode → Live.** Now anyone can connect.

---

## What to tell users

Put this in the plugin's Social Sharing tab and the User Guide, because each one
will otherwise become a support ticket:

- **Instagram must be a Business/Creator account linked to a Facebook Page.**
- **LinkedIn connections expire after 60 days** - reconnect from the same screen.
- **Company Pages on LinkedIn** are not available until LinkedIn approves it.
- Their **site must be HTTPS** and publicly reachable - Instagram and Pinterest fetch
  the featured image from it.

---

## Licence keys

The relay runs in **open mode** until `LICENSES_FILE` is set - any site can connect.
That is right while it's free. Before charging, create the file on the server:

```json
{ "LAP-XXXX-YYYY": { "label": "Customer name", "sites": 3, "active": true } }
```

Point `LICENSES_FILE` at it (an absolute path outside the web root) and restart.
`sites: 0` means unlimited. `"active": false` revokes. Issuing keys from the
LinkAuthority dashboard automatically is a separate piece of work.

---

## Recommended order

| When | Do |
|---|---|
| Today | Step 0. LinkedIn end to end (15 min). Create the Pinterest and Meta apps and **submit both applications** - the clock only starts when you do. |
| This week | Record the Meta screencast from a test site. Start Business Verification. Write the data-deletion paragraph in the User Guide. |
| On approval | Add the credentials, restart. The Publisher tab's status turns green per network on its own. |
