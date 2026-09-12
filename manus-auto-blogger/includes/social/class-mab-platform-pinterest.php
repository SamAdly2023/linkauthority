<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pinterest publishing through the v5 API.
 */
class MAB_Platform_Pinterest {

	const API    = 'https://api.pinterest.com/v5';
	const DIALOG = 'https://www.pinterest.com/oauth/';
	const SCOPES = 'boards:read,pins:read,pins:write,user_accounts:read';

	public static function authorize_url( $redirect_uri, $state ) {
		return add_query_arg(
			array(
				'client_id'     => MAB_Options::get( 'pinterest_app_id' ),
				'redirect_uri'  => rawurlencode( $redirect_uri ),
				'response_type' => 'code',
				'scope'         => self::SCOPES,
				'state'         => $state,
			),
			self::DIALOG
		);
	}

	/**
	 * @return array|WP_Error Account data for MAB_Social_Accounts::set('pinterest').
	 */
	public static function handle_callback( $code, $redirect_uri ) {
		$token = self::token_request(
			array(
				'grant_type'   => 'authorization_code',
				'code'         => $code,
				'redirect_uri' => $redirect_uri,
			)
		);
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$acct = array(
			'access_token'  => $token['access_token'],
			'refresh_token' => isset( $token['refresh_token'] ) ? $token['refresh_token'] : '',
			'expires'       => time() + ( isset( $token['expires_in'] ) ? (int) $token['expires_in'] : 30 * DAY_IN_SECONDS ),
			'username'      => '',
			'boards'        => array(),
			'board_id'      => '',
			'board_name'    => '',
		);

		$user = self::request( 'GET', '/user_account', array(), $acct['access_token'] );
		if ( ! is_wp_error( $user ) && ! empty( $user['username'] ) ) {
			$acct['username'] = $user['username'];
		}

		$boards = self::request( 'GET', '/boards', array( 'page_size' => 100 ), $acct['access_token'] );
		if ( is_wp_error( $boards ) ) {
			return $boards;
		}
		foreach ( (array) ( isset( $boards['items'] ) ? $boards['items'] : array() ) as $b ) {
			$acct['boards'][] = array( 'id' => $b['id'], 'name' => $b['name'] );
		}
		if ( ! $acct['boards'] ) {
			return new WP_Error( 'mab_pin_no_boards', __( 'No boards found on this Pinterest account. Create a board first.', 'manus-auto-blogger' ) );
		}
		return $acct;
	}

	/**
	 * Refresh the access token if it is about to expire.
	 */
	private static function fresh_token() {
		$p = MAB_Social_Accounts::get( 'pinterest' );
		if ( empty( $p['access_token'] ) ) {
			return new WP_Error( 'mab_pin_not_connected', __( 'Pinterest is not connected.', 'manus-auto-blogger' ) );
		}
		if ( (int) $p['expires'] - time() > DAY_IN_SECONDS || empty( $p['refresh_token'] ) ) {
			return $p['access_token'];
		}
		if ( ! empty( $p['via'] ) && 'cloud' === $p['via'] ) {
			// The app secret lives on the connect server, so refresh there.
			$res = MAB_OAuth::cloud_post( '/refresh', array( 'provider' => 'pinterest', 'refresh_token' => $p['refresh_token'] ) );
			if ( is_wp_error( $res ) ) {
				return $res;
			}
			$t = isset( $res['tokens'] ) ? $res['tokens'] : array();
			if ( empty( $t['access_token'] ) ) {
				return new WP_Error( 'mab_pin_refresh', __( 'Pinterest token refresh failed.', 'manus-auto-blogger' ) );
			}
			MAB_Social_Accounts::merge( 'pinterest', array( 'access_token' => $t['access_token'], 'refresh_token' => ! empty( $t['refresh_token'] ) ? $t['refresh_token'] : $p['refresh_token'], 'expires' => (int) $t['expires'] ) );
			return $t['access_token'];
		}
		$token = self::token_request(
			array(
				'grant_type'    => 'refresh_token',
				'refresh_token' => $p['refresh_token'],
			)
		);
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		MAB_Social_Accounts::merge(
			'pinterest',
			array(
				'access_token'  => $token['access_token'],
				'refresh_token' => ! empty( $token['refresh_token'] ) ? $token['refresh_token'] : $p['refresh_token'],
				'expires'       => time() + ( isset( $token['expires_in'] ) ? (int) $token['expires_in'] : 30 * DAY_IN_SECONDS ),
			)
		);
		return $token['access_token'];
	}

	/**
	 * @return array|WP_Error { id, url }
	 */
	public static function publish( $title, $description, $image_url, $link ) {
		$acct = MAB_Social_Accounts::pinterest_board();
		if ( ! $acct ) {
			return new WP_Error( 'mab_pin_not_connected', __( 'Pinterest board is not selected.', 'manus-auto-blogger' ) );
		}
		$token = self::fresh_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$res = self::request(
			'POST',
			'/pins',
			array(
				'board_id'     => $acct['board_id'],
				'title'        => mb_substr( $title, 0, 100 ),
				'description'  => mb_substr( $description, 0, 800 ),
				'link'         => $link,
				'alt_text'     => mb_substr( $title, 0, 500 ),
				'media_source' => array(
					'source_type' => 'image_url',
					'url'         => $image_url,
				),
			),
			$token
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		return array(
			'id'  => $res['id'],
			'url' => 'https://www.pinterest.com/pin/' . $res['id'] . '/',
		);
	}

	/* ---- HTTP ---- */

	private static function token_request( array $form ) {
		$res = wp_remote_post(
			self::API . '/oauth/token',
			array(
				'timeout' => 45,
				'headers' => array(
					'Authorization' => 'Basic ' . base64_encode( MAB_Options::get( 'pinterest_app_id' ) . ':' . MAB_Options::get( 'pinterest_app_secret' ) ),
					'Content-Type'  => 'application/x-www-form-urlencoded',
				),
				'body'    => $form,
			)
		);
		$body = self::parse( $res );
		if ( is_wp_error( $body ) ) {
			return $body;
		}
		if ( empty( $body['access_token'] ) ) {
			return new WP_Error( 'mab_pin_token', __( 'Pinterest did not return an access token.', 'manus-auto-blogger' ) );
		}
		return $body;
	}

	private static function request( $method, $path, array $data, $token ) {
		$args = array(
			'method'  => $method,
			'timeout' => 60,
			'headers' => array(
				'Authorization' => 'Bearer ' . $token,
				'Accept'        => 'application/json',
			),
		);
		$url  = self::API . $path;
		if ( 'GET' === $method ) {
			if ( $data ) {
				$url = add_query_arg( $data, $url );
			}
		} else {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body']                    = wp_json_encode( $data );
		}
		return self::parse( wp_remote_request( $url, $args ) );
	}

	private static function parse( $res ) {
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( $code >= 400 ) {
			$msg = is_array( $body ) && isset( $body['message'] ) ? $body['message'] : sprintf( 'Pinterest API error (HTTP %d).', $code );
			return new WP_Error( 'pinterest_http_' . $code, $msg, $body );
		}
		return is_array( $body ) ? $body : array();
	}
}
