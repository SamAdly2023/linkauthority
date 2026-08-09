const axios = require('axios');
const AdmZip = require('adm-zip');
const requireLogin = require('../middlewares/requireLogin');
const { db } = require('../services/firebase');

// Firestore helpers (kept local, matching the pattern used by the other route files)
const getWebsiteById = async (id) => {
  const doc = await db.collection('websites').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, _id: doc.id, ...doc.data() };
};

const getWebsiteByToken = async (token) => {
  const snap = await db.collection('websites').where('verificationToken', '==', token).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, _id: snap.docs[0].id, ...snap.docs[0].data() };
};

const hostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }
};

// Best-effort push: ask every other currently-active site's plugin to refresh its
// cached partner directory immediately, instead of waiting for its own cron tick.
const broadcastRefresh = async (excludeWebsiteId) => {
  const snap = await db.collection('websites').where('isActive', '==', true).get();
  const targets = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(site => site.id !== excludeWebsiteId && site.url && site.verificationToken);

  await Promise.allSettled(targets.map(site => {
    const restUrl = `${site.url.replace(/\/$/, '')}/wp-json/linkauthority/v1/update`;
    return axios.post(restUrl, { token: site.verificationToken }, { timeout: 5000 });
  }));
};

const notifyOwner = async (website, message) => {
  if (!website.ownerId) return;
  try {
    await db.collection('notifications').doc().set({
      recipientId: website.ownerId,
      message,
      read: false,
      createdAt: new Date(),
      type: 'info'
    });
  } catch (err) {
    console.error('Failed to write owner notification:', err);
  }
};

module.exports = app => {
  // Called by the WordPress plugin on activation. Marks the site active + listed.
  app.post('/api/integration/connect', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).send({ error: 'Token is required' });

    try {
      const website = await getWebsiteByToken(token);
      if (!website) return res.status(404).send({ error: 'Invalid token' });

      const now = new Date();
      const updates = {
        isActive: true,
        isVerified: true,
        verificationMethod: 'plugin',
        verificationDate: website.verificationDate || now,
        pluginConnectedAt: website.pluginConnectedAt || now,
        pluginLastPing: now
      };
      await db.collection('websites').doc(website.id).update(updates);

      notifyOwner(website, `${website.url} is now connected and listed as an active partner on LinkAuthority.`).catch(() => {});

      res.send({ success: true, website: { id: website.id, url: website.url, ...updates } });

      // Fire-and-forget: let every other active site know the network membership changed.
      broadcastRefresh(website.id).catch(err => console.error('broadcastRefresh (connect) failed:', err.message));
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to connect site' });
    }
  });

  // Called by the WordPress plugin on deactivation/uninstall. Marks the site inactive.
  app.post('/api/integration/disconnect', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).send({ error: 'Token is required' });

    try {
      const website = await getWebsiteByToken(token);
      if (!website) return res.status(404).send({ error: 'Invalid token' });

      const now = new Date();
      await db.collection('websites').doc(website.id).update({
        isActive: false,
        pluginLastPing: now
      });

      notifyOwner(website, `${website.url} was disconnected from LinkAuthority. It is no longer listed as an active partner.`).catch(() => {});

      res.send({ success: true });

      broadcastRefresh(website.id).catch(err => console.error('broadcastRefresh (disconnect) failed:', err.message));
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to disconnect site' });
    }
  });

  // Public directory endpoint the plugin polls (and the app can push-trigger) for the
  // "Business Partners" page: every currently active site on the platform, excluding the caller.
  app.get('/api/integration/partners', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send({ error: 'Token is required' });

    try {
      const requester = await getWebsiteByToken(token);
      if (!requester) return res.status(404).send({ error: 'Invalid token' });

      const snap = await db.collection('websites').where('isActive', '==', true).get();
      const partners = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(site => site.id !== requester.id && site.url)
        .sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0))
        .map(site => ({
          title: site.name || hostname(site.url),
          description: site.description || 'Verified LinkAuthority partner site.',
          url: site.url
        }));

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(partners);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to retrieve partners' });
    }
  });

  // Generates the installable WordPress plugin .zip for a given website (owner-only).
  app.get('/api/wp/generate-plugin/:websiteId', requireLogin, async (req, res) => {
    try {
      const website = await getWebsiteById(req.params.websiteId);
      if (!website || website.ownerId !== req.user.id) {
        return res.status(404).send({ error: 'Website not found' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const phpCode = `<?php
/**
 * Plugin Name: LinkAuthority Business Partners
 * Description: Connects this site to the LinkAuthority network and keeps a live "Business Partners" page of dofollow links to currently active partner sites.
 * Version: 2.0
 * Author: LinkAuthority
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'LINKAUTHORITY_TOKEN', '${website.verificationToken}' );
define( 'LINKAUTHORITY_API_BASE', '${baseUrl}/api/integration' );

function linkauthority_refresh_partners() {
    $response = wp_remote_get( LINKAUTHORITY_API_BASE . '/partners?token=' . LINKAUTHORITY_TOKEN, array( 'timeout' => 10 ) );
    if ( is_wp_error( $response ) ) {
        return false;
    }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( is_array( $data ) ) {
        update_option( 'linkauthority_partners', $data );
        update_option( 'linkauthority_last_sync', time() );
        return true;
    }
    return false;
}

register_activation_hook( __FILE__, 'linkauthority_activate' );
function linkauthority_activate() {
    // Cache the token in an option so uninstall.php (which runs without this file loaded) can read it.
    update_option( 'linkauthority_token_cache', LINKAUTHORITY_TOKEN );

    wp_remote_post( LINKAUTHORITY_API_BASE . '/connect', array(
        'timeout' => 10,
        'body'    => array( 'token' => LINKAUTHORITY_TOKEN ),
    ) );

    linkauthority_refresh_partners();

    if ( null === get_page_by_path( 'business-partners' ) ) {
        wp_insert_post( array(
            'post_title'   => 'Business Partners',
            'post_name'    => 'business-partners',
            'post_content' => '[linkauthority_partners]',
            'post_status'  => 'publish',
            'post_type'    => 'page',
        ) );
    }

    if ( ! wp_next_scheduled( 'linkauthority_cron_refresh' ) ) {
        wp_schedule_event( time(), 'hourly', 'linkauthority_cron_refresh' );
    }
}

register_deactivation_hook( __FILE__, 'linkauthority_deactivate' );
function linkauthority_deactivate() {
    wp_remote_post( LINKAUTHORITY_API_BASE . '/disconnect', array(
        'timeout' => 10,
        'body'    => array( 'token' => LINKAUTHORITY_TOKEN ),
    ) );
    wp_clear_scheduled_hook( 'linkauthority_cron_refresh' );
}

add_action( 'linkauthority_cron_refresh', 'linkauthority_refresh_partners' );

add_shortcode( 'linkauthority_partners', 'linkauthority_render_partners' );
function linkauthority_render_partners() {
    $partners = get_option( 'linkauthority_partners', array() );
    if ( empty( $partners ) ) {
        return '<p>No active partners listed yet.</p>';
    }

    $html = '<div class="linkauthority-partners-silo" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0;">';
    foreach ( $partners as $partner ) {
        $html .= '<div class="partner-card" style="border:1px solid #ddd; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05); font-family:sans-serif; background:#fff;">';
        $html .= '<h3 style="margin-top:0; color:#333;">' . esc_html( $partner['title'] ) . '</h3>';
        $html .= '<p style="color:#666; font-size:14px; line-height:1.5;">' . esc_html( $partner['description'] ) . '</p>';
        $html .= '<a href="' . esc_url( $partner['url'] ) . '" rel="dofollow" target="_blank" style="display:inline-block; background:#0073aa; color:#fff; padding:8px 16px; text-decoration:none; border-radius:4px; font-weight:bold; font-size:14px;">Visit Website</a>';
        $html .= '</div>';
    }
    $html .= '</div>';
    return $html;
}

// LinkAuthority calls this to push an immediate refresh whenever the active-site set changes.
add_action( 'rest_api_init', function () {
    register_rest_route( 'linkauthority/v1', '/update', array(
        'methods'             => 'POST',
        'callback'            => 'linkauthority_rest_update',
        'permission_callback' => '__return_true',
    ) );
} );
function linkauthority_rest_update( WP_REST_Request $request ) {
    $token = $request->get_param( 'token' );
    if ( $token !== LINKAUTHORITY_TOKEN ) {
        return new WP_REST_Response( array( 'error' => 'Invalid token' ), 403 );
    }
    $success = linkauthority_refresh_partners();
    return new WP_REST_Response( array( 'success' => $success ), $success ? 200 : 500 );
}
`;

      const uninstallCode = `<?php
// Runs automatically when the plugin is deleted from the Plugins screen.
// Note: the main plugin file is NOT loaded here, so we read the token back from an option
// instead of the LINKAUTHORITY_TOKEN constant.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

$token = get_option( 'linkauthority_token_cache' );
if ( $token ) {
    wp_remote_post( '${baseUrl}/api/integration/disconnect', array(
        'timeout' => 10,
        'body'    => array( 'token' => $token ),
    ) );
}

delete_option( 'linkauthority_partners' );
delete_option( 'linkauthority_last_sync' );
delete_option( 'linkauthority_token_cache' );
`;

      const zip = new AdmZip();
      zip.addFile('linkauthority-partners/linkauthority-partners.php', Buffer.from(phpCode, 'utf8'));
      zip.addFile('linkauthority-partners/uninstall.php', Buffer.from(uninstallCode, 'utf8'));
      const zipBuffer = zip.toBuffer();

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=linkauthority-partners-${website.url.replace(/https?:\/\/(www\.)?/, '').replace(/[^a-zA-Z0-9]/g, '-')}.zip`);
      res.send(zipBuffer);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to generate plugin' });
    }
  });
};
