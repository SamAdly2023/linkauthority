=== Visitor Insights ===
Contributors: samadly728
Tags: analytics, visitor tracking, traffic stats, referrers, reporting
Requires at least: 5.8
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.2.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Visitor and traffic analytics kept in your own WordPress database, with CSV/PDF reporting and optional identity lookups.

== Description ==

Visitor Insights adds a **Visitors** tab to your WordPress admin dashboard showing who's on your site and where they came from. Tracking data is stored in your own WordPress database - there is no external analytics account to sign up for. Three optional features can send data to third parties; all three are off until you turn them on, and each is described under External services below.

**Core features**

* Automatic session + pageview tracking via a lightweight front-end script (uses a local-storage session id, not cookies)
* Optional country / region / city / ISP lookup for new sessions (free ip-api.com service, no API key needed, off by default)
* Referrer and UTM campaign tracking (source, medium, campaign, term, content)
* Device signal flags: mobile, proxy/VPN, hosting/datacenter IP
* Searchable, date-filterable sessions table in wp-admin, with a traffic-source filter (Google Ads, Facebook/Instagram Ads, organic search, organic social, direct)
* One-click CSV export of the current filtered view
* PDF export built in - no extra setup, no dependencies to install
* Configurable data retention with automatic daily cleanup
* Excludes your own logged-in admin visits by default

**External services**

All three of these are off by default. With none of them enabled, no data leaves your site.

*IP geolocation (ip-api.com)* - when you enable "Geo lookup" in Settings, each new session's IP address is sent to ip-api.com to resolve country, region, city and ISP. The result is cached locally. Terms: https://ip-api.com/docs/legal - Privacy: https://ip-api.com/privacy

*Skip Trace (Apify)* - when you enable skip trace and supply an Apify API token, the seed identity you submit for a lookup (such as a name, address, phone or email you already hold) is sent to Apify to run the lookup actor. Nothing is sent unless you trigger a lookup. Terms: https://apify.com/terms-of-use - Privacy: https://apify.com/privacy-policy

*LinkAuthority reporting* - when you enter a LinkAuthority site token in Settings, this site's traffic totals are sent to https://www.linkauthority.live once a day: session and pageview counts, country names, referring hostnames, and per-day totals for the last 30 days. No IP addresses, no individual visitor records and no skip trace results are ever included. Terms: https://www.linkauthority.live/terms-of-service - Privacy: https://www.linkauthority.live/privacy-policy

**Optional: Skip Trace**

Given a name, address, phone, or email you already have for a visitor (e.g. from a form submission), Skip Trace can look up additional contact details via a third-party data provider (Apify). This is off by default and requires two separate opt-ins in Settings, because identity lookups carry real privacy/legal obligations that vary by jurisdiction - review your own legal requirements (GDPR, CCPA, or applicable local law) before enabling this feature.

== Installation ==

1. Upload the `visitor-insights` folder to `/wp-content/plugins/`, or install the zip via Plugins → Add New → Upload Plugin.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. A new **Visitors** menu item appears in wp-admin with your traffic stats. CSV and PDF export both work immediately - no extra setup, no dependencies.
4. (Optional) Go to Visitors → Settings to turn on IP geolocation, connect a LinkAuthority account for daily traffic reporting, or enable Skip Trace. All three are off until you set them up.
5. (For Skip Trace) In the same Settings screen, add your Apify API token and check both the "Enable skip trace" and consent acknowledgement boxes.

== Frequently Asked Questions ==

= Does this send my visitors' data to any third party? =

Not unless you switch something on. Core tracking - sessions, pageviews, referrers - is stored entirely in your own WordPress database. Three optional features call external services, and all three are off by default: IP geolocation (ip-api.com), Skip Trace (Apify), and LinkAuthority reporting. See "External services" in the description for exactly what each one sends.

= Does this need a cookie consent banner? =

The tracker uses `localStorage`, not cookies, to remember a visitor's session id. It does record IP addresses in your own database, which many privacy regimes treat as personal data. Whether that requires a banner, a privacy notice or anything else is a legal question for your own site and jurisdiction - this plugin does not provide legal advice.

= What happens to my data if I uninstall the plugin? =

Deactivating keeps all data intact. Choosing "Delete" from the Plugins screen permanently drops the plugin's database tables and settings.

== Changelog ==

= 1.2.1 =
* Document the LinkAuthority connection in the install steps and add an upgrade notice for the geolocation default change.

= 1.2.0 =
* Add optional daily reporting of traffic totals to a LinkAuthority dashboard - aggregates only, off unless a site token is entered.
* Default IP geolocation to off, so no visitor IP reaches ip-api.com until the site owner opts in.
* Widen the internal prefix from `vi_` to `visitor_insights_` to avoid collisions with other plugins. Existing settings migrate automatically; tracked data is untouched.
* Document every external service the plugin can contact.

= 1.1.1 =
* Fix: the Source filter (Google Ads / Facebook Ads / etc.) broke the Sessions list with a JSON error - the SQL LIKE wildcards it used weren't escaped for $wpdb->prepare(), which treats every "%" as a placeholder.

= 1.1.0 =
* Add traffic-source filter and column: Google Ads, Facebook/Instagram Ads, organic search, organic social, direct.
* Fix: Skip Trace modal Close button not working (CSS specificity issue with the `hidden` attribute).
* Switch PDF export to a bundled dependency-free writer (previously required an optional Composer library).

= 1.0.0 =
* Initial release: session/pageview tracking, geolocation, CSV/PDF export, optional Apify skip trace.

== Upgrade Notice ==

= 1.2.0 =
IP geolocation is now off by default; existing sites keep their current setting. Internal option names change and are migrated automatically on first load - your tracked data is not affected.

= 1.1.0 =
Traffic-source filtering, modal-close fix, dependency-free PDF export.
