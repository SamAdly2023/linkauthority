<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Every call to the LinkAuthority service lives here. Nothing is sent until the
 * site owner has saved a token, which is the plugin's opt-in to using the
 * service at all.
 */
class LinkAuthority_Partners_API {

	/**
	 * Base URL of the LinkAuthority API, without a trailing slash.
	 *
	 * @return string
	 */
	public static function base_url() {
		/**
		 * Filters the LinkAuthority API base URL.
		 *
		 * @param string $base_url Default https://www.linkauthority.live
		 */
		$base = apply_filters( 'linkauthority_partners_api_base_url', LINKAUTHORITY_PARTNERS_API_BASE );

		return untrailingslashit( $base ) . '/api/integration';
	}

	/**
	 * Tells LinkAuthority this site is live, so it starts appearing in other
	 * members' directories.
	 *
	 * @param string $token Site token.
	 * @return bool
	 */
	public static function connect( $token ) {
		if ( '' === $token ) {
			return false;
		}

		$response = wp_remote_post(
			self::base_url() . '/connect',
			array(
				'timeout' => 10,
				'body'    => array( 'token' => $token ),
			)
		);

		return self::is_ok( $response );
	}

	/**
	 * Removes this site from other members' directories.
	 *
	 * @param string $token Site token.
	 * @return bool
	 */
	public static function disconnect( $token ) {
		if ( '' === $token ) {
			return false;
		}

		$response = wp_remote_post(
			self::base_url() . '/disconnect',
			array(
				'timeout' => 10,
				'body'    => array( 'token' => $token ),
			)
		);

		return self::is_ok( $response );
	}

	/**
	 * Connection and account details for the admin screen.
	 *
	 * @return array|false
	 */
	public static function get_status() {
		$token = linkauthority_partners_get_token();
		if ( '' === $token ) {
			return false;
		}

		$response = wp_remote_get(
			add_query_arg( 'token', rawurlencode( $token ), self::base_url() . '/status' ),
			array( 'timeout' => 10 )
		);

		$data = self::decode( $response );
		if ( is_array( $data ) ) {
			update_option( LINKAUTHORITY_PARTNERS_OPT_STATUS, $data, false );
		}

		return is_array( $data ) ? $data : false;
	}

	/**
	 * Pulls the partner directory and caches it.
	 *
	 * The result is stored, not written into any post: the page renders from
	 * this cache at output time, so the site owner's own content is never
	 * rewritten by the plugin.
	 *
	 * @return bool True when a fresh list was stored.
	 */
	public static function refresh_partners() {
		$token = linkauthority_partners_get_token();
		if ( '' === $token ) {
			return false;
		}

		$args = array( 'token' => rawurlencode( $token ) );

		// Page-view reporting is opt-in; without it nothing about this site's
		// traffic leaves the server.
		$settings = linkauthority_partners_get_settings();
		if ( ! empty( $settings['report_views'] ) ) {
			$args['views'] = (int) get_option( LINKAUTHORITY_PARTNERS_OPT_PAGE_VIEWS, 0 );
		}

		$response = wp_remote_get(
			add_query_arg( $args, self::base_url() . '/partners' ),
			array( 'timeout' => 10 )
		);

		$data = self::decode( $response );
		if ( ! is_array( $data ) ) {
			return false;
		}

		update_option( LINKAUTHORITY_PARTNERS_OPT_PARTNERS, self::sanitize_partners( $data ), false );
		update_option( LINKAUTHORITY_PARTNERS_OPT_LAST_SYNC, time(), false );

		return true;
	}

	/**
	 * Normalises the API payload down to the four fields the cards use, so
	 * nothing unexpected from the response ever reaches the renderer.
	 *
	 * @param array $partners Raw decoded response.
	 * @return array
	 */
	private static function sanitize_partners( $partners ) {
		$clean = array();

		foreach ( $partners as $partner ) {
			if ( ! is_array( $partner ) || empty( $partner['url'] ) ) {
				continue;
			}

			$clean[] = array(
				'title'       => sanitize_text_field( (string) ( $partner['title'] ?? '' ) ),
				'description' => sanitize_text_field( (string) ( $partner['description'] ?? '' ) ),
				'logo'        => esc_url_raw( (string) ( $partner['logo'] ?? '' ) ),
				'url'         => esc_url_raw( (string) $partner['url'] ),
			);
		}

		return $clean;
	}

	/**
	 * @param array|WP_Error $response
	 * @return bool
	 */
	private static function is_ok( $response ) {
		if ( is_wp_error( $response ) ) {
			return false;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );

		return $code >= 200 && $code < 300;
	}

	/**
	 * @param array|WP_Error $response
	 * @return mixed|null
	 */
	private static function decode( $response ) {
		if ( ! self::is_ok( $response ) ) {
			return null;
		}

		return json_decode( wp_remote_retrieve_body( $response ), true );
	}
}
