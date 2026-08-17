<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the plugin's single settings option and its sanitiser.
 *
 * Saving a token is what connects the site, so the sanitiser is also where
 * connect/disconnect is driven from - the setting and the service state can
 * never drift apart that way.
 */
class LinkAuthority_Partners_Settings {

	public function init() {
		add_action( 'admin_init', array( $this, 'register' ) );

		// Connecting happens after the value is stored, never inside the sanitise
		// callback: writing the option being sanitised re-enters sanitisation, and
		// a callback that makes HTTP calls can be run more than once per request.
		add_action( 'add_option_' . LINKAUTHORITY_PARTNERS_OPT_SETTINGS, array( $this, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . LINKAUTHORITY_PARTNERS_OPT_SETTINGS, array( $this, 'on_update' ), 10, 2 );
	}

	public function register() {
		register_setting(
			'linkauthority_partners_settings_group',
			LINKAUTHORITY_PARTNERS_OPT_SETTINGS,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => array(),
			)
		);
	}

	/**
	 * @param mixed $input Raw submitted settings.
	 * @return array
	 */
	public function sanitize( $input ) {
		if ( ! is_array( $input ) ) {
			$input = array();
		}

		return array(
			'token'        => sanitize_text_field( (string) ( $input['token'] ?? '' ) ),
			'show_credit'  => empty( $input['show_credit'] ) ? 0 : 1,
			'report_views' => empty( $input['report_views'] ) ? 0 : 1,
		);
	}

	/**
	 * Fires the first time the settings row is created.
	 *
	 * @param string $option Option name.
	 * @param mixed  $value  Stored value.
	 */
	public function on_add( $option, $value ) {
		$this->sync_connection( array( 'token' => '' ), is_array( $value ) ? $value : array() );
	}

	/**
	 * Fires on every subsequent save.
	 *
	 * @param mixed $old Previous value.
	 * @param mixed $new Stored value.
	 */
	public function on_update( $old, $new ) {
		$this->sync_connection(
			is_array( $old ) ? $old : array(),
			is_array( $new ) ? $new : array()
		);
	}

	/**
	 * Brings the LinkAuthority side in line with a newly saved token.
	 *
	 * @param array $old Previous settings.
	 * @param array $new Stored settings.
	 */
	private function sync_connection( array $old, array $new ) {
		$old_token = isset( $old['token'] ) ? (string) $old['token'] : '';
		$new_token = isset( $new['token'] ) ? (string) $new['token'] : '';

		if ( $old_token === $new_token ) {
			return;
		}

		// Leave the old listing behind before adopting the new token.
		if ( '' !== $old_token ) {
			LinkAuthority_Partners_API::disconnect( $old_token );
		}

		if ( '' === $new_token ) {
			update_option( LINKAUTHORITY_PARTNERS_OPT_PARTNERS, array(), false );
			delete_option( LINKAUTHORITY_PARTNERS_OPT_STATUS );
			delete_option( LINKAUTHORITY_PARTNERS_OPT_LAST_SYNC );

			return;
		}

		if ( LinkAuthority_Partners_API::connect( $new_token ) ) {
			LinkAuthority_Partners_API::refresh_partners();
			LinkAuthority_Partners_API::get_status();

			return;
		}

		add_settings_error(
			LINKAUTHORITY_PARTNERS_OPT_SETTINGS,
			'linkauthority_partners_connect_failed',
			__( 'Saved, but LinkAuthority did not accept that token. Check it was copied in full from your dashboard.', 'linkauthority-partners' ),
			'error'
		);
	}
}
