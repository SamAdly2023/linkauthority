<?php
/**
 * Runs when the plugin is deleted from the Plugins screen.
 * Removes options and scheduled events. Generated posts and media are kept.
 */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'mab_settings' );
delete_option( 'mab_log' );
delete_option( 'mab_job' );
delete_option( 'mab_last_run' );
delete_option( 'mab_social_accounts' );
wp_unschedule_hook( 'mab_distribute_post' );
delete_transient( 'mab_poll_lock' );

wp_clear_scheduled_hook( 'mab_generate_post' );
wp_clear_scheduled_hook( 'mab_poll_job' );
