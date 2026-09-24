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
	 * This site's authority score and verified backlinks from the network.
	 *
	 * Everything in the response was measured or is null. The score comes from
	 * Open PageRank, and each backlink is a partner page that was actually
	 * fetched and found to carry (or not carry) a link to this site, with its
	 * rel attribute read rather than assumed. Nothing is estimated.
	 *
	 * The audit crawls every partner page, so a forced refresh is rate limited
	 * on the server; the response says when the next one is allowed.
	 *
	 * @param bool $refresh Ask the server to re-crawl now if it is allowed to.
	 * @return array|false Decoded response, or false when unreachable.
	 */
	public static function get_backlinks( $refresh = false ) {
		$token = linkauthority_partners_get_token();
		if ( '' === $token ) {
			return false;
		}

		$args = array( 'token' => rawurlencode( $token ) );
		if ( $refresh ) {
			$args['refresh'] = '1';
		}

		$response = wp_remote_get(
			add_query_arg( $args, self::base_url() . '/backlinks' ),
			// A first audit crawls the whole network before answering.
			array( 'timeout' => $refresh ? 60 : 30 )
		);

		$data = self::decode( $response );
		if ( is_array( $data ) && isset( $data['url'] ) ) {
			update_option( LINKAUTHORITY_PARTNERS_OPT_BACKLINKS, $data, false );
			return $data;
		}

		return false;
	}

	/**
	 * The whole network, for the Network screen: every active member with its
	 * public card fields, plus whether this site has hidden each one. Fetched
	 * live rather than cached - the owner is about to act on it, so it has to
	 * be current.
	 *
	 * @return array|false Decoded response, or false when unreachable.
	 */
	public static function get_network() {
		$token = linkauthority_partners_get_token();
		if ( '' === $token ) {
			return false;
		}

		$response = wp_remote_get(
			add_query_arg( array( 'token' => rawurlencode( $token ) ), self::base_url() . '/network' ),
			array( 'timeout' => 20 )
		);

		$data = self::decode( $response );

		return ( is_array( $data ) && isset( $data['members'] ) && is_array( $data['members'] ) ) ? $data : false;
	}

	/**
	 * Saves which partners this site hides and whether the page is limited to
	 * its own category. This only shapes the owner's own page; the site still
	 * appears on every partner's page as before.
	 *
	 * @param string[] $hidden_ids Member IDs to hide.
	 * @param string   $scope      'all' or 'niche'.
	 * @return bool
	 */
	public static function save_curation( $hidden_ids, $scope ) {
		$token = linkauthority_partners_get_token();
		if ( '' === $token ) {
			return false;
		}

		$response = wp_remote_post(
			self::base_url() . '/curation',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'token'          => $token,
						'hiddenPartners' => array_values( $hidden_ids ),
						'partnerScope'   => 'niche' === $scope ? 'niche' : 'all',
					)
				),
			)
		);

		return self::is_ok( $response );
	}

	/**
	 * Reports link sightings: pairs of URLs the site has seen with its own eyes.
	 *
	 * Nothing about any visitor is included, because nothing about any visitor
	 * was collected - see class-linkauthority-partners-links.php.
	 *
	 * @param array $sightings List of {sourceUrl, targetUrl, kind}.
	 * @return bool True when the service accepted them.
	 */
	public static function send_sightings( array $sightings ) {
		$token = linkauthority_partners_get_token();
		if ( '' === $token || empty( $sightings ) ) {
			return false;
		}

		$response = wp_remote_post(
			self::base_url() . '/link-sightings',
			array(
				'timeout' => 20,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'token'     => $token,
						'sightings' => array_values( $sightings ),
					)
				),
			)
		);

		return self::is_ok( $response );
	}

	/**
	 * The link report: every external link we know of, its verified state, and
	 * the paths worth protecting from a careless slug edit.
	 *
	 * Cached in an option, because the editor guard consults it on every save
	 * and must not make a network call to do so.
	 *
	 * @param bool $verify Ask the service to re-check the oldest links first.
	 * @return array|false
	 */
	public static function get_link_report( $verify = false ) {
		$token = linkauthority_partners_get_token();
		if ( '' === $token ) {
			return false;
		}

		$args = array( 'token' => rawurlencode( $token ) );
		if ( $verify ) {
			$args['verify'] = '1';
		}

		$response = wp_remote_get(
			add_query_arg( $args, self::base_url() . '/link-repair' ),
			array( 'timeout' => $verify ? 60 : 25 )
		);

		$data = self::decode( $response );
		if ( is_array( $data ) && isset( $data['summary'] ) ) {
			update_option( LINKAUTHORITY_PARTNERS_OPT_LINK_REPORT, $data, false );

			return $data;
		}

		return false;
	}

	/**
	 * Tells LinkAuthority a broken link has been dealt with, so the next
	 * verification pass confirms it rather than reporting it again.
	 *
	 * @param string      $link_id     Link id from the report.
	 * @param string|null $redirect_to Where the old address now goes.
	 * @param bool|null   $dismissed   Set instead to ignore the link entirely.
	 * @return bool
	 */
	public static function report_fix( $link_id, $redirect_to = null, $dismissed = null ) {
		$token = linkauthority_partners_get_token();
		if ( '' === $token || '' === (string) $link_id ) {
			return false;
		}

		$body = array(
			'token'  => $token,
			'linkId' => (string) $link_id,
		);

		if ( null !== $dismissed ) {
			$body['dismissed'] = (bool) $dismissed;
		} else {
			$body['redirectTo'] = (string) $redirect_to;
		}

		$response = wp_remote_post(
			self::base_url() . '/link-fixed',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
			)
		);

		return self::is_ok( $response );
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
