<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Optional reporting of traffic totals to a LinkAuthority account.
 *
 * Off unless the site owner enters their LinkAuthority site token. Only
 * aggregates leave the site - counts, country names, referrer hostnames and
 * per-day totals. No IP addresses, no session rows, and nothing from the skip
 * trace tables beyond a count of how many sessions were identified.
 */
class Visitor_Insights_LinkAuthority {

	const CRON_HOOK  = 'visitor_insights_linkauthority_report';
	const OPT_TOKEN  = 'visitor_insights_linkauthority_token';
	const OPT_LAST   = 'visitor_insights_linkauthority_last_report';
	const DAYS       = 30;
	const TOP_LIMIT  = 10;

	public function init() {
		add_action( self::CRON_HOOK, array( $this, 'send_report' ) );

		if ( ! wp_next_scheduled( self::CRON_HOOK ) && self::is_connected() ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::CRON_HOOK );
		}
	}

	/**
	 * @return string
	 */
	public static function get_token() {
		return (string) get_option( self::OPT_TOKEN, '' );
	}

	/**
	 * @return bool
	 */
	public static function is_connected() {
		return '' !== self::get_token();
	}

	/**
	 * Base URL of the LinkAuthority API.
	 *
	 * @return string
	 */
	public static function api_base() {
		/**
		 * Filters the LinkAuthority API base URL.
		 *
		 * @param string $base_url Default https://www.linkauthority.live
		 */
		return untrailingslashit( apply_filters( 'visitor_insights_linkauthority_api_base', 'https://www.linkauthority.live' ) );
	}

	/**
	 * Builds the aggregate payload. Every value here is a count, a date, or a
	 * coarse label - nothing that identifies an individual visitor.
	 *
	 * @return array
	 */
	public static function build_payload() {
		global $wpdb;

		$sessions_table = $wpdb->prefix . VISITOR_INSIGHTS_TABLE_SESSIONS;
		$since          = gmdate( 'Y-m-d 00:00:00', time() - ( self::DAYS * DAY_IN_SECONDS ) );

		$totals = $wpdb->get_row(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is built from $wpdb->prefix.
				"SELECT COUNT(*) AS sessions,
				        COALESCE(SUM(page_count),0) AS pageviews,
				        COUNT(DISTINCT NULLIF(country,'')) AS countries,
				        SUM(CASE WHEN identified = 1 THEN 1 ELSE 0 END) AS identified,
				        SUM(CASE WHEN is_mobile = 1 THEN 1 ELSE 0 END) AS mobile
				 FROM {$sessions_table}
				 WHERE last_seen >= %s",
				$since
			),
			ARRAY_A
		);

		$by_country = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is built from $wpdb->prefix.
				"SELECT country, COUNT(*) AS sessions
				 FROM {$sessions_table}
				 WHERE last_seen >= %s AND country != ''
				 GROUP BY country
				 ORDER BY sessions DESC
				 LIMIT %d",
				$since,
				self::TOP_LIMIT
			),
			ARRAY_A
		);

		$by_day = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is built from $wpdb->prefix.
				"SELECT DATE(last_seen) AS day,
				        COUNT(*) AS sessions,
				        COALESCE(SUM(page_count),0) AS pageviews
				 FROM {$sessions_table}
				 WHERE last_seen >= %s
				 GROUP BY DATE(last_seen)
				 ORDER BY day ASC",
				$since
			),
			ARRAY_A
		);

		// Referrers are reduced to a hostname so a full URL - which can carry
		// query strings and identifiers - never leaves the site.
		$referrers = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is built from $wpdb->prefix.
				"SELECT referrer, COUNT(*) AS sessions
				 FROM {$sessions_table}
				 WHERE last_seen >= %s AND referrer != ''
				 GROUP BY referrer
				 ORDER BY sessions DESC
				 LIMIT %d",
				$since,
				self::TOP_LIMIT * 3
			),
			ARRAY_A
		);

		$by_referrer = array();
		foreach ( (array) $referrers as $row ) {
			$host = wp_parse_url( (string) $row['referrer'], PHP_URL_HOST );
			if ( ! $host ) {
				continue;
			}
			$host                 = preg_replace( '/^www\./', '', $host );
			$by_referrer[ $host ] = ( $by_referrer[ $host ] ?? 0 ) + (int) $row['sessions'];
		}
		arsort( $by_referrer );
		$by_referrer = array_slice( $by_referrer, 0, self::TOP_LIMIT, true );

		return array(
			'period_days' => self::DAYS,
			'totals'      => array(
				'sessions'   => (int) ( $totals['sessions'] ?? 0 ),
				'pageviews'  => (int) ( $totals['pageviews'] ?? 0 ),
				'countries'  => (int) ( $totals['countries'] ?? 0 ),
				'identified' => (int) ( $totals['identified'] ?? 0 ),
				'mobile'     => (int) ( $totals['mobile'] ?? 0 ),
			),
			'by_country'  => array_map(
				static function ( $row ) {
					return array(
						'country'  => (string) $row['country'],
						'sessions' => (int) $row['sessions'],
					);
				},
				(array) $by_country
			),
			'by_day'      => array_map(
				static function ( $row ) {
					return array(
						'day'       => (string) $row['day'],
						'sessions'  => (int) $row['sessions'],
						'pageviews' => (int) $row['pageviews'],
					);
				},
				(array) $by_day
			),
			'by_referrer' => array_map(
				static function ( $host, $sessions ) {
					return array(
						'host'     => $host,
						'sessions' => (int) $sessions,
					);
				},
				array_keys( $by_referrer ),
				array_values( $by_referrer )
			),
		);
	}

	/**
	 * Sends the aggregate payload. No-ops when no token is set.
	 *
	 * @return bool
	 */
	public function send_report() {
		$token = self::get_token();
		if ( '' === $token ) {
			return false;
		}

		$response = wp_remote_post(
			self::api_base() . '/api/integration/visitor-stats',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'token' => $token,
						'stats' => self::build_payload(),
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return false;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code < 200 || $code >= 300 ) {
			return false;
		}

		update_option( self::OPT_LAST, time(), false );

		return true;
	}
}
