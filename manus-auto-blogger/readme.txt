=== Manus Auto Blogger ===
Contributors: manusautoblogger
Tags: ai, blog, seo, content, automation, manus, pexels
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later

Automatically researches, writes and publishes 2,500-3,000 word SEO blog posts with Manus AI, a Manus-generated featured image and copyright-free Pexels photos & videos - on a daily / 2-day / 3-day / weekly schedule.

== Description ==

Manus Auto Blogger turns your Manus AI API key into an autonomous content team:

* **Research-driven topics** - Manus browses the web for what your audience is searching for, avoids topics you already covered and picks an angle that can rank.
* **Long-form articles** - 2,500-3,000 words (configurable), 7-10 sections, key takeaways, FAQ, sourced facts, internal links to your site.
* **Featured image by Manus** - a unique, text-free hero image generated for every post (Pexels fallback).
* **Pexels photos & videos** - copyright-free media inside the article, credited automatically as the Pexels licence requires.
* **Eye-catching layout** - magazine-style styling with gradient accents in your brand colours, numbered sections, pull-stats, pro-tip callouts, an FAQ accordion and a call-to-action with your social links.
* **SEO extras** - meta description, focus keyword (Yoast / Rank Math fields filled automatically), BlogPosting + FAQPage JSON-LD.
* **Scheduling** - every day, every 2 days, every 3 days or once a week at the hour you choose. Or click "Generate a post now".
* **Business profile** - describe your business, audience, priority keywords, brand voice and social links; every article is written around them.
* **Social sharing** - after publishing, share the post with its featured image and platform-specific captions (written by Manus in the same task):
  * Option A: send a JSON payload to a Make.com webhook and let your scenario post everywhere.
  * Option B: connect Facebook Page, Instagram Business, Pinterest and LinkedIn directly (OAuth popup, pick the page/board/account) and the plugin posts itself.
  * A "Social Posts" page lists every article with links to each social post; any post can be shared or retried from its edit screen.

== Setup ==

1. Upload the `manus-auto-blogger` folder to `/wp-content/plugins/` and activate it.
2. Go to **Auto Blogger** in the admin menu.
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

Option A (Make.com): create a Custom Webhook in Make, paste its URL in Auto Blogger > Social Sharing, click "Send test payload" so Make learns the fields, then map `url`, `featured_image_url` / `featured_image_jpeg_url` and the `social.*` captions into your Facebook, Instagram, Pinterest, LinkedIn and Google Sheets modules.

Option B (direct): each network needs a developer app. The settings page shows the redirect URL to paste into the app and step-by-step instructions:
* Meta (Facebook + Instagram): developers.facebook.com - Business app with Facebook Login for Business.
* Pinterest: developers.pinterest.com - app with Trial/standard access.
* LinkedIn: linkedin.com/developers - "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect" (Community Management API for Company Pages).
Instagram and Pinterest download the featured image from your site, so the site must be publicly reachable over HTTPS.

== Hooks ==

* `do_action( 'mab_post_generated', $post_id, $job )` - fired after a post is created.

== Changelog ==

= 1.0.1 =
* Connect buttons no longer require a licence key before opening the sign-in popup. The connect server decides whether a key is needed and says so; the plugin's own check closed the popup silently on every site that had left the field blank.

= 1.0.0 =
* Initial release.
