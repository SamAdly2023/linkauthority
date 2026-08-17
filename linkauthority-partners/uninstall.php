<?php
/**
 * Removes everything the plugin stored. Runs only on "Delete", never on
 * deactivation.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$linkauthority_partners_options = array(
	'linkauthority_partners_settings',
	'linkauthority_partners_partners',
	'linkauthority_partners_last_sync',
	'linkauthority_partners_page_views',
	'linkauthority_partners_status',
);

foreach ( $linkauthority_partners_options as $linkauthority_partners_option ) {
	delete_option( $linkauthority_partners_option );
}

wp_clear_scheduled_hook( 'linkauthority_partners_cron_refresh' );

// The Business Partners page is the site's own content and is left in place.
