<?php
/**
 * Plugin Name:       LinkAuthority Publisher
 * Plugin URI:        https://www.linkauthority.live/
 * Description:       Researches, writes and publishes long-form SEO blog posts on a schedule with Manus AI, generates a featured image, adds copyright-free Pexels media, and shares every post to Facebook, Instagram, Pinterest and LinkedIn.
 * Version:           1.1.1
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            LinkAuthority
 * Author URI:        https://www.linkauthority.live/
 * License:           GPL-2.0-or-later
 * Text Domain:       linkauthority-publisher
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LAPUB_VERSION', '1.1.1' );
define( 'LAPUB_FILE', __FILE__ );
define( 'LAPUB_DIR', plugin_dir_path( __FILE__ ) );
define( 'LAPUB_URL', plugin_dir_url( __FILE__ ) );

require_once LAPUB_DIR . 'includes/class-lapub-options.php';
require_once LAPUB_DIR . 'includes/class-lapub-logger.php';
require_once LAPUB_DIR . 'includes/class-lapub-manus-client.php';
require_once LAPUB_DIR . 'includes/class-lapub-pexels-client.php';
require_once LAPUB_DIR . 'includes/class-lapub-prompts.php';
require_once LAPUB_DIR . 'includes/class-lapub-post-builder.php';
require_once LAPUB_DIR . 'includes/class-lapub-scheduler.php';
require_once LAPUB_DIR . 'includes/class-lapub-frontend.php';
require_once LAPUB_DIR . 'includes/class-lapub-admin.php';
require_once LAPUB_DIR . 'includes/class-lapub-admin-social.php';
require_once LAPUB_DIR . 'includes/class-lapub-social-accounts.php';
require_once LAPUB_DIR . 'includes/social/class-lapub-platform-meta.php';
require_once LAPUB_DIR . 'includes/social/class-lapub-platform-pinterest.php';
require_once LAPUB_DIR . 'includes/social/class-lapub-platform-linkedin.php';
require_once LAPUB_DIR . 'includes/class-lapub-oauth.php';
require_once LAPUB_DIR . 'includes/class-lapub-distributor.php';

/**
 * Bootstrap.
 */
function lapub_init() {
	LAPUB_Scheduler::instance();
	LAPUB_Frontend::instance();
	LAPUB_Distributor::instance();
	LAPUB_OAuth::instance();
	if ( is_admin() ) {
		LAPUB_Admin::instance();
	}
}
add_action( 'plugins_loaded', 'lapub_init' );

/**
 * Custom cron intervals.
 */
function lapub_cron_schedules( $schedules ) {
	$schedules['lapub_every_2_days'] = array(
		'interval' => 2 * DAY_IN_SECONDS,
		'display'  => __( 'Every 2 days', 'linkauthority-publisher' ),
	);
	$schedules['lapub_every_3_days'] = array(
		'interval' => 3 * DAY_IN_SECONDS,
		'display'  => __( 'Every 3 days', 'linkauthority-publisher' ),
	);
	$schedules['lapub_every_minute'] = array(
		'interval' => MINUTE_IN_SECONDS,
		'display'  => __( 'Every minute (Manus job polling)', 'linkauthority-publisher' ),
	);
	return $schedules;
}
add_filter( 'cron_schedules', 'lapub_cron_schedules' );

register_activation_hook( __FILE__, array( 'LAPUB_Scheduler', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'LAPUB_Scheduler', 'deactivate' ) );

/**
 * Settings link on the plugins list.
 */
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	$url = admin_url( 'admin.php?page=linkauthority-publisher' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'linkauthority-publisher' ) . '</a>' );
	return $links;
} );
