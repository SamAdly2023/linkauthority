<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Facebook Pages + Instagram Business publishing through the Meta Graph API.
 *
 * Unversioned Graph URLs are used on purpose: Meta routes them to the oldest
 * still-supported version, so the plugin keeps working as versions are retired.
 */
class LAPUB_Platform_Meta {

	const GRAPH  = 'https://graph.facebook.com';
	const DIALOG = 'https://www.facebook.com/dialog/oauth';
	const SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management';

	/* ------------------------------------------------------------------ */
	/* OAuth                                                               */
	/* ------------------------------------------------------------------ */

	public static function authorize_url( $redirect_uri, $state ) {
		$args = array(
			'client_id'     => LAPUB_Options::get( 'meta_app_id' ),
			'redirect_uri'  => rawurlencode( $redirect_uri ),
			'state'         => $state,
			'response_type' => 'code',
		);
		// "Facebook Login for Business" apps use a login configuration instead of a scope list.
		$config_id = trim( (string) LAPUB_Options::get( 'meta_config_id' ) );
		if ( $config_id ) {
			$args['config_id'] = $config_id;
		} else {
			$args['scope'] = self::SCOPES;
		}
		return add_query_arg( $args, self::DIALOG );
	}

	/**
	 * Exchange the code, upgrade to a long-lived token and load the user's pages.
	 *
	 * @return array|WP_Error Account data ready for LAPUB_Social_Accounts::set('meta').
	 */
	public static function handle_callback( $code, $redirect_uri ) {
		$app_id = LAPUB_Options::get( 'meta_app_id' );
		$secret = LAPUB_Options::get( 'meta_app_secret' );

		$token = self::get(
			'/oauth/access_token',
			array(
				'client_id'     => $app_id,
				'client_secret' => $secret,
				'redirect_uri'  => $redirect_uri,
				'code'          => $code,
			)
		);
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$long = self::get(
			'/oauth/access_token',
			array(
				'grant_type'        => 'fb_exchange_token',
				'client_id'         => $app_id,
				'client_secret'     => $secret,
				'fb_exchange_token' => $token['access_token'],
			)
		);
		$user_token = is_wp_error( $long ) ? $token['access_token'] : $long['access_token'];
		$expires    = ! is_wp_error( $long ) && ! empty( $long['expires_in'] ) ? time() + (int) $long['expires_in'] : time() + 60 * DAY_IN_SECONDS;

		$me = self::get( '/me', array( 'fields' => 'id,name', 'access_token' => $user_token ) );

		$pages_res = self::get(
			'/me/accounts',
			array(
				'fields'       => 'id,name,access_token,instagram_business_account{id,username}',
				'limit'        => 100,
				'access_token' => $user_token,
			)
		);
		if ( is_wp_error( $pages_res ) ) {
			return $pages_res;
		}

		$pages = array();
		foreach ( (array) ( isset( $pages_res['data'] ) ? $pages_res['data'] : array() ) as $p ) {
			$pages[] = array(
				'id'           => $p['id'],
				'name'         => $p['name'],
				'access_token' => $p['access_token'],
				'ig_id'        => isset( $p['instagram_business_account']['id'] ) ? $p['instagram_business_account']['id'] : '',
				'ig_username'  => isset( $p['instagram_business_account']['username'] ) ? $p['instagram_business_account']['username'] : '',
			);
		}
		if ( ! $pages ) {
			return new WP_Error( 'lapub_meta_no_pages', __( 'No Facebook Pages were returned. Make sure you granted access to at least one Page in the Facebook dialog.', 'linkauthority-publisher' ) );
		}

		return array(
			'user_token' => $user_token,
			'expires'    => $expires,
			'user_name'  => is_wp_error( $me ) ? '' : $me['name'],
			'pages'      => $pages,
			'fb_page_id' => '',
			'ig_page_id' => '',
		);
	}

	/* ------------------------------------------------------------------ */
	/* Publishing                                                          */
	/* ------------------------------------------------------------------ */

	/**
	 * Photo post on a Facebook Page.
	 *
	 * @return array|WP_Error { id, url }
	 */
	public static function publish_facebook( $message, $image_url, $link ) {
		$page = LAPUB_Social_Accounts::facebook_page();
		if ( ! $page ) {
			return new WP_Error( 'lapub_fb_not_connected', __( 'Facebook Page is not connected.', 'linkauthority-publisher' ) );
		}
		$text = trim( $message ) . "\n\n" . $link;
		$res  = self::post(
			'/' . $page['id'] . '/photos',
			array(
				'url'          => $image_url,
				'message'      => $text,
				'access_token' => $page['access_token'],
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$post_id = ! empty( $res['post_id'] ) ? $res['post_id'] : ( ! empty( $res['id'] ) ? $page['id'] . '_' . $res['id'] : '' );
		return array(
			'id'  => $post_id,
			'url' => $post_id ? 'https://www.facebook.com/' . $post_id : 'https://www.facebook.com/' . $page['id'],
		);
	}

	/**
	 * Single-image post on Instagram (two-step container publish).
	 *
	 * @return array|WP_Error { id, url }
	 */
	public static function publish_instagram( $caption, $image_url ) {
		$acct = LAPUB_Social_Accounts::instagram_account();
		if ( ! $acct ) {
			return new WP_Error( 'lapub_ig_not_connected', __( 'Instagram account is not connected.', 'linkauthority-publisher' ) );
		}
		$token = $acct['access_token'];
		$ig_id = $acct['ig_id'];

		$container = self::post(
			'/' . $ig_id . '/media',
			array(
				'image_url'    => $image_url,
				'caption'      => mb_substr( $caption, 0, 2200 ),
				'access_token' => $token,
			)
		);
		if ( is_wp_error( $container ) ) {
			return $container;
		}
		$creation_id = $container['id'];

		// Wait for Instagram to finish fetching/processing the image.
		for ( $i = 0; $i < 10; $i++ ) {
			$status = self::get( '/' . $creation_id, array( 'fields' => 'status_code,status', 'access_token' => $token ) );
			if ( is_wp_error( $status ) ) {
				break;
			}
			$code = isset( $status['status_code'] ) ? $status['status_code'] : 'FINISHED';
			if ( 'FINISHED' === $code ) {
				break;
			}
			if ( 'ERROR' === $code || 'EXPIRED' === $code ) {
				return new WP_Error( 'lapub_ig_container', 'Instagram could not process the image: ' . ( isset( $status['status'] ) ? $status['status'] : $code ) );
			}
			sleep( 3 );
		}

		$publish = self::post(
			'/' . $ig_id . '/media_publish',
			array(
				'creation_id'  => $creation_id,
				'access_token' => $token,
			)
		);
		if ( is_wp_error( $publish ) ) {
			return $publish;
		}
		$media_id = $publish['id'];
		$perma    = self::get( '/' . $media_id, array( 'fields' => 'permalink', 'access_token' => $token ) );
		return array(
			'id'  => $media_id,
			'url' => ! is_wp_error( $perma ) && ! empty( $perma['permalink'] ) ? $perma['permalink'] : 'https://www.instagram.com/' . $acct['ig_username'] . '/',
		);
	}

	/* ------------------------------------------------------------------ */
	/* HTTP                                                                */
	/* ------------------------------------------------------------------ */

	private static function get( $path, array $query ) {
		$url = self::GRAPH . $path;
		$res = wp_remote_get( add_query_arg( array_map( 'rawurlencode', $query ), $url ), array( 'timeout' => 45 ) );
		return self::parse( $res );
	}

	private static function post( $path, array $body ) {
		$res = wp_remote_post( self::GRAPH . $path, array( 'timeout' => 90, 'body' => $body ) );
		return self::parse( $res );
	}

	private static function parse( $res ) {
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		$code = (int) wp_remote_retrieve_response_code( $res );
		if ( ! is_array( $body ) ) {
			return new WP_Error( 'meta_http_' . $code, sprintf( 'Meta API returned an unreadable response (HTTP %d).', $code ) );
		}
		if ( isset( $body['error'] ) ) {
			$e = $body['error'];
			return new WP_Error( 'meta_' . ( isset( $e['code'] ) ? $e['code'] : $code ), isset( $e['message'] ) ? $e['message'] : 'Meta API error', $e );
		}
		return $body;
	}
}
