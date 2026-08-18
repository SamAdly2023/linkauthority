<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Runs on plugin deactivation. Tables/options are intentionally left in
 * place here - only uninstall.php (explicit "Delete" from the Plugins
 * screen) removes data, so deactivating for a quick test doesn't lose
 * anything.
 */
class Visitor_Insights_Deactivator {

	public static function deactivate() {
		foreach ( array( 'visitor_insights_daily_retention_cleanup', Visitor_Insights_LinkAuthority::CRON_HOOK ) as $hook ) {
			$timestamp = wp_next_scheduled( $hook );
			if ( $timestamp ) {
				wp_unschedule_event( $timestamp, $hook );
			}
		}
	}
}
