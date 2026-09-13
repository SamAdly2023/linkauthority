<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * OAuth popup flow for Meta (Facebook + Instagram), Pinterest and LinkedIn.
 *
 * 1. admin.js opens a popup at the provider's authorize URL (fetched via AJAX so the state nonce is fresh).
 * 2. The provider redirects back to admin-post.php?action=mab_oauth (single redirect URI for every provider).
 * 3. We exchange the code, load pages/boards/organisations and render a small "pick your account" screen.
 * 4. The selection is saved, the popup reloads the settings page in the opener and closes itself.
 */
class MAB_OAuth {

	/** @var MAB_OAuth */
	private static $instance;

	public static function instance() {
		if ( ! self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'admin_post_mab_oauth', array( $this, 'callback' ) );
		add_action( 'admin_post_mab_oauth_select', array( $this, 'select' ) );
		add_action( 'wp_ajax_mab_oauth_start', array( $this, 'ajax_start' ) );
		add_action( 'wp_ajax_mab_oauth_disconnect', array( $this, 'ajax_disconnect' ) );
		add_action( 'wp_ajax_mab_cloud_start', array( $this, 'ajax_cloud_start' ) );
		add_action( 'wp_ajax_mab_cloud_verify', array( $this, 'ajax_cloud_verify' ) );
		add_action( 'admin_post_mab_cloud_return', array( $this, 'cloud_return' ) );
	}

	/* ------------------------------------------------------------------ */
	/* LinkAuthority Connect (relay) mode                                  */
	/* ------------------------------------------------------------------ */

	public static function cloud_url() {
		return untrailingslashit( (string) MAB_Options::get( 'cloud_url' ) );
	}

	/**
	 * POST JSON to the connect server.
	 *
	 * @return array|WP_Error Decoded body.
	 */
	public static function cloud_post( $path, array $body ) {
		$url = self::cloud_url();
		if ( ! $url ) {
			return new WP_Error( 'mab_cloud_url', __( 'The connect server URL is empty.', 'manus-auto-blogger' ) );
		}
		$body['license'] = MAB_Options::get( 'cloud_license' );
		$body['site']    = home_url( '/' );
		$res             = wp_remote_post(
			$url . $path,
			array(
				'timeout' => 45,
				'headers' => array( 'Content-Type' => 'application/json', 'Accept' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$json = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! is_array( $json ) ) {
			return new WP_Error( 'mab_cloud_bad', sprintf( __( 'The connect server returned an unreadable response (HTTP %d).', 'manus-auto-blogger' ), (int) wp_remote_retrieve_response_code( $res ) ) );
		}
		if ( empty( $json['ok'] ) ) {
			return new WP_Error( 'mab_cloud_err', isset( $json['message'] ) ? $json['message'] : __( 'Connect server error.', 'manus-auto-blogger' ) );
		}
		return $json;
	}

	public function ajax_cloud_start() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
		}
		check_ajax_referer( 'mab_ajax', 'nonce' );
		$provider = isset( $_POST['provider'] ) ? sanitize_key( $_POST['provider'] ) : '';
		if ( ! in_array( $provider, self::providers(), true ) ) {
			wp_send_json_error( array( 'message' => 'Unknown provider.' ) );
		}
		if ( ! self::cloud_url() ) {
			wp_send_json_error( array( 'message' => __( 'Connect server URL is missing.', 'manus-auto-blogger' ) ) );
		}
		// No licence check here. The connect server decides whether a key is
		// required - it runs in open mode while the service is free - and when
		// one is missing it sends the popup back with a message that says so.
		// Blocking here made the button close an empty popup with no explanation
		// on every site that had, correctly, left the field blank.

		$state = wp_generate_password( 24, false );
		set_transient( 'mab_cloud_' . $state, array( 'provider' => $provider, 'user' => get_current_user_id() ), 15 * MINUTE_IN_SECONDS );

		$url = add_query_arg(
			array(
				'provider' => $provider,
				'site'     => rawurlencode( home_url( '/' ) ),
				'return'   => rawurlencode( admin_url( 'admin-post.php?action=mab_cloud_return' ) ),
				'state'    => $state,
				'license'  => rawurlencode( MAB_Options::get( 'cloud_license' ) ),
				'org'      => 'linkedin' === $provider && MAB_Options::get( 'linkedin_org_scopes' ) ? 1 : 0,
			),
			self::cloud_url() . '/start'
		);
		wp_send_json_success( array( 'url' => $url ) );
	}

	public function ajax_cloud_verify() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
		}
		check_ajax_referer( 'mab_ajax', 'nonce' );
		$key = isset( $_POST['license'] ) ? sanitize_text_field( wp_unslash( $_POST['license'] ) ) : '';
		if ( $key ) {
			MAB_Options::update( array( 'cloud_license' => $key ) );
		}
		$res = self::cloud_post( '/verify', array() );
		if ( is_wp_error( $res ) ) {
			wp_send_json_error( array( 'message' => $res->get_error_message() ) );
		}
		$max  = isset( $res['sites_max'] ) ? (int) $res['sites_max'] : 0;
		$used = isset( $res['sites_used'] ) ? (int) $res['sites_used'] : 0;
		wp_send_json_success( array( 'message' => sprintf( __( 'Licence valid (%1$s) - %2$d of %3$s sites in use.', 'manus-auto-blogger' ), isset( $res['label'] ) ? $res['label'] : 'ok', $used, $max ? $max : '∞' ) ) );
	}

	/**
	 * Popup lands here after the connect server finished the OAuth dance.
	 */
	public function cloud_return() {
		if ( ! current_user_can( 'manage_options' ) ) {
			$this->popup_page( __( 'Please log in to WordPress as an administrator and try again.', 'manus-auto-blogger' ), true );
		}
		$state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : ''; // phpcs:ignore
		$data  = $state ? get_transient( 'mab_cloud_' . $state ) : false;
		if ( ! $data || (int) $data['user'] !== get_current_user_id() ) {
			$this->popup_page( __( 'The sign-in session expired or was invalid. Close this window and click Connect again.', 'manus-auto-blogger' ), true );
		}
		delete_transient( 'mab_cloud_' . $state );
		$provider = $data['provider'];

		if ( ! empty( $_GET['error'] ) ) { // phpcs:ignore
			$this->popup_page( sanitize_text_field( wp_unslash( $_GET['error'] ) ), true ); // phpcs:ignore
		}
		$code = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : ''; // phpcs:ignore
		if ( ! $code ) {
			$this->popup_page( __( 'No connection code was returned.', 'manus-auto-blogger' ), true );
		}

		$res = self::cloud_post( '/exchange', array( 'code' => $code ) );
		if ( is_wp_error( $res ) ) {
			MAB_Logger::error( ucfirst( $provider ) . ' connection via LinkAuthority failed: ' . $res->get_error_message() );
			$this->popup_page( $res->get_error_message(), true );
		}
		if ( empty( $res['account'] ) || ! is_array( $res['account'] ) || ( isset( $res['provider'] ) && $res['provider'] !== $provider ) ) {
			$this->popup_page( __( 'The connect server returned an unexpected payload.', 'manus-auto-blogger' ), true );
		}

		$acct        = $res['account'];
		$acct['via'] = 'cloud';
		$prev        = MAB_Social_Accounts::get( $provider );
		foreach ( array( 'fb_page_id', 'ig_page_id', 'board_id', 'board_name', 'author_urn', 'author_name' ) as $k ) {
			if ( ! empty( $prev[ $k ] ) && array_key_exists( $k, $acct ) ) {
				$acct[ $k ] = $prev[ $k ];
			}
		}
		MAB_Social_Accounts::set( $provider, $acct );
		$this->render_selection( $provider, $acct );
	}

	public static function redirect_uri() {
		return admin_url( 'admin-post.php?action=mab_oauth' );
	}

	private static function providers() {
		return array( 'meta', 'pinterest', 'linkedin' );
	}

	/* ------------------------------------------------------------------ */
	/* Step 1: authorize URL                                               */
	/* ------------------------------------------------------------------ */

	public function ajax_start() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
		}
		check_ajax_referer( 'mab_ajax', 'nonce' );

		$provider = isset( $_POST['provider'] ) ? sanitize_key( $_POST['provider'] ) : '';
		if ( ! in_array( $provider, self::providers(), true ) ) {
			wp_send_json_error( array( 'message' => 'Unknown provider.' ) );
		}

		$missing = $this->missing_credentials( $provider );
		if ( $missing ) {
			wp_send_json_error( array( 'message' => $missing ) );
		}

		$state = wp_generate_password( 24, false );
		set_transient( 'mab_oauth_' . $state, array( 'provider' => $provider, 'user' => get_current_user_id() ), 15 * MINUTE_IN_SECONDS );

		$uri = self::redirect_uri();
		switch ( $provider ) {
			case 'meta':
				$url = MAB_Platform_Meta::authorize_url( $uri, $state );
				break;
			case 'pinterest':
				$url = MAB_Platform_Pinterest::authorize_url( $uri, $state );
				break;
			default:
				$url = MAB_Platform_LinkedIn::authorize_url( $uri, $state );
		}
		wp_send_json_success( array( 'url' => $url ) );
	}

	private function missing_credentials( $provider ) {
		switch ( $provider ) {
			case 'meta':
				return MAB_Options::get( 'meta_app_id' ) && MAB_Options::get( 'meta_app_secret' ) ? '' : __( 'Save your Meta App ID and App Secret first.', 'manus-auto-blogger' );
			case 'pinterest':
				return MAB_Options::get( 'pinterest_app_id' ) && MAB_Options::get( 'pinterest_app_secret' ) ? '' : __( 'Save your Pinterest App ID and App Secret first.', 'manus-auto-blogger' );
			case 'linkedin':
				return MAB_Options::get( 'linkedin_client_id' ) && MAB_Options::get( 'linkedin_client_secret' ) ? '' : __( 'Save your LinkedIn Client ID and Client Secret first.', 'manus-auto-blogger' );
		}
		return 'Unknown provider.';
	}

	public function ajax_disconnect() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
		}
		check_ajax_referer( 'mab_ajax', 'nonce' );
		$provider = isset( $_POST['provider'] ) ? sanitize_key( $_POST['provider'] ) : '';
		if ( in_array( $provider, self::providers(), true ) ) {
			MAB_Social_Accounts::disconnect( $provider );
			MAB_Logger::info( ucfirst( $provider ) . ' account disconnected.' );
		}
		wp_send_json_success();
	}

	/* ------------------------------------------------------------------ */
	/* Step 2: provider callback                                           */
	/* ------------------------------------------------------------------ */

	public function callback() {
		if ( ! current_user_can( 'manage_options' ) ) {
			$this->popup_page( __( 'Please log in to WordPress as an administrator and try again.', 'manus-auto-blogger' ), true );
		}

		$state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : ''; // phpcs:ignore
		$data  = $state ? get_transient( 'mab_oauth_' . $state ) : false;
		if ( ! $data || (int) $data['user'] !== get_current_user_id() ) {
			$this->popup_page( __( 'The sign-in session expired or was invalid. Close this window and click Connect again.', 'manus-auto-blogger' ), true );
		}
		delete_transient( 'mab_oauth_' . $state );
		$provider = $data['provider'];

		if ( ! empty( $_GET['error'] ) ) { // phpcs:ignore
			$desc = isset( $_GET['error_description'] ) ? sanitize_text_field( wp_unslash( $_GET['error_description'] ) ) : sanitize_text_field( wp_unslash( $_GET['error'] ) ); // phpcs:ignore
			$this->popup_page( sprintf( __( 'Authorisation was cancelled or failed: %s', 'manus-auto-blogger' ), $desc ), true );
		}

		$code = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : ''; // phpcs:ignore
		if ( ! $code ) {
			$this->popup_page( __( 'No authorisation code was returned.', 'manus-auto-blogger' ), true );
		}

		$uri = self::redirect_uri();
		switch ( $provider ) {
			case 'meta':
				$acct = MAB_Platform_Meta::handle_callback( $code, $uri );
				break;
			case 'pinterest':
				$acct = MAB_Platform_Pinterest::handle_callback( $code, $uri );
				break;
			default:
				$acct = MAB_Platform_LinkedIn::handle_callback( $code, $uri );
		}

		if ( is_wp_error( $acct ) ) {
			MAB_Logger::error( ucfirst( $provider ) . ' connection failed: ' . $acct->get_error_message() );
			$this->popup_page( $acct->get_error_message(), true );
		}

		// Keep previous selections when reconnecting.
		$prev = MAB_Social_Accounts::get( $provider );
		foreach ( array( 'fb_page_id', 'ig_page_id', 'board_id', 'board_name', 'author_urn', 'author_name' ) as $k ) {
			if ( ! empty( $prev[ $k ] ) && array_key_exists( $k, $acct ) ) {
				$acct[ $k ] = $prev[ $k ];
			}
		}
		$acct['via'] = 'own';
		MAB_Social_Accounts::set( $provider, $acct );

		$this->render_selection( $provider, $acct );
	}

	/* ------------------------------------------------------------------ */
	/* Step 3: account selection                                           */
	/* ------------------------------------------------------------------ */

	private function render_selection( $provider, array $acct ) {
		ob_start();
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'mab_oauth_select' );
		echo '<input type="hidden" name="action" value="mab_oauth_select" /><input type="hidden" name="provider" value="' . esc_attr( $provider ) . '" />';

		if ( 'meta' === $provider ) {
			echo '<p class="mab-p-sub">' . sprintf( esc_html__( 'Signed in as %s. Choose where posts should be published:', 'manus-auto-blogger' ), '<strong>' . esc_html( $acct['user_name'] ) . '</strong>' ) . '</p>';
			echo '<h3>' . esc_html__( 'Facebook Page', 'manus-auto-blogger' ) . '</h3>';
			echo '<label class="mab-p-opt"><input type="radio" name="fb_page_id" value=""' . checked( '', $acct['fb_page_id'], false ) . ' /> ' . esc_html__( 'Do not post to Facebook', 'manus-auto-blogger' ) . '</label>';
			foreach ( $acct['pages'] as $p ) {
				echo '<label class="mab-p-opt"><input type="radio" name="fb_page_id" value="' . esc_attr( $p['id'] ) . '"' . checked( $p['id'], $acct['fb_page_id'], false ) . ' /> ' . esc_html( $p['name'] ) . '</label>';
			}
			echo '<h3>' . esc_html__( 'Instagram account', 'manus-auto-blogger' ) . '</h3>';
			echo '<label class="mab-p-opt"><input type="radio" name="ig_page_id" value=""' . checked( '', $acct['ig_page_id'], false ) . ' /> ' . esc_html__( 'Do not post to Instagram', 'manus-auto-blogger' ) . '</label>';
			$has_ig = false;
			foreach ( $acct['pages'] as $p ) {
				if ( empty( $p['ig_id'] ) ) {
					continue;
				}
				$has_ig = true;
				echo '<label class="mab-p-opt"><input type="radio" name="ig_page_id" value="' . esc_attr( $p['id'] ) . '"' . checked( $p['id'], $acct['ig_page_id'], false ) . ' /> @' . esc_html( $p['ig_username'] ) . ' <span class="mab-p-muted">(' . esc_html( $p['name'] ) . ')</span></label>';
			}
			if ( ! $has_ig ) {
				echo '<p class="mab-p-muted">' . esc_html__( 'None of your Pages has an Instagram Business/Creator account linked. Link one in Facebook Page settings, then reconnect.', 'manus-auto-blogger' ) . '</p>';
			}
		} elseif ( 'pinterest' === $provider ) {
			echo '<p class="mab-p-sub">' . sprintf( esc_html__( 'Signed in as %s. Choose the board to pin to:', 'manus-auto-blogger' ), '<strong>@' . esc_html( $acct['username'] ) . '</strong>' ) . '</p>';
			foreach ( $acct['boards'] as $b ) {
				echo '<label class="mab-p-opt"><input type="radio" name="board_id" value="' . esc_attr( $b['id'] ) . '"' . checked( $b['id'], $acct['board_id'] ? $acct['board_id'] : $acct['boards'][0]['id'], false ) . ' /> ' . esc_html( $b['name'] ) . '</label>';
			}
		} else {
			echo '<p class="mab-p-sub">' . sprintf( esc_html__( 'Signed in as %s. Post as:', 'manus-auto-blogger' ), '<strong>' . esc_html( $acct['name'] ) . '</strong>' ) . '</p>';
			$current = $acct['author_urn'] ? $acct['author_urn'] : $acct['person_urn'];
			echo '<label class="mab-p-opt"><input type="radio" name="author_urn" value="' . esc_attr( $acct['person_urn'] ) . '"' . checked( $acct['person_urn'], $current, false ) . ' /> ' . esc_html( $acct['name'] ) . ' <span class="mab-p-muted">(' . esc_html__( 'personal profile', 'manus-auto-blogger' ) . ')</span></label>';
			foreach ( $acct['orgs'] as $o ) {
				echo '<label class="mab-p-opt"><input type="radio" name="author_urn" value="' . esc_attr( $o['urn'] ) . '"' . checked( $o['urn'], $current, false ) . ' /> ' . esc_html( $o['name'] ) . ' <span class="mab-p-muted">(' . esc_html__( 'Company Page', 'manus-auto-blogger' ) . ')</span></label>';
			}
			if ( ! $acct['orgs'] && MAB_Options::get( 'linkedin_org_scopes' ) ) {
				echo '<p class="mab-p-muted">' . esc_html__( 'No Company Pages were returned - your app needs the Community Management API product approved for organisation posting.', 'manus-auto-blogger' ) . '</p>';
			}
		}

		echo '<p><button type="submit" class="mab-p-btn">' . esc_html__( 'Save & finish', 'manus-auto-blogger' ) . '</button></p></form>';
		$this->popup_page( ob_get_clean(), false, sprintf( __( 'Connect %s', 'manus-auto-blogger' ), 'meta' === $provider ? 'Facebook & Instagram' : ucfirst( $provider ) ) );
	}

	public function select() {
		if ( ! current_user_can( 'manage_options' ) ) {
			$this->popup_page( 'Not allowed.', true );
		}
		check_admin_referer( 'mab_oauth_select' );

		$provider = isset( $_POST['provider'] ) ? sanitize_key( $_POST['provider'] ) : '';
		$acct     = MAB_Social_Accounts::get( $provider );
		if ( ! $acct ) {
			$this->popup_page( __( 'Account data not found. Please connect again.', 'manus-auto-blogger' ), true );
		}

		$summary = '';
		if ( 'meta' === $provider ) {
			$acct['fb_page_id'] = isset( $_POST['fb_page_id'] ) ? sanitize_text_field( wp_unslash( $_POST['fb_page_id'] ) ) : '';
			$acct['ig_page_id'] = isset( $_POST['ig_page_id'] ) ? sanitize_text_field( wp_unslash( $_POST['ig_page_id'] ) ) : '';
			$parts              = array();
			foreach ( $acct['pages'] as $p ) {
				if ( $p['id'] === $acct['fb_page_id'] ) {
					$parts[] = 'Facebook: ' . $p['name'];
				}
				if ( $p['id'] === $acct['ig_page_id'] ) {
					$parts[] = 'Instagram: @' . $p['ig_username'];
				}
			}
			$summary = implode( ', ', $parts );
		} elseif ( 'pinterest' === $provider ) {
			$acct['board_id'] = isset( $_POST['board_id'] ) ? sanitize_text_field( wp_unslash( $_POST['board_id'] ) ) : '';
			foreach ( $acct['boards'] as $b ) {
				if ( $b['id'] === $acct['board_id'] ) {
					$acct['board_name'] = $b['name'];
					$summary            = 'Pinterest board: ' . $b['name'];
				}
			}
		} else {
			$acct['author_urn'] = isset( $_POST['author_urn'] ) ? sanitize_text_field( wp_unslash( $_POST['author_urn'] ) ) : '';
			$acct['author_name'] = $acct['name'];
			foreach ( $acct['orgs'] as $o ) {
				if ( $o['urn'] === $acct['author_urn'] ) {
					$acct['author_name'] = $o['name'];
				}
			}
			$summary = 'LinkedIn: ' . $acct['author_name'];
		}

		MAB_Social_Accounts::set( $provider, $acct );
		MAB_Logger::success( 'Social account connected. ' . $summary );

		$this->popup_page( '<p class="mab-p-ok">&#10003; ' . esc_html__( 'Connected! You can close this window.', 'manus-auto-blogger' ) . '</p><p class="mab-p-muted">' . esc_html( $summary ) . '</p><script>try{if(window.opener&&!window.opener.closed){window.opener.location.reload();}}catch(e){}setTimeout(function(){window.close();},1500);</script>', false, __( 'Connected', 'manus-auto-blogger' ) );
	}

	/* ------------------------------------------------------------------ */
	/* Popup HTML                                                          */
	/* ------------------------------------------------------------------ */

	private function popup_page( $html, $is_error = false, $title = '' ) {
		if ( ! $title ) {
			$title = $is_error ? __( 'Connection failed', 'manus-auto-blogger' ) : __( 'Manus Auto Blogger', 'manus-auto-blogger' );
		}
		if ( $is_error ) {
			$html = '<p class="mab-p-err">&#10007; ' . esc_html( $html ) . '</p><p><button type="button" class="mab-p-btn mab-p-btn--grey" onclick="window.close()">' . esc_html__( 'Close', 'manus-auto-blogger' ) . '</button></p>';
		}
		header( 'Content-Type: text/html; charset=utf-8' );
		echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . esc_html( $title ) . '</title>';
		echo '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a}.mab-p{max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:24px 28px;box-shadow:0 10px 30px -12px rgba(2,6,23,.25)}.mab-p h1{font-size:20px;margin:0 0 6px;background:linear-gradient(120deg,#6d28d9,#0ea5e9);-webkit-background-clip:text;background-clip:text;color:transparent}.mab-p h3{font-size:14px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}.mab-p-sub{color:#475569;margin:0 0 6px}.mab-p-opt{display:block;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;margin:6px 0;cursor:pointer}.mab-p-opt:hover{border-color:#6d28d9;background:#faf5ff}.mab-p-muted{color:#64748b;font-size:13px}.mab-p-btn{background:linear-gradient(120deg,#6d28d9,#0ea5e9);color:#fff;border:0;border-radius:999px;padding:12px 22px;font-weight:700;font-size:15px;cursor:pointer;margin-top:10px}.mab-p-btn--grey{background:#64748b}.mab-p-ok{font-size:18px;font-weight:700;color:#166534}.mab-p-err{color:#991b1b;font-weight:600}</style></head><body><div class="mab-p"><h1>' . esc_html( $title ) . '</h1>';
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- every caller escapes its dynamic values; the markup itself is ours.
		echo '</div></body></html>';
		exit;
	}
}
