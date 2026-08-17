=== LinkAuthority Business Partners ===
Contributors: linkauthority
Tags: backlinks, seo, link building, partners, directory
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Publishes a Business Partners page listing the sites you exchange links with on the LinkAuthority network, kept in sync automatically.

== Description ==

LinkAuthority is a link-exchange network. Members list each other's businesses on a "Business Partners" page, giving every participating site a set of relevant, editorially presented outbound links.

This plugin renders that directory on your site and keeps it current. Add the shortcode `[linkauthority_partners]` to any page - or let the plugin create a ready-made Business Partners page for you - and the listing updates itself as businesses join or leave the network.

**What it does**

* Renders the partner directory anywhere via the `[linkauthority_partners]` shortcode
* Refreshes hourly, plus an immediate update when the network changes
* Ships responsive card styling that inherits nothing from, and overrides nothing in, your theme
* Adds Schema.org `ItemList` structured data describing the listed businesses
* Optional page-view reporting, so your LinkAuthority dashboard can show how the page performs
* Optional "Site by LinkAuthority" credit link

Both optional features are **off by default** and stay off until you turn them on.

**External service**

This plugin requires a free account at LinkAuthority and does not function without one. It is a client for that service.

Once you save your site token in the LinkAuthority menu in your sidebar, the plugin contacts `https://www.linkauthority.live` to:

* register your site as active on the network, and mark it inactive again when you deactivate the plugin (your site token and site URL are sent)
* download the current list of partner businesses, hourly and on demand (your site token is sent)
* report your Business Partners page view count, **only if** you enable that option (your site token and a single running total are sent - never any visitor details)

The plugin also exposes one authenticated REST route, `linkauthority/v1/update`, which LinkAuthority calls to trigger an immediate refresh. Requests must present your site token, which is compared in constant time; nothing else is accepted.

Service terms: https://www.linkauthority.live/terms-of-service
Privacy policy: https://www.linkauthority.live/privacy-policy

== Installation ==

1. Install the plugin through Plugins → Add New, or upload the `linkauthority-partners` folder to `/wp-content/plugins/`.
2. Activate it through the Plugins menu.
3. Go to the LinkAuthority menu in your sidebar and paste your site token, found in your LinkAuthority dashboard under My Sites → Integration.
4. Click **Create the Business Partners page**, or add `[linkauthority_partners]` to a page of your own.

== Frequently Asked Questions ==

= Do I need a LinkAuthority account? =

Yes. The plugin displays a directory served by LinkAuthority, so it has nothing to show without an account and a site token.

= Does the plugin edit my pages? =

No. The directory is rendered by the shortcode each time the page loads. Nothing is written into your post content, so your page stays exactly as you wrote it and removing the plugin leaves no markup behind.

= Are the links nofollow? =

No. Partner links are ordinary dofollow links, which is the point of the network. They open in the same tab.

= What data leaves my site? =

Your site token on every request, and your site URL when connecting. If you switch on page-view reporting, a single running total goes along with the hourly sync. No visitor data is collected or transmitted, and logged-in users are never counted.

= What happens when I deactivate it? =

Your site is marked inactive on the network and stops appearing in other members' directories. Your settings and the Business Partners page are left alone. Choosing Delete removes the plugin's stored options; the page remains, since it's your content.

== Screenshots ==

1. The Business Partners page rendered on the front end.
2. The LinkAuthority admin screen, showing connection status and the two opt-ins.

== Changelog ==

= 1.0.3 =
* Namespace every function, class, constant and option under a unique `linkauthority_partners` prefix.
* Connect to the service after the settings are stored rather than inside the sanitise callback.
* Add LICENSE.txt.

= 1.0.2 =
* Move the admin screen to its own top-level menu instead of burying it under Settings, and warn when the site token has not been entered yet.

= 1.0.1 =
* Lay the cards out as masonry columns instead of a grid, so a short description no longer leaves dead space under its card.

= 1.0.0 =
* First release.
