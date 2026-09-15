=== LinkAuthority Publisher ===
Contributors: samadly728
Tags: ai, blog, seo, content, automation, social media
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPLv2 or later

Automatically researches, writes and publishes 2,500-3,000 word SEO blog posts with Manus AI, a Manus-generated featured image and copyright-free Pexels photos & videos - on a daily / 2-day / 3-day / weekly schedule.

== Description ==

LinkAuthority Publisher turns your Manus AI API key into an autonomous content team:

* **Research-driven topics** - Manus browses the web for what your audience is searching for, avoids topics you already covered and picks an angle that can rank.
* **Long-form articles** - 2,500-3,000 words (configurable), 7-10 sections, key takeaways, FAQ, sourced facts, internal links to your site.
* **Featured image by Manus** - a unique, text-free hero image generated for every post (Pexels fallback).
* **Pexels photos & videos** - copyright-free media inside the article, credited automatically as the Pexels licence requires.
* **Eye-catching layout** - magazine-style styling with gradient accents in your brand colours, numbered sections, pull-stats, pro-tip callouts, an FAQ accordion and a call-to-action with your social links.
* **SEO extras** - meta description, focus keyword (Yoast / Rank Math fields filled automatically), BlogPosting + FAQPage JSON-LD.
* **Scheduling** - every day, every 2 days, every 3 days or once a week at the hour you choose. Or click "Generate a post now".
* **Business profile** - describe your business, audience, priority keywords, brand voice and social links; every article is written around them.
* **Social sharing** - after publishing, share the post with its featured image and platform-specific captions (written by Manus in the same task):
  * Connect Facebook Page, Instagram Business, Pinterest and LinkedIn (one click through LinkAuthority, or your own developer apps) and the plugin posts itself.
  * A "Social Posts" page lists every article with links to each social post; any post can be shared or retried from its edit screen.

== Third-party services ==

This plugin is a client for external services. Nothing works without them, and each one has its own account, terms and pricing.

* **Manus AI** (https://manus.im) - researches and writes each article and generates the featured image. Requires your own Manus API key, entered in the plugin. Each post consumes Manus credits, which Manus bills you for directly. The plugin sends Manus your business profile, the topic, and your site's existing post titles so it can avoid repeats. Terms: https://manus.im/terms - Privacy: https://manus.im/privacy
* **Pexels** (https://www.pexels.com) - supplies copyright-free photos and video inside articles. Requires your own free Pexels API key. The plugin sends Pexels search terms derived from the article. Terms: https://www.pexels.com/terms-of-service/ - Privacy: https://www.pexels.com/privacy-policy/
* **LinkAuthority Connect** (https://www.linkauthority.live) - optional. Lets you connect Facebook, Instagram, Pinterest and LinkedIn with one click instead of registering developer apps of your own. During sign-in your browser is sent to linkauthority.live, which brokers the authorisation with the network and hands the resulting token to your site. LinkAuthority stores nothing after the hand-off. You can skip this entirely by using your own developer apps under "Advanced" on each network's card. Terms: https://www.linkauthority.live/terms-of-service - Privacy: https://www.linkauthority.live/privacy-policy
* **Facebook, Instagram, Pinterest, LinkedIn** - when you connect an account, the plugin posts to it on your behalf using the token you authorised, and Instagram and Pinterest fetch the featured image from your site. Each network's own terms apply to what is posted.

No data is sent anywhere unless you have entered the corresponding key or connected the corresponding account.

== Setup ==

1. Upload the `linkauthority-publisher` folder to `/wp-content/plugins/` and activate it.
2. Go to **Publisher** in the admin menu.
3. **API Keys** tab: paste your Manus API key (manus.im > Settings > API) and your Pexels API key (pexels.com/api). Use *Test connection* for each.
4. **Business Profile** tab: describe your business, audience, keywords and social links. This is what Manus uses to choose and write topics.
5. **Schedule & Publishing** tab: enable automation, choose frequency, start hour, post status (publish or draft for review), author and category.
6. **Media & Style** tab: choose brand colours and media options.
7. Save. Click **Generate a post now** to create your first article immediately.

== How it works ==

Manus tasks are asynchronous. The plugin creates a task, then polls Manus roughly every minute through WP-Cron until the article (structured JSON) is ready, creates a second task for the featured image, downloads it into the Media Library, fetches Pexels media for each section, assembles the styled HTML (as a Custom HTML block) and publishes the post. A full run usually takes 10-30 minutes depending on the agent profile.

Cost: each post consumes Manus credits (article task + image task). The "Lite" profile is cheapest; "Max" researches deepest.

== WP-Cron ==

Scheduling relies on WP-Cron, which only runs when your site gets traffic. For reliable timing on low-traffic sites add a real cron job that requests `https://your-site.com/wp-cron.php?doing_wp_cron` every minute and set `define( 'DISABLE_WP_CRON', true );` in wp-config.php.

== Social sharing setup ==

Connect each network with one click through LinkAuthority Connect, or use your own developer app. The settings page shows the redirect URL to paste into the app and step-by-step instructions:
* Meta (Facebook + Instagram): developers.facebook.com - Business app with Facebook Login for Business.
* Pinterest: developers.pinterest.com - app with Trial/standard access.
* LinkedIn: linkedin.com/developers - "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect" (Community Management API for Company Pages).
Instagram and Pinterest download the featured image from your site, so the site must be publicly reachable over HTTPS.

== Hooks ==

* `do_action( 'lapub_post_generated', $post_id, $job )` - fired after a post is created.

== Changelog ==

= 1.2.0 =
* Removed the Make.com webhook option. Sharing goes through the connected networks directly; there is one way to set it up now instead of two. If you had a webhook URL saved it is simply no longer used.

= 1.1.1 =
* After connecting a social account the settings page now reloads itself and shows a "connected" notice. Previously the connection succeeded but the page kept saying "Not connected" until you refreshed by hand.

= 1.1.0 =
* Renamed to LinkAuthority Publisher. All option names, hooks and CSS classes carry the new prefix, so settings from the earlier "Manus Auto Blogger" build are not carried over - re-enter your keys after upgrading.
* Menu entry is now "Publisher".
* Added the Third-party services section.

= 1.0.1 =
* Connect buttons no longer require a licence key before opening the sign-in popup. The connect server decides whether a key is needed and says so; the plugin's own check closed the popup silently on every site that had left the field blank.

= 1.0.0 =
* Initial release.
