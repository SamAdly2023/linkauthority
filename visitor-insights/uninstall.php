<?php
/**
 * Fires only when the plugin is explicitly deleted from the Plugins screen
 * (not on a plain deactivate) - WordPress requires this exact filename and
 * loads it directly, so ABSPATH won't be defined; WP_UNINSTALL_PLUGIN is
 * the correct guard here instead.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

$tables = array(
	$wpdb->prefix . 'vi_sessions',
	$wpdb->prefix . 'vi_pageviews',
	$wpdb->prefix . 'vi_enrichment',
);

foreach ( $tables as $table ) {
	$wpdb->query( "DROP TABLE IF EXISTS {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- table name is a fixed prefix + hardcoded suffix, no user input.
}

$options = array(
	'visitor_insights_db_version',
	'visitor_insights_retention_days',
	'visitor_insights_track_logged_in_admins',
	'visitor_insights_geo_lookup_enabled',
	'visitor_insights_skip_trace_enabled',
	'visitor_insights_skip_trace_consent_ack',
	'visitor_insights_apify_token',
	'visitor_insights_excluded_paths',
	'visitor_insights_linkauthority_token',
	'visitor_insights_linkauthority_last_report',
);

foreach ( $options as $option ) {
	delete_option( $option );
}

foreach ( array( 'visitor_insights_daily_retention_cleanup', 'visitor_insights_linkauthority_report' ) as $visitor_insights_hook ) {
	$visitor_insights_ts = wp_next_scheduled( $visitor_insights_hook );
	if ( $visitor_insights_ts ) {
		wp_unschedule_event( $visitor_insights_ts, $visitor_insights_hook );
	}
}
