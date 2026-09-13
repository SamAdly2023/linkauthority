<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Central access to plugin settings with sane defaults.
 */
class LAPUB_Options {

	const OPTION_KEY = 'lapub_settings';

	public static function defaults() {
		return array(
			// API keys.
			'manus_api_key'        => '',
			'pexels_api_key'       => '',
			'manus_agent_profile'  => 'standard',
			'manus_locale'         => '',

			// Schedule.
			'enabled'              => 0,
			'frequency'            => 'daily',
			'run_hour'             => 9,
			'post_status'          => 'publish',
			'post_author'          => 1,
			'post_category'        => 0,
			'min_words'            => 2500,
			'max_words'            => 3000,

			// Business profile.
			'site_name'            => '',
			'site_url'             => '',
			'business_description' => '',
			'target_audience'      => '',
			'focus_keywords'       => '',
			'tone'                 => 'friendly-expert',
			'custom_instructions'  => '',
			'social_facebook'      => '',
			'social_instagram'     => '',
			'social_twitter'       => '',
			'social_linkedin'      => '',
			'social_youtube'       => '',
			'social_tiktok'        => '',
			'social_pinterest'     => '',

			// Media & style.
			'use_pexels_photos'    => 1,
			'use_pexels_videos'    => 1,
			'max_pexels_media'     => 6,
			'store_pexels_locally' => 1,
			'generate_featured'    => 1,
			'accent_color'         => '#6d28d9',
			'accent_color_2'       => '#0ea5e9',
			'add_schema'           => 1,
			'add_meta_description' => 1,

			// Social sharing.
			'cloud_url'            => 'https://www.linkauthority.live/connect',
			'cloud_license'        => '',
			'auto_share'           => 0,
			'share_facebook'       => 1,
			'share_instagram'      => 1,
			'share_pinterest'      => 1,
			'share_linkedin'       => 1,
			'make_enabled'         => 0,
			'make_webhook_url'     => '',
			'meta_app_id'          => '',
			'meta_app_secret'      => '',
			'meta_config_id'       => '',
			'pinterest_app_id'     => '',
			'pinterest_app_secret' => '',
			'linkedin_client_id'   => '',
			'linkedin_client_secret' => '',
			'linkedin_org_scopes'  => 0,
			'linkedin_api_version' => '202601',
		);
	}

	public static function all() {
		$saved = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		return wp_parse_args( $saved, self::defaults() );
	}

	public static function get( $key, $default = null ) {
		$all = self::all();
		if ( array_key_exists( $key, $all ) ) {
			return $all[ $key ];
		}
		return $default;
	}

	public static function update( array $values ) {
		$current = self::all();
		$merged  = array_merge( $current, $values );
		update_option( self::OPTION_KEY, $merged, false );
		return $merged;
	}

	/**
	 * Returns only the social links that have been filled in.
	 */
	public static function social_links() {
		$all   = self::all();
		$map   = array(
			'facebook'  => 'Facebook',
			'instagram' => 'Instagram',
			'twitter'   => 'X (Twitter)',
			'linkedin'  => 'LinkedIn',
			'youtube'   => 'YouTube',
			'tiktok'    => 'TikTok',
			'pinterest' => 'Pinterest',
		);
		$links = array();
		foreach ( $map as $key => $label ) {
			$url = trim( (string) $all[ 'social_' . $key ] );
			if ( $url ) {
				$links[ $key ] = array(
					'label' => $label,
					'url'   => esc_url_raw( $url ),
				);
			}
		}
		return $links;
	}

	/**
	 * Validate a #rgb / #rrggbb colour (sanitize_hex_color() is not always loaded).
	 */
	public static function hex( $color, $default = '' ) {
		$color = trim( (string) $color );
		return preg_match( '/^#([A-Fa-f0-9]{3}){1,2}$/', $color ) ? strtolower( $color ) : $default;
	}

	public static function frequencies() {
		return array(
			'daily'            => __( 'Every day', 'linkauthority-publisher' ),
			'lapub_every_2_days' => __( 'Every 2 days', 'linkauthority-publisher' ),
			'lapub_every_3_days' => __( 'Every 3 days', 'linkauthority-publisher' ),
			'weekly'           => __( 'Once a week', 'linkauthority-publisher' ),
		);
	}

	public static function tones() {
		return array(
			'friendly-expert' => __( 'Friendly expert (recommended)', 'linkauthority-publisher' ),
			'professional'    => __( 'Professional & authoritative', 'linkauthority-publisher' ),
			'conversational'  => __( 'Conversational & casual', 'linkauthority-publisher' ),
			'inspirational'   => __( 'Inspirational & story-driven', 'linkauthority-publisher' ),
			'educational'     => __( 'Educational / how-to', 'linkauthority-publisher' ),
			'witty'           => __( 'Witty & playful', 'linkauthority-publisher' ),
		);
	}
}
