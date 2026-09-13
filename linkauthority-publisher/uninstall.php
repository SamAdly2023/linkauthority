<?php
/**
 * Runs when the plugin is deleted from the Plugins screen.
 * Removes options and scheduled events. Generated posts and media are kept.
 */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'lapub_settings' );
delete_option( 'lapub_log' );
delete_option( 'lapub_job' );
delete_option( 'lapub_last_run' );
delete_option( 'lapub_social_accounts' );
wp_unschedule_hook( 'lapub_distribute_post' );
delete_transient( 'lapub_poll_lock' );

wp_clear_scheduled_hook( 'lapub_generate_post' );
wp_clear_scheduled_hook( 'lapub_poll_job' );
