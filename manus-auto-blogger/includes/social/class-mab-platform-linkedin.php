<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * LinkedIn publishing (personal profile or Company Page) through the versioned Posts API.
 */
class MAB_Platform_LinkedIn {

	const API    = 'https://api.linkedin.com';
	const DIALOG = 'https://www.linkedin.com/oauth/v2/authorization';
	const TOKEN  = 'https://www.linkedin.com/oauth/v2/accessToken';

	private static function scopes() {
		$scopes = array( 'openid', 'profile', 'w_member_social' );
		if ( MAB_Options::get( 'linkedin_org_scopes' ) ) {
			$scopes[] = 'r_organization_admin';
			$scopes[] = 'w_organization_social';
		}
		return implode( ' ', $scopes );
	}

	private static function version() {
		$v = preg_replace( '/[^0-9]/', '', (string) MAB_Options::get( 'linkedin_api_version' ) );
		return $v ? $v : '202601';
	}

	public static function authorize_url( $redirect_uri, $state ) {
		return add_query_arg(
			array(
				'response_type' => 'code',
				'client_id'     => MAB_Options::get( 'linkedin_client_id' ),
				'redirect_uri'  => rawurlencode( $redirect_uri ),
				'state'         => $state,
				'scope'         => rawurlencode( self::scopes() ),
			),
			self::DIALOG
		);
	}

	/**
	 * @return array|WP_Error Account data for MAB_Social_Accounts::set('linkedin').
	 */
	public static function handle_callback( $code, $redirect_uri ) {
		$res = wp_remote_post(
			self::TOKEN,
			array(
				'timeout' => 45,
				'headers' => array( 'Content-Type' => 'application/x-www-form-urlencoded' ),
				'body'    => array(
					'grant_type'    => 'authorization_code',
					'code'          => $code,
					'redirect_uri'  => $redirect_uri,
					'client_id'     => MAB_Options::get( 'linkedin_client_id' ),
					'client_secret' => MAB_Options::get( 'linkedin_client_secret' ),
				),
			)
		);
		$token = self::parse( $res );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		if ( empty( $token['access_token'] ) ) {
			return new WP_Error( 'mab_li_token', __( 'LinkedIn did not return an access token.', 'manus-auto-blogger' ) );
		}
		$access  = $token['access_token'];
		$expires = time() + ( isset( $token['expires_in'] ) ? (int) $token['expires_in'] : 60 * DAY_IN_SECONDS );

		$me = self::request( 'GET', '/v2/userinfo', array(), $access, false );
		if ( is_wp_error( $me ) || empty( $me['sub'] ) ) {
			return is_wp_error( $me ) ? $me : new WP_Error( 'mab_li_userinfo', __( 'Could not read your LinkedIn profile (is the "Sign In with LinkedIn using OpenID Connect" product added to your app?).', 'manus-auto-blogger' ) );
		}
		$person_urn = 'urn:li:person:' . $me['sub'];
		$name       = trim( ( isset( $me['given_name'] ) ? $me['given_name'] : '' ) . ' ' . ( isset( $me['family_name'] ) ? $me['family_name'] : '' ) );
		if ( ! $name && ! empty( $me['name'] ) ) {
			$name = $me['name'];
		}

		$orgs = array();
		if ( MAB_Options::get( 'linkedin_org_scopes' ) ) {
			$acl = self::request(
				'GET',
				'/rest/organizationAcls',
				array(
					'q'          => 'roleAssignee',
					'role'       => 'ADMINISTRATOR',
					'state'      => 'APPROVED',
					'projection' => '(elements*(organization~(localizedName)))',
				),
				$access,
				true
			);
			if ( ! is_wp_error( $acl ) ) {
				foreach ( (array) ( isset( $acl['elements'] ) ? $acl['elements'] : array() ) as $el ) {
					if ( ! empty( $el['organization'] ) ) {
						$orgs[] = array(
							'urn'  => $el['organization'],
							'name' => isset( $el['organization~']['localizedName'] ) ? $el['organization~']['localizedName'] : $el['organization'],
						);
					}
				}
			}
		}

		return array(
			'access_token' => $access,
			'expires'      => $expires,
			'person_urn'   => $person_urn,
			'name'         => $name,
			'orgs'         => $orgs,
			'author_urn'   => '',
			'author_name'  => '',
		);
	}

	/**
	 * Article share (LinkedIn pulls the OG image from the post URL; we also send the thumbnail hint).
	 *
	 * @return array|WP_Error { id, url }
	 */
	public static function publish( $commentary, $link, $title, $description ) {
		$acct = MAB_Social_Accounts::linkedin_author();
		if ( ! $acct ) {
			return new WP_Error( 'mab_li_not_connected', __( 'LinkedIn is not connected.', 'manus-auto-blogger' ) );
		}
		if ( (int) $acct['expires'] < time() ) {
			return new WP_Error( 'mab_li_expired', __( 'LinkedIn token has expired - reconnect LinkedIn in the settings.', 'manus-auto-blogger' ) );
		}

		$body = array(
			'author'                    => $acct['author_urn'],
			'commentary'                => mb_substr( $commentary, 0, 2900 ),
			'visibility'                => 'PUBLIC',
			'distribution'              => array(
				'feedDistribution'               => 'MAIN_FEED',
				'targetEntities'                 => array(),
				'thirdPartyDistributionChannels' => array(),
			),
			'content'                   => array(
				'article' => array(
					'source'      => $link,
					'title'       => mb_substr( $title, 0, 400 ),
					'description' => mb_substr( $description, 0, 4000 ),
				),
			),
			'lifecycleState'            => 'PUBLISHED',
			'isReshareDisabledByAuthor' => false,
		);

		$res = wp_remote_post(
			self::API . '/rest/posts',
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization'             => 'Bearer ' . $acct['access_token'],
					'Content-Type'              => 'application/json',
					'X-Restli-Protocol-Version' => '2.0.0',
					'LinkedIn-Version'          => self::version(),
				),
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		if ( $code >= 400 ) {
			$b   = json_decode( wp_remote_retrieve_body( $res ), true );
			$msg = is_array( $b ) && isset( $b['message'] ) ? $b['message'] : sprintf( 'LinkedIn API error (HTTP %d).', $code );
			return new WP_Error( 'linkedin_http_' . $code, $msg, $b );
		}
		$urn = wp_remote_retrieve_header( $res, 'x-restli-id' );
		if ( ! $urn ) {
			$urn = wp_remote_retrieve_header( $res, 'x-linkedin-id' );
		}
		return array(
			'id'  => $urn,
			'url' => $urn ? 'https://www.linkedin.com/feed/update/' . rawurlencode( $urn ) . '/' : 'https://www.linkedin.com/feed/',
		);
	}

	/* ---- HTTP ---- */

	private static function request( $method, $path, array $query, $token, $versioned ) {
		$headers = array(
			'Authorization' => 'Bearer ' . $token,
			'Accept'        => 'application/json',
		);
		if ( $versioned ) {
			$headers['LinkedIn-Version']          = self::version();
			$headers['X-Restli-Protocol-Version'] = '2.0.0';
		}
		$url = self::API . $path;
		if ( $query ) {
			$url = add_query_arg( array_map( 'rawurlencode', $query ), $url );
		}
		return self::parse( wp_remote_request( $url, array( 'method' => $method, 'timeout' => 45, 'headers' => $headers ) ) );
	}

	private static function parse( $res ) {
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( $code >= 400 ) {
			$msg = is_array( $body ) ? ( isset( $body['message'] ) ? $body['message'] : ( isset( $body['error_description'] ) ? $body['error_description'] : '' ) ) : '';
			return new WP_Error( 'linkedin_http_' . $code, $msg ? $msg : sprintf( 'LinkedIn API error (HTTP %d).', $code ), $body );
		}
		return is_array( $body ) ? $body : array();
	}
}
