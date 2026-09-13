<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shares published posts to social networks.
 *
 *  Option A - Make.com webhook: POST a JSON payload (post link, featured image, per-platform captions).
 *  Option B - Direct posting through the connected Facebook / Instagram / Pinterest / LinkedIn accounts.
 *
 * Results are stored in post meta `_lapub_social_results` and listed on the "Social Posts" admin page.
 */
class LAPUB_Distributor {

	const HOOK    = 'lapub_distribute_post';
	const RESULTS = '_lapub_social_results';

	/** @var LAPUB_Distributor */
	private static $instance;

	public static function instance() {
		if ( ! self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( self::HOOK, array( $this, 'run' ), 10, 2 );
		add_action( 'lapub_post_generated', array( $this, 'on_generated' ), 10, 1 );
		add_action( 'transition_post_status', array( $this, 'on_transition' ), 10, 3 );
		add_action( 'add_meta_boxes', array( $this, 'meta_box' ) );
		add_action( 'wp_ajax_lapub_share_now', array( $this, 'ajax_share_now' ) );
		add_action( 'wp_ajax_lapub_webhook_test', array( $this, 'ajax_webhook_test' ) );
	}

	/* ------------------------------------------------------------------ */
	/* Triggers                                                            */
	/* ------------------------------------------------------------------ */

	public function on_generated( $post_id ) {
		if ( 'publish' === get_post_status( $post_id ) ) {
			$this->queue( $post_id );
		}
	}

	public function on_transition( $new, $old, $post ) {
		if ( 'publish' !== $new || 'publish' === $old || 'post' !== $post->post_type ) {
			return;
		}
		if ( ! get_post_meta( $post->ID, '_lapub_generated', true ) || get_post_meta( $post->ID, self::RESULTS, true ) ) {
			return;
		}
		$this->queue( $post->ID );
	}

	private function queue( $post_id ) {
		if ( empty( LAPUB_Options::get( 'auto_share' ) ) ) {
			return;
		}
		if ( ! wp_next_scheduled( self::HOOK, array( (int) $post_id, array() ) ) ) {
			wp_schedule_single_event( time() + 15, self::HOOK, array( (int) $post_id, array() ) );
			LAPUB_Logger::info( sprintf( 'Post #%d queued for social sharing.', $post_id ) );
		}
	}

	/* ------------------------------------------------------------------ */
	/* Main runner                                                         */
	/* ------------------------------------------------------------------ */

	/**
	 * @param int   $post_id   Post to share.
	 * @param array $platforms Platforms to (re)share; empty = every enabled platform not yet shared.
	 * @return array Results by platform.
	 */
	public function run( $post_id, $platforms = array() ) {
		$post = get_post( $post_id );
		if ( ! $post || 'publish' !== $post->post_status ) {
			LAPUB_Logger::warning( sprintf( 'Social sharing skipped: post #%d is not published.', $post_id ) );
			return array();
		}

		$o        = LAPUB_Options::all();
		$payload  = $this->payload( $post_id );
		$results  = get_post_meta( $post_id, self::RESULTS, true );
		$results  = is_array( $results ) ? $results : array();
		$explicit = ! empty( $platforms );
		$targets  = $explicit ? (array) $platforms : array_keys( LAPUB_Social_Accounts::platforms() );

		foreach ( $targets as $platform ) {
			if ( ! isset( LAPUB_Social_Accounts::platforms()[ $platform ] ) ) {
				continue;
			}
			if ( ! $explicit && empty( $o[ 'share_' . $platform ] ) ) {
				continue;
			}
			if ( ! $explicit && ! empty( $results[ $platform ]['status'] ) && 'success' === $results[ $platform ]['status'] ) {
				continue; // already shared
			}
			if ( ! LAPUB_Social_Accounts::is_connected( $platform ) ) {
				if ( $explicit ) {
					$results[ $platform ] = $this->result( 'error', '', '', __( 'Not connected.', 'linkauthority-publisher' ) );
				}
				continue;
			}

			$res = $this->publish( $platform, $payload );
			if ( is_wp_error( $res ) ) {
				$results[ $platform ] = $this->result( 'error', '', '', $res->get_error_message() );
				LAPUB_Logger::error( sprintf( '%s share failed for post #%d: %s', LAPUB_Social_Accounts::platforms()[ $platform ], $post_id, $res->get_error_message() ) );
			} else {
				$results[ $platform ] = $this->result( 'success', $res['url'], $res['id'], '' );
				LAPUB_Logger::success( sprintf( 'Shared post #%d to %s.', $post_id, LAPUB_Social_Accounts::platforms()[ $platform ] ), array( 'url' => $res['url'] ) );
			}
			update_post_meta( $post_id, self::RESULTS, $results );
		}

		// Option A - Make.com webhook (once per post unless explicitly re-run).
		if ( ! empty( $o['make_enabled'] ) && ! empty( $o['make_webhook_url'] ) && ( $explicit ? in_array( 'make', (array) $platforms, true ) : empty( $results['make'] ) || 'success' !== $results['make']['status'] ) ) {
			$hook = $this->send_webhook( $o['make_webhook_url'], $payload );
			if ( is_wp_error( $hook ) ) {
				$results['make'] = $this->result( 'error', '', '', $hook->get_error_message() );
				LAPUB_Logger::error( sprintf( 'Make.com webhook failed for post #%d: %s', $post_id, $hook->get_error_message() ) );
			} else {
				$results['make'] = $this->result( 'success', '', '', '' );
				LAPUB_Logger::success( sprintf( 'Post #%d sent to the Make.com webhook.', $post_id ) );
			}
			update_post_meta( $post_id, self::RESULTS, $results );
		}

		update_post_meta( $post_id, self::RESULTS, $results );
		update_post_meta( $post_id, '_lapub_shared_at', time() );
		return $results;
	}

	private function result( $status, $url, $id, $error ) {
		return array(
			'status' => $status,
			'url'    => $url,
			'id'     => $id,
			'error'  => $error,
			'time'   => time(),
		);
	}

	private function publish( $platform, array $p ) {
		switch ( $platform ) {
			case 'facebook':
				return LAPUB_Platform_Meta::publish_facebook( $p['social']['facebook_post'], $p['featured_image_jpeg_url'], $p['url'] );
			case 'instagram':
				return LAPUB_Platform_Meta::publish_instagram( $p['social']['instagram_caption'], $p['featured_image_jpeg_url'] );
			case 'pinterest':
				return LAPUB_Platform_Pinterest::publish( $p['social']['pinterest_title'], $p['social']['pinterest_description'], $p['featured_image_url'], $p['url'] );
			case 'linkedin':
				return LAPUB_Platform_LinkedIn::publish( $p['social']['linkedin_post'], $p['url'], $p['title'], $p['meta_description'] ? $p['meta_description'] : $p['excerpt'] );
		}
		return new WP_Error( 'lapub_unknown_platform', 'Unknown platform.' );
	}

	/* ------------------------------------------------------------------ */
	/* Payload                                                             */
	/* ------------------------------------------------------------------ */

	/**
	 * Everything a social post (or Make.com) needs, with sensible fallbacks for non-generated posts.
	 */
	public function payload( $post_id ) {
		$post  = get_post( $post_id );
		$o     = LAPUB_Options::all();
		$title = wp_strip_all_tags( get_the_title( $post_id ) );
		$url   = get_permalink( $post_id );
		$desc  = (string) get_post_meta( $post_id, '_lapub_meta_description', true );
		$exc   = $post->post_excerpt ? wp_strip_all_tags( $post->post_excerpt ) : wp_trim_words( wp_strip_all_tags( strip_shortcodes( $post->post_content ) ), 40, '…' );
		$tags  = wp_get_post_tags( $post_id, array( 'fields' => 'names' ) );
		$cats  = wp_get_post_categories( $post_id, array( 'fields' => 'names' ) );
		$hash  = $this->hashtags( $tags, 5 );

		$copy = get_post_meta( $post_id, '_lapub_social_copy', true );
		$copy = is_array( $copy ) ? $copy : array();
		$social = array(
			'facebook_post'         => ! empty( $copy['facebook_post'] ) ? $copy['facebook_post'] : $title . "\n\n" . ( $desc ? $desc : $exc ) . "\n\n" . $hash,
			'instagram_caption'     => ! empty( $copy['instagram_caption'] ) ? $copy['instagram_caption'] : $title . "\n\n" . ( $desc ? $desc : $exc ) . "\n\nRead the full article - link in bio.\n\n" . $this->hashtags( $tags, 15 ),
			'pinterest_title'       => ! empty( $copy['pinterest_title'] ) ? $copy['pinterest_title'] : mb_substr( $title, 0, 90 ),
			'pinterest_description' => ! empty( $copy['pinterest_description'] ) ? $copy['pinterest_description'] : mb_substr( ( $desc ? $desc : $exc ) . ' ' . $hash, 0, 480 ),
			'linkedin_post'         => ! empty( $copy['linkedin_post'] ) ? $copy['linkedin_post'] : $title . "\n\n" . ( $desc ? $desc : $exc ) . "\n\n" . $hash,
		);

		$img      = get_the_post_thumbnail_url( $post_id, 'full' );
		$img_jpeg = $this->jpeg_version( $post_id );

		return array(
			'event'                   => 'post_published',
			'post_id'                 => (int) $post_id,
			'title'                   => $title,
			'url'                     => $url,
			'excerpt'                 => $exc,
			'meta_description'        => $desc,
			'focus_keyword'           => (string) get_post_meta( $post_id, '_lapub_focus_keyword', true ),
			'tags'                    => array_values( $tags ),
			'categories'              => array_values( $cats ),
			'hashtags'                => $hash,
			'featured_image_url'      => $img ? $img : '',
			'featured_image_jpeg_url' => $img_jpeg ? $img_jpeg : ( $img ? $img : '' ),
			'published_at'            => get_the_date( 'c', $post_id ),
			'author'                  => get_the_author_meta( 'display_name', $post->post_author ),
			'site_name'               => $o['site_name'] ? $o['site_name'] : get_bloginfo( 'name' ),
			'site_url'                => home_url( '/' ),
			'social'                  => $social,
		);
	}

	private function hashtags( array $tags, $max ) {
		$out = array();
		foreach ( array_slice( $tags, 0, $max ) as $t ) {
			$t = preg_replace( '/[^a-z0-9]/i', '', ucwords( $t ) );
			if ( $t ) {
				$out[] = '#' . $t;
			}
		}
		return implode( ' ', $out );
	}

	/**
	 * Instagram only accepts JPEG; make (and cache) a JPEG copy of the featured image when needed.
	 */
	private function jpeg_version( $post_id ) {
		$thumb_id = get_post_thumbnail_id( $post_id );
		if ( ! $thumb_id ) {
			return '';
		}
		$mime = get_post_mime_type( $thumb_id );
		$url  = wp_get_attachment_url( $thumb_id );
		if ( 'image/jpeg' === $mime ) {
			return $url;
		}
		$cached = get_post_meta( $thumb_id, '_lapub_jpeg_url', true );
		if ( $cached ) {
			return $cached;
		}
		$path = get_attached_file( $thumb_id );
		if ( ! $path || ! file_exists( $path ) ) {
			return $url;
		}
		$editor = wp_get_image_editor( $path );
		if ( is_wp_error( $editor ) ) {
			return $url;
		}
		$editor->set_quality( 88 );
		$dest  = preg_replace( '/\.[a-z0-9]+$/i', '', $path ) . '-social.jpg';
		$saved = $editor->save( $dest, 'image/jpeg' );
		if ( is_wp_error( $saved ) ) {
			return $url;
		}
		$uploads  = wp_get_upload_dir();
		$jpeg_url = str_replace( wp_normalize_path( $uploads['basedir'] ), $uploads['baseurl'], wp_normalize_path( $saved['path'] ) );
		update_post_meta( $thumb_id, '_lapub_jpeg_url', $jpeg_url );
		return $jpeg_url;
	}

	/* ------------------------------------------------------------------ */
	/* Option A - webhook                                                  */
	/* ------------------------------------------------------------------ */

	public function send_webhook( $url, array $payload ) {
		$res = wp_remote_post(
			$url,
			array(
				'timeout' => 30,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		if ( $code >= 400 ) {
			return new WP_Error( 'lapub_webhook_http_' . $code, sprintf( 'Webhook returned HTTP %d: %s', $code, mb_substr( wp_remote_retrieve_body( $res ), 0, 200 ) ) );
		}
		return true;
	}

	public function ajax_webhook_test() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
		}
		check_ajax_referer( 'lapub_ajax', 'nonce' );
		$url = isset( $_POST['url'] ) ? esc_url_raw( wp_unslash( $_POST['url'] ) ) : LAPUB_Options::get( 'make_webhook_url' );
		if ( ! $url ) {
			wp_send_json_error( array( 'message' => __( 'Enter the webhook URL first.', 'linkauthority-publisher' ) ) );
		}
		$latest = get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => 1, 'meta_key' => '_lapub_generated', 'fields' => 'ids' ) );
		if ( ! $latest ) {
			$latest = get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => 1, 'fields' => 'ids' ) );
		}
		if ( ! $latest ) {
			wp_send_json_error( array( 'message' => __( 'Publish at least one post first so a sample payload can be sent.', 'linkauthority-publisher' ) ) );
		}
		$payload          = $this->payload( $latest[0] );
		$payload['event'] = 'test';
		$res              = $this->send_webhook( $url, $payload );
		if ( is_wp_error( $res ) ) {
			wp_send_json_error( array( 'message' => $res->get_error_message() ) );
		}
		wp_send_json_success( array( 'message' => sprintf( __( 'Sent a sample payload for "%s". Check the Make scenario.', 'linkauthority-publisher' ), $payload['title'] ) ) );
	}

	/* ------------------------------------------------------------------ */
	/* Post edit screen                                                    */
	/* ------------------------------------------------------------------ */

	public function meta_box() {
		add_meta_box( 'lapub-social', __( 'Social sharing (LinkAuthority Publisher)', 'linkauthority-publisher' ), array( $this, 'render_meta_box' ), 'post', 'side', 'default' );
	}

	public function render_meta_box( $post ) {
		$results = get_post_meta( $post->ID, self::RESULTS, true );
		$results = is_array( $results ) ? $results : array();
		$o       = LAPUB_Options::all();
		wp_nonce_field( 'lapub_ajax', 'lapub_nonce' );
		echo '<div class="lapub-sharebox" data-post="' . (int) $post->ID . '">';
		if ( 'publish' !== $post->post_status ) {
			echo '<p class="description">' . esc_html__( 'Publish the post first, then share it here.', 'linkauthority-publisher' ) . '</p>';
		}
		foreach ( LAPUB_Social_Accounts::platforms() as $key => $label ) {
			$connected = LAPUB_Social_Accounts::is_connected( $key );
			$r         = isset( $results[ $key ] ) ? $results[ $key ] : null;
			echo '<label style="display:block;margin:4px 0"><input type="checkbox" class="lapub-share-platform" value="' . esc_attr( $key ) . '"' . ( $connected ? ' checked' : ' disabled' ) . ' /> ' . esc_html( $label );
			if ( ! $connected ) {
				echo ' <span class="description">(' . esc_html__( 'not connected', 'linkauthority-publisher' ) . ')</span>';
			} elseif ( $r && 'success' === $r['status'] ) {
				echo ' &ndash; <a href="' . esc_url( $r['url'] ) . '" target="_blank" rel="noopener">' . esc_html__( 'view post', 'linkauthority-publisher' ) . '</a>';
			} elseif ( $r && 'error' === $r['status'] ) {
				echo ' &ndash; <span style="color:#b32d2e" title="' . esc_attr( $r['error'] ) . '">' . esc_html__( 'failed', 'linkauthority-publisher' ) . '</span>';
			}
			echo '</label>';
		}
		if ( ! empty( $o['make_enabled'] ) && ! empty( $o['make_webhook_url'] ) ) {
			$r = isset( $results['make'] ) ? $results['make'] : null;
			echo '<label style="display:block;margin:4px 0"><input type="checkbox" class="lapub-share-platform" value="make" checked /> Make.com webhook' . ( $r && 'success' === $r['status'] ? ' &ndash; ' . esc_html__( 'sent', 'linkauthority-publisher' ) : '' ) . '</label>';
		}
		echo '<p><button type="button" class="button button-primary" id="lapub-share-now"' . ( 'publish' !== $post->post_status ? ' disabled' : '' ) . '>' . esc_html__( 'Share now', 'linkauthority-publisher' ) . '</button> <span class="lapub-share-msg"></span></p>';
		echo '<p class="description"><a href="' . esc_url( admin_url( 'admin.php?page=linkauthority-publisher-social' ) ) . '">' . esc_html__( 'All shared posts', 'linkauthority-publisher' ) . '</a></p>';
		echo '</div>';
		echo '<script>(function($){$("#lapub-share-now").on("click",function(){var b=$(this).prop("disabled",true),box=b.closest(".lapub-sharebox"),p=[];box.find(".lapub-share-platform:checked").each(function(){p.push(this.value)});box.find(".lapub-share-msg").text("' . esc_js( __( 'Sharing…', 'linkauthority-publisher' ) ) . '");$.post(ajaxurl,{action:"lapub_share_now",nonce:$("#lapub_nonce").val(),post_id:box.data("post"),platforms:p},function(r){b.prop("disabled",false);box.find(".lapub-share-msg").text(r.success?r.data.message:(r.data&&r.data.message?r.data.message:"Error"));if(r.success){setTimeout(function(){location.reload()},1200)}})})})(jQuery);</script>';
	}

	public function ajax_share_now() {
		if ( ! current_user_can( 'publish_posts' ) ) {
			wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
		}
		check_ajax_referer( 'lapub_ajax', 'nonce' );
		$post_id   = isset( $_POST['post_id'] ) ? (int) $_POST['post_id'] : 0;
		$platforms = isset( $_POST['platforms'] ) ? array_map( 'sanitize_key', (array) $_POST['platforms'] ) : array(); // phpcs:ignore
		if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
			wp_send_json_error( array( 'message' => 'Invalid post.' ) );
		}
		if ( ! $platforms ) {
			wp_send_json_error( array( 'message' => __( 'Select at least one platform.', 'linkauthority-publisher' ) ) );
		}
		$results = $this->run( $post_id, $platforms );
		$ok      = 0;
		$errors  = array();
		foreach ( $platforms as $p ) {
			if ( isset( $results[ $p ] ) && 'success' === $results[ $p ]['status'] ) {
				$ok++;
			} elseif ( isset( $results[ $p ] ) ) {
				$errors[] = ucfirst( $p ) . ': ' . $results[ $p ]['error'];
			}
		}
		$msg = sprintf( _n( '%d platform shared.', '%d platforms shared.', $ok, 'linkauthority-publisher' ), $ok );
		if ( $errors ) {
			$msg .= ' ' . implode( ' | ', $errors );
		}
		wp_send_json_success( array( 'message' => $msg, 'results' => $results ) );
	}
}
