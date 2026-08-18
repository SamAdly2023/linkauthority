<?php
/**
 * Plugin Name:       Visitor Insights
 * Description:       Self-contained visitor & traffic analytics for WordPress - sessions, pageviews, referrers, geo/device breakdown, CSV/PDF reports, and optional Apify-powered skip trace lookups.
 * Version:           1.2.1
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            LinkAuthority
 * Author URI:        https://www.linkauthority.live/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       visitor-insights
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'VISITOR_INSIGHTS_VERSION', '1.2.1' );
define( 'VISITOR_INSIGHTS_PLUGIN_FILE', __FILE__ );
define( 'VISITOR_INSIGHTS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'VISITOR_INSIGHTS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'VISITOR_INSIGHTS_TEXT_DOMAIN', 'visitor-insights' );

// Custom DB table base names (actual table gets $wpdb->prefix applied at use time).
define( 'VISITOR_INSIGHTS_TABLE_SESSIONS', 'vi_sessions' );
define( 'VISITOR_INSIGHTS_TABLE_PAGEVIEWS', 'vi_pageviews' );
define( 'VISITOR_INSIGHTS_TABLE_ENRICHMENT', 'vi_enrichment' );

require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-activator.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-deactivator.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-geo.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-source.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-tracker.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-skiptrace.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-pdf-writer.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-export.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-rest-controller.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-linkauthority.php';
require_once VISITOR_INSIGHTS_PLUGIN_DIR . 'includes/class-visitor-insights-admin.php';

register_activation_hook( VISITOR_INSIGHTS_PLUGIN_FILE, array( 'Visitor_Insights_Activator', 'activate' ) );
register_deactivation_hook( VISITOR_INSIGHTS_PLUGIN_FILE, array( 'Visitor_Insights_Deactivator', 'deactivate' ) );

/**
 * Bumps the DB schema forward on plugin upgrade (e.g. auto-update), not just
 * on a fresh activation - dbDelta() is idempotent so this is safe to call
 * unconditionally whenever the stored schema version is behind VISITOR_INSIGHTS_VERSION.
 */
function visitor_insights_maybe_upgrade() {
	$installed_version = get_option( 'visitor_insights_db_version', '' );
	if ( $installed_version !== VISITOR_INSIGHTS_VERSION ) {
		visitor_insights_migrate_legacy_options();
		Visitor_Insights_Activator::create_tables();
		update_option( 'visitor_insights_db_version', VISITOR_INSIGHTS_VERSION );
	}
}

/**
 * Carries settings over from the old two-letter "vi_" option names.
 *
 * The prefix was widened to avoid collisions with other plugins. Table names
 * were deliberately left alone, so tracked data is untouched by this - only the
 * settings rows move.
 */
function visitor_insights_migrate_legacy_options() {
	$map = array(
		'vi_db_version'                 => 'visitor_insights_db_version',
		'vi_retention_days'             => 'visitor_insights_retention_days',
		'vi_track_logged_in_admins'     => 'visitor_insights_track_logged_in_admins',
		'vi_geo_lookup_enabled'         => 'visitor_insights_geo_lookup_enabled',
		'vi_excluded_paths'             => 'visitor_insights_excluded_paths',
		'vi_skip_trace_enabled'         => 'visitor_insights_skip_trace_enabled',
		'vi_skip_trace_consent_ack'     => 'visitor_insights_skip_trace_consent_ack',
		'vi_apify_token'                => 'visitor_insights_apify_token',
		'vi_linkauthority_token'        => 'visitor_insights_linkauthority_token',
		'vi_linkauthority_last_report'  => 'visitor_insights_linkauthority_last_report',
	);

	foreach ( $map as $old => $new ) {
		$value = get_option( $old, null );
		if ( null === $value ) {
			continue;
		}
		if ( null === get_option( $new, null ) ) {
			update_option( $new, $value );
		}
		delete_option( $old );
	}

	// Re-point the scheduled jobs at the renamed hooks.
	$hooks = array(
		'vi_daily_retention_cleanup' => 'visitor_insights_daily_retention_cleanup',
		'vi_linkauthority_report'    => 'visitor_insights_linkauthority_report',
	);

	foreach ( $hooks as $old => $new ) {
		$timestamp = wp_next_scheduled( $old );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, $old );
			if ( ! wp_next_scheduled( $new ) ) {
				wp_schedule_event( $timestamp, 'daily', $new );
			}
		}
	}
}
add_action( 'plugins_loaded', 'visitor_insights_maybe_upgrade' );

/**
 * Load translations.
 */
function visitor_insights_load_textdomain() {
	load_plugin_textdomain( VISITOR_INSIGHTS_TEXT_DOMAIN, false, dirname( plugin_basename( VISITOR_INSIGHTS_PLUGIN_FILE ) ) . '/languages' );
}
add_action( 'plugins_loaded', 'visitor_insights_load_textdomain' );

/**
 * Wire up the pieces. Tracker + REST routes are needed on every request
 * (front-end pageviews and the REST API both fire outside /wp-admin), the
 * admin menu only needs to exist inside wp-admin.
 */
function visitor_insights_bootstrap() {
	$tracker = new Visitor_Insights_Tracker();
	$tracker->init();

	$rest_controller = new Visitor_Insights_REST_Controller();
	$rest_controller->init();

	// Registers its cron handler on every request; sends nothing unless a
	// LinkAuthority token has been entered in Settings.
	$linkauthority = new Visitor_Insights_LinkAuthority();
	$linkauthority->init();

	if ( is_admin() ) {
		$admin = new Visitor_Insights_Admin();
		$admin->init();
	}
}
add_action( 'init', 'visitor_insights_bootstrap' );
