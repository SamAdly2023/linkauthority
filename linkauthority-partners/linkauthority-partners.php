<?php
/**
 * Plugin Name:       LinkAuthority Partners
 * Description:       Publishes a Business Partners page listing the sites you exchange links with on the LinkAuthority network, kept in sync automatically.
 * Version:           1.0.9
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            LinkAuthority
 * Author URI:        https://www.linkauthority.live/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       linkauthority-partners
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'LINKAUTHORITY_PARTNERS_VERSION', '1.0.9' );
define( 'LINKAUTHORITY_PARTNERS_PLUGIN_FILE', __FILE__ );
define( 'LINKAUTHORITY_PARTNERS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'LINKAUTHORITY_PARTNERS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'LINKAUTHORITY_PARTNERS_TEXT_DOMAIN', 'linkauthority-partners' );

// Where the directory is fetched from. Filterable so a self-hosted or staging
// instance can be pointed at without editing the plugin.
if ( ! defined( 'LINKAUTHORITY_PARTNERS_API_BASE' ) ) {
	define( 'LINKAUTHORITY_PARTNERS_API_BASE', 'https://www.linkauthority.live' );
}

// Option keys.
define( 'LINKAUTHORITY_PARTNERS_OPT_SETTINGS', 'linkauthority_partners_settings' );
define( 'LINKAUTHORITY_PARTNERS_OPT_PARTNERS', 'linkauthority_partners_partners' );
define( 'LINKAUTHORITY_PARTNERS_OPT_LAST_SYNC', 'linkauthority_partners_last_sync' );
define( 'LINKAUTHORITY_PARTNERS_OPT_PAGE_VIEWS', 'linkauthority_partners_page_views' );
define( 'LINKAUTHORITY_PARTNERS_OPT_STATUS', 'linkauthority_partners_status' );

define( 'LINKAUTHORITY_PARTNERS_CRON_HOOK', 'linkauthority_partners_cron_refresh' );
define( 'LINKAUTHORITY_PARTNERS_PAGE_SLUG', 'business-partners' );

require_once LINKAUTHORITY_PARTNERS_PLUGIN_DIR . 'includes/class-linkauthority-partners-settings.php';
require_once LINKAUTHORITY_PARTNERS_PLUGIN_DIR . 'includes/class-linkauthority-partners-api.php';
require_once LINKAUTHORITY_PARTNERS_PLUGIN_DIR . 'includes/class-linkauthority-partners-renderer.php';
require_once LINKAUTHORITY_PARTNERS_PLUGIN_DIR . 'includes/class-linkauthority-partners-rest.php';
require_once LINKAUTHORITY_PARTNERS_PLUGIN_DIR . 'includes/class-linkauthority-partners-admin.php';

/**
 * Returns the plugin's settings with defaults applied.
 *
 * Both opt-ins default to off: the front-end credit link and the page-view
 * counter each send something outward or add something to the visitor's page,
 * so neither happens unless the site owner asks for it.
 *
 * @return array
 */
function linkauthority_partners_get_settings() {
	$defaults = array(
		'token'        => '',
		'show_credit'  => 0,
		'report_views' => 0,
	);

	$settings = get_option( LINKAUTHORITY_PARTNERS_OPT_SETTINGS, array() );
	if ( ! is_array( $settings ) ) {
		$settings = array();
	}

	return wp_parse_args( $settings, $defaults );
}

/**
 * The site's LinkAuthority token, or an empty string when not yet connected.
 *
 * @return string
 */
function linkauthority_partners_get_token() {
	$settings = linkauthority_partners_get_settings();

	return (string) $settings['token'];
}

add_action( 'plugins_loaded', 'linkauthority_partners_init' );
function linkauthority_partners_init() {
	( new LinkAuthority_Partners_Settings() )->init();
	( new LinkAuthority_Partners_Renderer() )->init();
	( new LinkAuthority_Partners_REST() )->init();

	if ( is_admin() ) {
		( new LinkAuthority_Partners_Admin() )->init();
	}
}

add_action( LINKAUTHORITY_PARTNERS_CRON_HOOK, 'linkauthority_partners_cron_refresh_partners' );
function linkauthority_partners_cron_refresh_partners() {
	LinkAuthority_Partners_API::refresh_partners();
}

register_activation_hook( __FILE__, 'linkauthority_partners_activate' );
function linkauthority_partners_activate() {
	if ( ! wp_next_scheduled( LINKAUTHORITY_PARTNERS_CRON_HOOK ) ) {
		wp_schedule_event( time(), 'hourly', LINKAUTHORITY_PARTNERS_CRON_HOOK );
	}

	// No page is created and no network call is made here. The site isn't
	// connected until a token is saved, and the Business Partners page is
	// created only when the owner asks for it on the settings screen.
}

register_deactivation_hook( __FILE__, 'linkauthority_partners_deactivate' );
function linkauthority_partners_deactivate() {
	wp_clear_scheduled_hook( LINKAUTHORITY_PARTNERS_CRON_HOOK );

	$token = linkauthority_partners_get_token();
	if ( '' !== $token ) {
		LinkAuthority_Partners_API::disconnect( $token );
	}
}
