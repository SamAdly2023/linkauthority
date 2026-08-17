<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A single route LinkAuthority calls to push an immediate directory refresh
 * when the partner set changes, instead of waiting for the hourly cron.
 */
class LinkAuthority_Partners_REST {

	const NAMESPACE_ = 'linkauthority/v1';

	public function init() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes() {
		register_rest_route(
			self::NAMESPACE_,
			'/update',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_update' ),
				'permission_callback' => array( $this, 'check_token' ),
				'args'                => array(
					'token' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);
	}

	/**
	 * Authorises the request by comparing the supplied token against the one
	 * this site was configured with, in constant time.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return bool|WP_Error
	 */
	public function check_token( WP_REST_Request $request ) {
		$stored = linkauthority_partners_get_token();

		if ( '' === $stored ) {
			return new WP_Error(
				'linkauthority_partners_not_configured',
				__( 'This site is not connected to LinkAuthority.', 'linkauthority-partners' ),
				array( 'status' => 403 )
			);
		}

		$supplied = (string) $request->get_param( 'token' );

		if ( ! hash_equals( $stored, $supplied ) ) {
			return new WP_Error(
				'linkauthority_partners_invalid_token',
				__( 'Invalid token.', 'linkauthority-partners' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * @return WP_REST_Response
	 */
	public function handle_update() {
		$success = LinkAuthority_Partners_API::refresh_partners();

		return new WP_REST_Response( array( 'success' => $success ), $success ? 200 : 500 );
	}
}
