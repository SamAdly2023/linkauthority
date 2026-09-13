<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Client for the Pexels API (photos + videos).
 *
 * Docs: https://www.pexels.com/api/documentation/
 */
class LAPUB_Pexels_Client {

	const PHOTOS_URL = 'https://api.pexels.com/v1/search';
	const VIDEOS_URL = 'https://api.pexels.com/videos/search';

	/** @var string */
	private $api_key;

	public function __construct( $api_key = null ) {
		$this->api_key = null === $api_key ? LAPUB_Options::get( 'pexels_api_key' ) : $api_key;
	}

	public function has_key() {
		return ! empty( $this->api_key );
	}

	/**
	 * Search photos.
	 *
	 * @return array|WP_Error Normalised list: id, url (page), src (large), src_medium, alt, photographer, photographer_url, width, height.
	 */
	public function search_photos( $query, $per_page = 5, $orientation = 'landscape' ) {
		$response = $this->request(
			self::PHOTOS_URL,
			array(
				'query'       => $query,
				'per_page'    => $per_page,
				'orientation' => $orientation,
				'size'        => 'large',
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$out = array();
		foreach ( (array) ( isset( $response['photos'] ) ? $response['photos'] : array() ) as $p ) {
			$out[] = array(
				'type'             => 'photo',
				'id'               => isset( $p['id'] ) ? (int) $p['id'] : 0,
				'url'              => isset( $p['url'] ) ? $p['url'] : '',
				'src'              => isset( $p['src']['large2x'] ) ? $p['src']['large2x'] : ( isset( $p['src']['large'] ) ? $p['src']['large'] : '' ),
				'src_medium'       => isset( $p['src']['large'] ) ? $p['src']['large'] : '',
				'alt'              => isset( $p['alt'] ) ? $p['alt'] : $query,
				'photographer'     => isset( $p['photographer'] ) ? $p['photographer'] : '',
				'photographer_url' => isset( $p['photographer_url'] ) ? $p['photographer_url'] : '',
				'width'            => isset( $p['width'] ) ? (int) $p['width'] : 0,
				'height'           => isset( $p['height'] ) ? (int) $p['height'] : 0,
				'avg_color'        => isset( $p['avg_color'] ) ? $p['avg_color'] : '',
			);
		}
		return $out;
	}

	/**
	 * Search videos.
	 *
	 * @return array|WP_Error Normalised list: id, url (page), file (mp4 link), poster, width, height, duration, user, user_url.
	 */
	public function search_videos( $query, $per_page = 5, $orientation = 'landscape' ) {
		$response = $this->request(
			self::VIDEOS_URL,
			array(
				'query'       => $query,
				'per_page'    => $per_page,
				'orientation' => $orientation,
				'size'        => 'medium',
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$out = array();
		foreach ( (array) ( isset( $response['videos'] ) ? $response['videos'] : array() ) as $v ) {
			$file = $this->pick_video_file( isset( $v['video_files'] ) ? $v['video_files'] : array() );
			if ( ! $file ) {
				continue;
			}
			$out[] = array(
				'type'     => 'video',
				'id'       => isset( $v['id'] ) ? (int) $v['id'] : 0,
				'url'      => isset( $v['url'] ) ? $v['url'] : '',
				'file'     => $file['link'],
				'poster'   => isset( $v['image'] ) ? $v['image'] : '',
				'width'    => isset( $file['width'] ) ? (int) $file['width'] : 0,
				'height'   => isset( $file['height'] ) ? (int) $file['height'] : 0,
				'duration' => isset( $v['duration'] ) ? (int) $v['duration'] : 0,
				'user'     => isset( $v['user']['name'] ) ? $v['user']['name'] : '',
				'user_url' => isset( $v['user']['url'] ) ? $v['user']['url'] : '',
			);
		}
		return $out;
	}

	/**
	 * Choose an mp4 around 1280px wide (HD but not huge) for inline playback.
	 */
	private function pick_video_file( array $files ) {
		$best      = null;
		$best_diff = PHP_INT_MAX;
		foreach ( $files as $f ) {
			if ( empty( $f['link'] ) ) {
				continue;
			}
			$type = isset( $f['file_type'] ) ? $f['file_type'] : '';
			if ( $type && false === strpos( $type, 'mp4' ) ) {
				continue;
			}
			$w    = isset( $f['width'] ) ? (int) $f['width'] : 0;
			$diff = abs( 1280 - $w );
			if ( $diff < $best_diff ) {
				$best_diff = $diff;
				$best      = $f;
			}
		}
		return $best;
	}

	/**
	 * @return true|WP_Error
	 */
	public function test_key() {
		if ( ! $this->has_key() ) {
			return new WP_Error( 'lapub_no_key', __( 'No Pexels API key entered.', 'linkauthority-publisher' ) );
		}
		$res = $this->search_photos( 'nature', 1 );
		return is_wp_error( $res ) ? $res : true;
	}

	private function request( $url, array $query ) {
		if ( ! $this->has_key() ) {
			return new WP_Error( 'lapub_no_key', __( 'Pexels API key is missing.', 'linkauthority-publisher' ) );
		}
		$response = wp_remote_get(
			add_query_arg( array_map( 'rawurlencode', $query ), $url ),
			array(
				'timeout' => 30,
				'headers' => array(
					'Authorization' => $this->api_key,
					'Accept'        => 'application/json',
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code >= 400 ) {
			$msg = is_array( $body ) && isset( $body['error'] ) ? $body['error'] : sprintf( __( 'Pexels API error (HTTP %d).', 'linkauthority-publisher' ), $code );
			return new WP_Error( 'pexels_http_' . $code, $msg );
		}
		if ( ! is_array( $body ) ) {
			return new WP_Error( 'pexels_bad_json', __( 'Pexels returned an unreadable response.', 'linkauthority-publisher' ) );
		}
		return $body;
	}
}
