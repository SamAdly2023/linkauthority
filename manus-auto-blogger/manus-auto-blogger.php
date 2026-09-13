<?php
/**
 * Plugin Name:       Manus Auto Blogger
 * Plugin URI:        https://example.com/manus-auto-blogger
 * Description:       Automatically researches, writes and publishes long-form (2,500-3,000 word) SEO blog posts on a schedule using the Manus AI API, generates a featured image with Manus, and enriches every post with copyright-free Pexels photos and videos wrapped in eye-catching styling.
 * Version:           1.0.1
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Manus Auto Blogger
 * License:           GPL-2.0-or-later
 * Text Domain:       manus-auto-blogger
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MAB_VERSION', '1.0.1' );
define( 'MAB_FILE', __FILE__ );
define( 'MAB_DIR', plugin_dir_path( __FILE__ ) );
define( 'MAB_URL', plugin_dir_url( __FILE__ ) );

require_once MAB_DIR . 'includes/class-mab-options.php';
require_once MAB_DIR . 'includes/class-mab-logger.php';
require_once MAB_DIR . 'includes/class-mab-manus-client.php';
require_once MAB_DIR . 'includes/class-mab-pexels-client.php';
require_once MAB_DIR . 'includes/class-mab-prompts.php';
require_once MAB_DIR . 'includes/class-mab-post-builder.php';
require_once MAB_DIR . 'includes/class-mab-scheduler.php';
require_once MAB_DIR . 'includes/class-mab-frontend.php';
require_once MAB_DIR . 'includes/class-mab-admin.php';
require_once MAB_DIR . 'includes/class-mab-admin-social.php';
require_once MAB_DIR . 'includes/class-mab-social-accounts.php';
require_once MAB_DIR . 'includes/social/class-mab-platform-meta.php';
require_once MAB_DIR . 'includes/social/class-mab-platform-pinterest.php';
require_once MAB_DIR . 'includes/social/class-mab-platform-linkedin.php';
require_once MAB_DIR . 'includes/class-mab-oauth.php';
require_once MAB_DIR . 'includes/class-mab-distributor.php';

/**
 * Bootstrap.
 */
function mab_init() {
	MAB_Scheduler::instance();
	MAB_Frontend::instance();
	MAB_Distributor::instance();
	MAB_OAuth::instance();
	if ( is_admin() ) {
		MAB_Admin::instance();
	}
}
add_action( 'plugins_loaded', 'mab_init' );

/**
 * Custom cron intervals.
 */
function mab_cron_schedules( $schedules ) {
	$schedules['mab_every_2_days'] = array(
		'interval' => 2 * DAY_IN_SECONDS,
		'display'  => __( 'Every 2 days', 'manus-auto-blogger' ),
	);
	$schedules['mab_every_3_days'] = array(
		'interval' => 3 * DAY_IN_SECONDS,
		'display'  => __( 'Every 3 days', 'manus-auto-blogger' ),
	);
	$schedules['mab_every_minute'] = array(
		'interval' => MINUTE_IN_SECONDS,
		'display'  => __( 'Every minute (Manus job polling)', 'manus-auto-blogger' ),
	);
	return $schedules;
}
add_filter( 'cron_schedules', 'mab_cron_schedules' );

register_activation_hook( __FILE__, array( 'MAB_Scheduler', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'MAB_Scheduler', 'deactivate' ) );

/**
 * Settings link on the plugins list.
 */
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	$url = admin_url( 'admin.php?page=manus-auto-blogger' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'manus-auto-blogger' ) . '</a>' );
	return $links;
} );
