<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lightweight activity log stored in a single option (last 300 entries).
 */
class MAB_Logger {

	const OPTION_KEY  = 'mab_log';
	const MAX_ENTRIES = 300;

	public static function log( $message, $level = 'info', $context = array() ) {
		$entries = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $entries ) ) {
			$entries = array();
		}
		$entries[] = array(
			'time'    => time(),
			'level'   => $level,
			'message' => (string) $message,
			'context' => $context,
		);
		if ( count( $entries ) > self::MAX_ENTRIES ) {
			$entries = array_slice( $entries, -self::MAX_ENTRIES );
		}
		update_option( self::OPTION_KEY, $entries, false );

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[Manus Auto Blogger][' . $level . '] ' . $message . ( $context ? ' ' . wp_json_encode( $context ) : '' ) );
		}
	}

	public static function info( $message, $context = array() ) {
		self::log( $message, 'info', $context );
	}

	public static function warning( $message, $context = array() ) {
		self::log( $message, 'warning', $context );
	}

	public static function error( $message, $context = array() ) {
		self::log( $message, 'error', $context );
	}

	public static function success( $message, $context = array() ) {
		self::log( $message, 'success', $context );
	}

	/**
	 * Newest first.
	 */
	public static function entries( $limit = 100 ) {
		$entries = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $entries ) ) {
			return array();
		}
		return array_reverse( array_slice( $entries, -$limit ) );
	}

	public static function clear() {
		delete_option( self::OPTION_KEY );
	}
}
