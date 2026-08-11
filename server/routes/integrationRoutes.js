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
    const { token, views } = req.query;
    if (!token) return res.status(400).send({ error: 'Token is required' });

    try {
      const requester = await getWebsiteByToken(token);
      if (!requester) return res.status(404).send({ error: 'Invalid token' });

      // The plugin reports its cumulative Business Partners page view count on every
      // sync (hourly cron, activation, manual refresh) by piggybacking it onto this
      // existing request rather than adding a separate network call.
      if (views !== undefined) {
        const parsedViews = parseInt(views, 10);
        if (!isNaN(parsedViews)) {
          await db.collection('websites').doc(requester.id).update({
            pageViews: parsedViews,
            pageViewsLastSync: new Date()
          });
        }
      }

      // NOTE: for now this shows every other active site regardless of owner, by
      // request, to make the network easier to validate end-to-end. Ownership-based
      // restrictions (e.g. excluding a user's own other sites) can be reintroduced
      // once the core flow is confirmed working.
      const snap = await db.collection('websites').where('isActive', '==', true).get();
      const partners = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(site => site.id !== requester.id && site.url)
        .sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0))
        .map(site => ({
          title: site.name || hostname(site.url),
          description: site.description || 'A trusted business we recommend.',
          logo: site.logo || null,
          url: site.url
        }));

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(partners);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to retrieve partners' });
    }
  });

  // Live account/connection stats for the WordPress plugin's admin dashboard page.
  app.get('/api/integration/status', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send({ error: 'Token is required' });

    try {
      const site = await getWebsiteByToken(token);
      if (!site) return res.status(404).send({ error: 'Invalid token' });

      const activeSnap = await db.collection('websites').where('isActive', '==', true).get();
      const activePartnerCount = activeSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(s => s.ownerId !== site.ownerId).length;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send({
        url: site.url,
        isActive: !!site.isActive,
        isVerified: !!site.isVerified,
        domainAuthority: site.domainAuthority || 0,
        category: site.category || null,
        activePartnerCount,
        pluginConnectedAt: site.pluginConnectedAt || null,
        pluginLastPing: site.pluginLastPing || null
      });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to retrieve status' });
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
 * Description: Connects this site to the LinkAuthority network, syncs a live "Business Partners" page of dofollow links, and gives you an admin dashboard with connection status and stats.
 * Version: 4.0
 * Author: LinkAuthority
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'LINKAUTHORITY_TOKEN', '${website.verificationToken}' );
define( 'LINKAUTHORITY_API_BASE', '${baseUrl}/api/integration' );
define( 'LINKAUTHORITY_APP_URL', '${baseUrl}' );
define( 'LINKAUTHORITY_META_DESCRIPTION', 'Businesses we recommend and support. Check out what they do and visit their websites.' );

function linkauthority_refresh_partners() {
    $views = (int) get_option( 'linkauthority_page_views', 0 );
    $url = LINKAUTHORITY_API_BASE . '/partners?token=' . LINKAUTHORITY_TOKEN . '&views=' . $views;
    $response = wp_remote_get( $url, array( 'timeout' => 10 ) );
    if ( is_wp_error( $response ) ) {
        return false;
    }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( is_array( $data ) ) {
        update_option( 'linkauthority_partners', $data );
        update_option( 'linkauthority_last_sync', time() );
        linkauthority_sync_page_content();
        return true;
    }
    return false;
}

// Counts real front-end visits to the Business Partners page (skips admin/editor
// views) and reports the running total back to LinkAuthority on the next sync.
add_action( 'template_redirect', 'linkauthority_track_pageview' );
function linkauthority_track_pageview() {
    if ( is_admin() || ! is_page( 'business-partners' ) ) {
        return;
    }
    $views = (int) get_option( 'linkauthority_page_views', 0 );
    update_option( 'linkauthority_page_views', $views + 1 );
}

// Some themes/page builders render post_content directly without ever running it
// through the_content (which is what actually executes shortcodes). To work
// reliably everywhere, write the rendered HTML straight into the page too instead
// of relying solely on the [linkauthority_partners] shortcode being processed.
function linkauthority_sync_page_content() {
    $page = get_page_by_path( 'business-partners' );
    if ( ! $page ) {
        return;
    }
    wp_update_post( array(
        'ID'           => $page->ID,
        'post_content' => linkauthority_render_partners(),
        'post_excerpt' => LINKAUTHORITY_META_DESCRIPTION,
    ) );
}

// SEO: structured data + Open Graph/Twitter tags for the Business Partners page.
add_action( 'wp_head', 'linkauthority_seo_head' );
function linkauthority_seo_head() {
    if ( ! is_page( 'business-partners' ) ) {
        return;
    }

    $page_title = get_the_title();
    $page_url = get_permalink();

    echo "\n<!-- LinkAuthority SEO -->\n";
    echo '<meta property="og:type" content="website">' . "\n";
    echo '<meta property="og:title" content="' . esc_attr( $page_title ) . '">' . "\n";
    echo '<meta property="og:description" content="' . esc_attr( LINKAUTHORITY_META_DESCRIPTION ) . '">' . "\n";
    echo '<meta property="og:url" content="' . esc_url( $page_url ) . '">' . "\n";
    echo '<meta name="twitter:card" content="summary">' . "\n";
    echo '<meta name="twitter:title" content="' . esc_attr( $page_title ) . '">' . "\n";
    echo '<meta name="twitter:description" content="' . esc_attr( LINKAUTHORITY_META_DESCRIPTION ) . '">' . "\n";

    $partners = get_option( 'linkauthority_partners', array() );
    if ( ! empty( $partners ) ) {
        $items = array();
        $position = 1;
        foreach ( $partners as $partner ) {
            if ( empty( $partner['title'] ) || empty( $partner['url'] ) ) {
                continue;
            }
            $org = array(
                '@type' => 'Organization',
                'name'  => $partner['title'],
                'url'   => $partner['url'],
            );
            if ( ! empty( $partner['logo'] ) ) {
                $org['logo'] = $partner['logo'];
            }
            if ( ! empty( $partner['description'] ) ) {
                $org['description'] = $partner['description'];
            }
            $items[] = array(
                '@type'    => 'ListItem',
                'position' => $position,
                'item'     => $org,
            );
            $position++;
        }
        if ( ! empty( $items ) ) {
            $schema = array(
                '@context'        => 'https://schema.org',
                '@type'           => 'ItemList',
                'name'            => $page_title,
                'itemListElement' => $items,
            );
            echo '<script type="application/ld+json">' . wp_json_encode( $schema ) . '</script>' . "\n";
        }
    }
}

function linkauthority_connect() {
    return wp_remote_post( LINKAUTHORITY_API_BASE . '/connect', array(
        'timeout' => 10,
        'body'    => array( 'token' => LINKAUTHORITY_TOKEN ),
    ) );
}

function linkauthority_get_status() {
    $response = wp_remote_get( LINKAUTHORITY_API_BASE . '/status?token=' . LINKAUTHORITY_TOKEN, array( 'timeout' => 10 ) );
    if ( is_wp_error( $response ) ) {
        return false;
    }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    return is_array( $data ) ? $data : false;
}

register_activation_hook( __FILE__, 'linkauthority_activate' );
function linkauthority_activate() {
    // Fast, local operations first: if a slow host makes the network calls below
    // time out, the page and cron schedule are already in place regardless.
    update_option( 'linkauthority_token_cache', LINKAUTHORITY_TOKEN );

    if ( null === get_page_by_path( 'business-partners' ) ) {
        wp_insert_post( array(
            'post_title'   => 'Business Partners',
            'post_name'    => 'business-partners',
            'post_content' => '[linkauthority_partners]',
            'post_excerpt' => LINKAUTHORITY_META_DESCRIPTION,
            'post_status'  => 'publish',
            'post_type'    => 'page',
        ) );
    }

    if ( ! wp_next_scheduled( 'linkauthority_cron_refresh' ) ) {
        wp_schedule_event( time(), 'hourly', 'linkauthority_cron_refresh' );
    }

    linkauthority_connect();
    linkauthority_refresh_partners();
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

    $html = '<div class="linkauthority-partners-silo">';
    $html .= '<style>
        .linkauthority-partners-silo{--la-blue:#2563eb;--la-blue-dark:#1d4ed8;--la-ink:#0f172a;--la-sub:#64748b;--la-border:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
        .linkauthority-partners-silo .la-intro{margin:0 0 1.5rem;font-size:.95rem;line-height:1.6;color:var(--la-sub);max-width:640px;}
        .linkauthority-partners-silo .la-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;margin:0;}
        .linkauthority-partners-silo .la-card{position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:1.5rem;border-radius:16px;border:1px solid var(--la-border);background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;}
        .linkauthority-partners-silo .la-card:hover{transform:translateY(-3px);box-shadow:0 12px 24px -8px rgba(37,99,235,.18);border-color:#c7d7fe;}
        .linkauthority-partners-silo .la-card-head{display:flex;align-items:center;gap:.75rem;margin-bottom:.85rem;}
        .linkauthority-partners-silo .la-logo{width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid var(--la-border);flex-shrink:0;background:#f8fafc;}
        .linkauthority-partners-silo .la-logo-fallback{width:44px;height:44px;border-radius:10px;flex-shrink:0;background:var(--la-blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;}
        .linkauthority-partners-silo .la-card h3{margin:0;font-size:1.05rem;font-weight:700;color:var(--la-ink);line-height:1.3;}
        .linkauthority-partners-silo .la-card p{margin:0 0 1.25rem;font-size:.875rem;line-height:1.55;color:var(--la-sub);}
        .linkauthority-partners-silo .la-btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;background:var(--la-blue);color:#fff !important;padding:.6rem 1rem;border-radius:10px;text-decoration:none !important;font-weight:600;font-size:.85rem;transition:background .15s ease;align-self:flex-start;}
        .linkauthority-partners-silo .la-btn:hover{background:var(--la-blue-dark);}
        .linkauthority-partners-silo .la-empty{padding:2rem;text-align:center;border:1px dashed var(--la-border);border-radius:16px;color:var(--la-sub);font-size:.9rem;}
        .linkauthority-partners-silo .la-footer{margin-top:1.25rem;text-align:right;font-size:.75rem;color:#94a3b8;}
        .linkauthority-partners-silo .la-footer a{color:var(--la-blue);text-decoration:none;font-weight:600;}
        @media (max-width:480px){.linkauthority-partners-silo .la-grid{grid-template-columns:1fr;}}
    </style>';

    $html .= '<p class="la-intro">We are proud to support the following businesses. Take a moment to check out what they do.</p>';

    if ( empty( $partners ) ) {
        $html .= '<div class="la-empty">No businesses listed yet. Check back soon.</div>';
    } else {
        $html .= '<div class="la-grid">';
        foreach ( $partners as $partner ) {
            $title = esc_html( $partner['title'] );
            $html .= '<div class="la-card">';
            $html .= '<div>';
            $html .= '<div class="la-card-head">';
            if ( ! empty( $partner['logo'] ) ) {
                $html .= '<img class="la-logo" src="' . esc_url( $partner['logo'] ) . '" alt="' . esc_attr( $partner['title'] ) . ' logo" loading="lazy" width="44" height="44">';
            } else {
                $html .= '<span class="la-logo-fallback" aria-hidden="true">' . esc_html( mb_substr( $partner['title'], 0, 1 ) ) . '</span>';
            }
            $html .= '<h3>' . $title . '</h3>';
            $html .= '</div>';
            $html .= '<p>' . esc_html( $partner['description'] ) . '</p>';
            $html .= '</div>';
            $html .= '<a class="la-btn" href="' . esc_url( $partner['url'] ) . '" target="_blank" rel="noopener">Visit ' . $title . ' &rarr;</a>';
            $html .= '</div>';
        }
        $html .= '</div>';
    }

    $html .= '<div class="la-footer">Site by <a href="' . esc_url( LINKAUTHORITY_APP_URL ) . '" target="_blank" rel="noopener">LinkAuthority</a></div>';
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

/* ------------------------------------------------------------------------
 * Admin Dashboard
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', function () {
    add_menu_page(
        'LinkAuthority',
        'LinkAuthority',
        'manage_options',
        'linkauthority',
        'linkauthority_render_dashboard',
        'dashicons-admin-links',
        58
    );
} );

add_action( 'admin_post_linkauthority_refresh', function () {
    check_admin_referer( 'linkauthority_refresh_action' );
    linkauthority_connect();
    linkauthority_refresh_partners();
    wp_safe_redirect( add_query_arg( 'la_refreshed', '1', admin_url( 'admin.php?page=linkauthority' ) ) );
    exit;
} );

function linkauthority_render_dashboard() {
    $status = linkauthority_get_status();
    $partners_page = get_page_by_path( 'business-partners' );
    $page_url = $partners_page ? get_permalink( $partners_page ) : home_url( '/business-partners/' );
    $refresh_url = wp_nonce_url( admin_url( 'admin-post.php?action=linkauthority_refresh' ), 'linkauthority_refresh_action' );
    $connected = $status && $status['isActive'];
    ?>
    <div class="wrap la-dash">
        <style>
            .la-dash{--la-blue:#2563eb;--la-blue-dark:#1d4ed8;--la-ink:#0f172a;--la-sub:#64748b;--la-border:#e5e7eb;--la-bg:#f8fafc;max-width:1000px;}
            .la-dash .la-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;background:linear-gradient(135deg,#1d4ed8,#4338ca);border-radius:20px;padding:2rem;color:#fff;margin:1.25rem 0;}
            .la-dash .la-header h1{margin:0 0 .35rem;font-size:1.6rem;color:#fff;font-weight:800;}
            .la-dash .la-header p{margin:0;color:#dbeafe;font-size:.9rem;max-width:520px;}
            .la-dash .la-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem 1rem;border-radius:999px;font-weight:700;font-size:.8rem;white-space:nowrap;}
            .la-dash .la-pill.on{background:rgba(34,197,94,.18);color:#bbf7d0;}
            .la-dash .la-pill.off{background:rgba(248,113,113,.18);color:#fecaca;}
            .la-dash .la-pill .dot{width:8px;height:8px;border-radius:50%;background:currentColor;}
            .la-dash .la-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;}
            .la-dash .la-stat{background:#fff;border:1px solid var(--la-border);border-radius:16px;padding:1.25rem 1.5rem;}
            .la-dash .la-stat .label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--la-sub);margin-bottom:.4rem;}
            .la-dash .la-stat .value{font-size:1.7rem;font-weight:800;color:var(--la-ink);}
            .la-dash .la-panel{background:#fff;border:1px solid var(--la-border);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;}
            .la-dash .la-panel h2{margin:0 0 1rem;font-size:1rem;font-weight:700;color:var(--la-ink);}
            .la-dash .la-actions{display:flex;gap:.75rem;flex-wrap:wrap;}
            .la-dash .la-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.65rem 1.25rem;border-radius:10px;font-weight:600;font-size:.85rem;text-decoration:none;border:1px solid transparent;cursor:pointer;}
            .la-dash .la-btn-primary{background:var(--la-blue);color:#fff;}
            .la-dash .la-btn-primary:hover{background:var(--la-blue-dark);color:#fff;}
            .la-dash .la-btn-secondary{background:#fff;color:var(--la-ink);border-color:var(--la-border);}
            .la-dash .la-btn-secondary:hover{background:var(--la-bg);color:var(--la-ink);}
            .la-dash .la-notice{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:.85rem 1.1rem;border-radius:12px;margin-bottom:1.25rem;font-weight:600;font-size:.85rem;}
            .la-dash .la-warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:.85rem 1.1rem;border-radius:12px;margin-bottom:1.25rem;font-size:.85rem;}
            .la-dash code{background:#f1f5f9;padding:.15rem .4rem;border-radius:6px;font-size:.85rem;}
        </style>

        <?php if ( isset( $_GET['la_refreshed'] ) ) : ?>
            <div class="la-notice">Connection refreshed. Status below reflects the latest sync.</div>
        <?php endif; ?>

        <div class="la-header">
            <div>
                <h1>LinkAuthority</h1>
                <p>Business partner network connection for this site.</p>
            </div>
            <?php if ( $connected ) : ?>
                <span class="la-pill on"><span class="dot"></span> Connected</span>
            <?php else : ?>
                <span class="la-pill off"><span class="dot"></span> Not Connected</span>
            <?php endif; ?>
        </div>

        <?php if ( ! $status ) : ?>
            <div class="la-warn">Couldn't reach LinkAuthority just now. This can happen if your host blocks outbound requests, or the connection hasn't synced yet. Click "Refresh Connection" below to retry.</div>
        <?php endif; ?>

        <div class="la-stats">
            <div class="la-stat">
                <div class="label">Domain Authority</div>
                <div class="value"><?php echo $status ? esc_html( $status['domainAuthority'] ) : '&mdash;'; ?></div>
            </div>
            <div class="la-stat">
                <div class="label">Active Partners</div>
                <div class="value"><?php echo $status ? esc_html( $status['activePartnerCount'] ) : '&mdash;'; ?></div>
            </div>
            <div class="la-stat">
                <div class="label">Page Views</div>
                <div class="value"><?php echo esc_html( (int) get_option( 'linkauthority_page_views', 0 ) ); ?></div>
            </div>
            <div class="la-stat">
                <div class="label">Verification</div>
                <div class="value" style="font-size:1.1rem;"><?php echo $status && $status['isVerified'] ? 'Verified' : 'Pending'; ?></div>
            </div>
            <div class="la-stat">
                <div class="label">Last Synced</div>
                <div class="value" style="font-size:1.1rem;">
                    <?php
                    $last_sync = get_option( 'linkauthority_last_sync' );
                    echo $last_sync ? esc_html( human_time_diff( $last_sync, time() ) . ' ago' ) : 'Never';
                    ?>
                </div>
            </div>
        </div>

        <div class="la-panel">
            <h2>Actions</h2>
            <div class="la-actions">
                <form method="post" action="<?php echo esc_url( $refresh_url ); ?>" style="display:inline;">
                    <button type="submit" class="la-btn la-btn-primary">&#8635; Refresh Connection</button>
                </form>
                <a class="la-btn la-btn-secondary" href="<?php echo esc_url( $page_url ); ?>" target="_blank">View Business Partners Page &rarr;</a>
                <a class="la-btn la-btn-secondary" href="<?php echo esc_url( LINKAUTHORITY_APP_URL ); ?>" target="_blank">Open LinkAuthority Dashboard &rarr;</a>
            </div>
        </div>

        <div class="la-panel">
            <h2>Plugin Options</h2>
            <p style="color:var(--la-sub);font-size:.85rem;margin-top:0;">
                The Business Partners page is created automatically at <code>/business-partners</code> and updates itself hourly, plus instantly whenever another site on the network connects or disconnects. To embed the partner grid anywhere else, use the shortcode:
            </p>
            <code>[linkauthority_partners]</code>
        </div>
    </div>
    <?php
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
