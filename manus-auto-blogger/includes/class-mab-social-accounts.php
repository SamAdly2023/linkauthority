<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Storage for connected social accounts (tokens + selected page/board/author).
 *
 * Option layout (mab_social_accounts):
 *   meta      => { user_token, expires, user_name, pages[] {id,name,access_token,ig_id,ig_username}, fb_page_id, ig_page_id }
 *   pinterest => { access_token, refresh_token, expires, username, boards[] {id,name}, board_id, board_name }
 *   linkedin  => { access_token, expires, person_urn, name, orgs[] {urn,name}, author_urn, author_name }
 */
class MAB_Social_Accounts {

	const OPTION_KEY = 'mab_social_accounts';

	public static function all() {
		$a = get_option( self::OPTION_KEY, array() );
		return is_array( $a ) ? $a : array();
	}

	public static function get( $provider ) {
		$all = self::all();
		return isset( $all[ $provider ] ) && is_array( $all[ $provider ] ) ? $all[ $provider ] : array();
	}

	public static function set( $provider, array $data ) {
		$all              = self::all();
		$all[ $provider ] = $data;
		update_option( self::OPTION_KEY, $all, false );
	}

	public static function merge( $provider, array $data ) {
		self::set( $provider, array_merge( self::get( $provider ), $data ) );
	}

	public static function disconnect( $provider ) {
		$all = self::all();
		unset( $all[ $provider ] );
		update_option( self::OPTION_KEY, $all, false );
	}

	/* ---- Convenience checks used by the UI + distributor ---- */

	public static function facebook_page() {
		$m = self::get( 'meta' );
		if ( empty( $m['fb_page_id'] ) || empty( $m['pages'] ) ) {
			return null;
		}
		foreach ( $m['pages'] as $p ) {
			if ( (string) $p['id'] === (string) $m['fb_page_id'] ) {
				return $p;
			}
		}
		return null;
	}

	public static function instagram_account() {
		$m = self::get( 'meta' );
		if ( empty( $m['ig_page_id'] ) || empty( $m['pages'] ) ) {
			return null;
		}
		foreach ( $m['pages'] as $p ) {
			if ( (string) $p['id'] === (string) $m['ig_page_id'] && ! empty( $p['ig_id'] ) ) {
				return $p;
			}
		}
		return null;
	}

	public static function pinterest_board() {
		$p = self::get( 'pinterest' );
		return ! empty( $p['access_token'] ) && ! empty( $p['board_id'] ) ? $p : null;
	}

	public static function linkedin_author() {
		$l = self::get( 'linkedin' );
		return ! empty( $l['access_token'] ) && ! empty( $l['author_urn'] ) ? $l : null;
	}

	public static function is_connected( $platform ) {
		switch ( $platform ) {
			case 'facebook':
				return (bool) self::facebook_page();
			case 'instagram':
				return (bool) self::instagram_account();
			case 'pinterest':
				return (bool) self::pinterest_board();
			case 'linkedin':
				return (bool) self::linkedin_author();
		}
		return false;
	}

	public static function platforms() {
		return array(
			'facebook'  => 'Facebook',
			'instagram' => 'Instagram',
			'pinterest' => 'Pinterest',
			'linkedin'  => 'LinkedIn',
		);
	}
}
