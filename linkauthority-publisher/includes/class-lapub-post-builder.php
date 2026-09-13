<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Turns the structured article returned by Manus into a styled WordPress post.
 */
class LAPUB_Post_Builder {

	/** @var array Structured article data. */
	private $data;

	/** @var array Pexels ids already used in this post. */
	private $used_media = array();

	/** @var array Attribution list for the footer. */
	private $credits = array();

	/** @var LAPUB_Pexels_Client */
	private $pexels;

	public function __construct( array $data ) {
		$this->data   = $data;
		$this->pexels = new LAPUB_Pexels_Client();
	}

	/**
	 * Allowed HTML for Manus-authored fragments.
	 */
	public static function allowed_fragment_html() {
		$a = array( 'class' => true, 'id' => true );
		return array(
			'p'          => $a,
			'h3'         => $a,
			'h4'         => $a,
			'ul'         => $a,
			'ol'         => $a,
			'li'         => $a,
			'strong'     => $a,
			'b'          => $a,
			'em'         => $a,
			'i'          => $a,
			'a'          => array( 'href' => true, 'title' => true, 'target' => true, 'rel' => true, 'class' => true ),
			'blockquote' => array( 'cite' => true, 'class' => true ),
			'table'      => $a,
			'thead'      => $a,
			'tbody'      => $a,
			'tr'         => $a,
			'th'         => array( 'scope' => true, 'class' => true, 'colspan' => true ),
			'td'         => array( 'class' => true, 'colspan' => true ),
			'br'         => array(),
			'span'       => $a,
			'code'       => $a,
		);
	}

	private function frag( $html ) {
		$html = (string) $html;
		// Strip any headings the model was told not to use.
		$html = preg_replace( '#<h[12][^>]*>(.*?)</h[12]>#is', '<h3>$1</h3>', $html );
		$html = wp_kses( $html, self::allowed_fragment_html() );
		// External links: open in new tab, nofollow-free but noopener.
		$html = preg_replace_callback(
			'#<a\s+([^>]*?)href="(https?://[^"]+)"([^>]*)>#i',
			function ( $m ) {
				$href = $m[2];
				$home = wp_parse_url( home_url(), PHP_URL_HOST );
				$host = wp_parse_url( $href, PHP_URL_HOST );
				if ( $host && $home && false === strpos( $host, $home ) ) {
					$attrs = preg_replace( '/\s*(target|rel)="[^"]*"/i', '', $m[1] . ' ' . $m[3] );
					return '<a ' . trim( $attrs ) . ' href="' . esc_url( $href ) . '" target="_blank" rel="noopener">';
				}
				return $m[0];
			},
			$html
		);
		return trim( $html );
	}

	/**
	 * Plain-text word count across all body fields.
	 */
	public function word_count() {
		$d     = $this->data;
		$parts = array( isset( $d['intro_html'] ) ? $d['intro_html'] : '', isset( $d['conclusion_html'] ) ? $d['conclusion_html'] : '' );
		foreach ( (array) ( isset( $d['sections'] ) ? $d['sections'] : array() ) as $s ) {
			$parts[] = isset( $s['html'] ) ? $s['html'] : '';
			$parts[] = isset( $s['callout'] ) ? $s['callout'] : '';
		}
		foreach ( (array) ( isset( $d['faq'] ) ? $d['faq'] : array() ) as $f ) {
			$parts[] = isset( $f['question'] ) ? $f['question'] : '';
			$parts[] = isset( $f['answer_html'] ) ? $f['answer_html'] : '';
		}
		foreach ( (array) ( isset( $d['key_takeaways'] ) ? $d['key_takeaways'] : array() ) as $t ) {
			$parts[] = $t;
		}
		$text = wp_strip_all_tags( implode( ' ', $parts ) );
		return str_word_count( $text );
	}

	/**
	 * Create the WordPress post.
	 *
	 * @param string $featured_image_url Optional Manus attachment URL for the featured image.
	 * @param array  $meta               Extra meta (task ids etc).
	 * @return int|WP_Error Post ID.
	 */
	public function create_post( $featured_image_url = '', array $meta = array() ) {
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$o = LAPUB_Options::all();
		$d = $this->data;

		$title = isset( $d['title'] ) ? sanitize_text_field( $d['title'] ) : '';
		if ( ! $title ) {
			return new WP_Error( 'lapub_no_title', __( 'Manus returned an article without a title.', 'linkauthority-publisher' ) );
		}

		$author = (int) $o['post_author'];
		if ( ! $author || ! get_userdata( $author ) ) {
			$admins = get_users( array( 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ) );
			$author = $admins ? (int) $admins[0] : 1;
		}

		// 1. Insert a draft shell so media can be attached to it.
		$post_id = wp_insert_post(
			array(
				'post_title'   => $title,
				'post_name'    => isset( $d['slug'] ) ? sanitize_title( $d['slug'] ) : sanitize_title( $title ),
				'post_status'  => 'draft',
				'post_type'    => 'post',
				'post_author'  => $author,
				'post_excerpt' => isset( $d['excerpt'] ) ? sanitize_text_field( $d['excerpt'] ) : '',
				'post_content' => '',
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		// 2. Featured image from Manus.
		if ( $featured_image_url ) {
			$thumb_id = $this->sideload_remote_file( $featured_image_url, $post_id, $title );
			if ( is_wp_error( $thumb_id ) ) {
				LAPUB_Logger::warning( 'Featured image could not be saved: ' . $thumb_id->get_error_message() );
			} else {
				set_post_thumbnail( $post_id, $thumb_id );
				update_post_meta( $thumb_id, '_wp_attachment_image_alt', $title );
			}
		}

		// 3. Build content (fetches Pexels media as it goes).
		$content = $this->build_html( $post_id );

		// 4. Fallback featured image from Pexels if Manus image failed.
		if ( ! has_post_thumbnail( $post_id ) && $this->pexels->has_key() && ! empty( $o['use_pexels_photos'] ) ) {
			$query  = isset( $d['focus_keyword'] ) ? $d['focus_keyword'] : $title;
			$photos = $this->pexels->search_photos( $query, 3 );
			if ( ! is_wp_error( $photos ) && $photos ) {
				$thumb_id = $this->sideload_remote_file( $photos[0]['src'], $post_id, $title );
				if ( ! is_wp_error( $thumb_id ) ) {
					set_post_thumbnail( $post_id, $thumb_id );
					$this->add_credit( $photos[0] );
					LAPUB_Logger::info( 'Used a Pexels photo as the featured image fallback.' );
				}
			}
		}

		// 5. Taxonomies.
		$this->assign_terms( $post_id );

		// 6. Meta for SEO plugins + our own bookkeeping.
		$meta_desc = isset( $d['meta_description'] ) ? sanitize_text_field( $d['meta_description'] ) : '';
		$focus_kw  = isset( $d['focus_keyword'] ) ? sanitize_text_field( $d['focus_keyword'] ) : '';
		update_post_meta( $post_id, '_lapub_generated', 1 );
		update_post_meta( $post_id, '_lapub_meta_description', $meta_desc );
		update_post_meta( $post_id, '_lapub_focus_keyword', $focus_kw );
		update_post_meta( $post_id, '_lapub_faq', $this->faq_for_schema() );
		update_post_meta( $post_id, '_lapub_word_count', $this->word_count() );
		if ( ! empty( $d['social'] ) && is_array( $d['social'] ) ) {
			update_post_meta( $post_id, '_lapub_social_copy', array_map( 'sanitize_textarea_field', $d['social'] ) );
		}
		foreach ( $meta as $k => $v ) {
			update_post_meta( $post_id, '_lapub_' . sanitize_key( $k ), $v );
		}
		if ( $meta_desc ) {
			update_post_meta( $post_id, '_yoast_wpseo_metadesc', $meta_desc );
			update_post_meta( $post_id, 'rank_math_description', $meta_desc );
		}
		if ( $focus_kw ) {
			update_post_meta( $post_id, '_yoast_wpseo_focuskw', $focus_kw );
			update_post_meta( $post_id, 'rank_math_focus_keyword', $focus_kw );
		}

		// 7. Final content + status.
		$status = in_array( $o['post_status'], array( 'publish', 'draft', 'pending' ), true ) ? $o['post_status'] : 'draft';
		$update = wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => $content,
				'post_status'  => $status,
			),
			true
		);
		if ( is_wp_error( $update ) ) {
			return $update;
		}

		return $post_id;
	}

	/**
	 * Full article HTML wrapped in a Custom HTML block so wpautop leaves it alone.
	 */
	private function build_html( $post_id ) {
		$o        = LAPUB_Options::all();
		$d        = $this->data;
		$sections = (array) ( isset( $d['sections'] ) ? $d['sections'] : array() );
		$media_ok = $this->pexels->has_key();
		$max_med  = max( 0, (int) $o['max_pexels_media'] );
		$used     = 0;
		$videos   = 0;

		$h   = array();
		$h[] = '<div class="lapub-post">';

		// Intro.
		if ( ! empty( $d['intro_html'] ) ) {
			$h[] = '<div class="lapub-intro">' . $this->frag( $d['intro_html'] ) . '</div>';
		}

		// Key takeaways.
		$takeaways = array_filter( array_map( 'trim', (array) ( isset( $d['key_takeaways'] ) ? $d['key_takeaways'] : array() ) ) );
		if ( $takeaways ) {
			$h[] = '<aside class="lapub-takeaways">';
			$h[] = '<div class="lapub-takeaways__head"><span class="lapub-icon">&#9889;</span><h2>' . esc_html__( 'Key Takeaways', 'linkauthority-publisher' ) . '</h2></div>';
			$h[] = '<ul>';
			foreach ( $takeaways as $t ) {
				$h[] = '<li>' . esc_html( $t ) . '</li>';
			}
			$h[] = '</ul></aside>';
		}

		// Table of contents.
		if ( count( $sections ) > 2 ) {
			$h[] = '<nav class="lapub-toc" aria-label="' . esc_attr__( 'Table of contents', 'linkauthority-publisher' ) . '">';
			$h[] = '<div class="lapub-toc__head"><span class="lapub-icon">&#128203;</span><h2>' . esc_html__( 'In this article', 'linkauthority-publisher' ) . '</h2></div><ol>';
			foreach ( $sections as $i => $s ) {
				$h[] = '<li><a href="#lapub-section-' . ( $i + 1 ) . '">' . esc_html( isset( $s['heading'] ) ? $s['heading'] : '' ) . '</a></li>';
			}
			$h[] = '</ol></nav>';
		}

		// Sections.
		foreach ( $sections as $i => $s ) {
			$n       = $i + 1;
			$heading = isset( $s['heading'] ) ? sanitize_text_field( $s['heading'] ) : '';
			$h[]     = '<section class="lapub-section" id="lapub-section-' . $n . '">';
			$h[]     = '<h2 class="lapub-section__title"><span class="lapub-section__num">' . str_pad( $n, 2, '0', STR_PAD_LEFT ) . '</span>' . esc_html( $heading ) . '</h2>';

			// Media.
			$mtype = isset( $s['media_type'] ) ? $s['media_type'] : 'none';
			$query = isset( $s['media_query'] ) ? trim( $s['media_query'] ) : '';
			if ( $media_ok && $query && 'none' !== $mtype && $used < $max_med ) {
				$figure = '';
				if ( 'video' === $mtype && ! empty( $o['use_pexels_videos'] ) && $videos < 2 ) {
					$figure = $this->video_figure( $query );
					if ( $figure ) {
						$videos++;
					}
				}
				if ( ! $figure && ! empty( $o['use_pexels_photos'] ) ) {
					$figure = $this->photo_figure( $query, $post_id, $heading, 0 === $i % 2 ? 'left' : 'right' );
				}
				if ( $figure ) {
					$h[] = $figure;
					$used++;
				}
			}

			$h[] = '<div class="lapub-section__body">' . $this->frag( isset( $s['html'] ) ? $s['html'] : '' ) . '</div>';

			$stat_v = isset( $s['stat_value'] ) ? trim( $s['stat_value'] ) : '';
			$stat_l = isset( $s['stat_label'] ) ? trim( $s['stat_label'] ) : '';
			if ( $stat_v && $stat_l ) {
				$h[] = '<div class="lapub-stat"><span class="lapub-stat__value">' . esc_html( $stat_v ) . '</span><span class="lapub-stat__label">' . esc_html( $stat_l ) . '</span></div>';
			}

			$callout = isset( $s['callout'] ) ? trim( $s['callout'] ) : '';
			if ( $callout ) {
				$h[] = '<div class="lapub-callout"><span class="lapub-callout__icon">&#128161;</span><div class="lapub-callout__body"><strong>' . esc_html__( 'Pro tip', 'linkauthority-publisher' ) . '</strong><p>' . esc_html( $callout ) . '</p></div></div>';
			}

			$h[] = '</section>';
		}

		// FAQ.
		$faq = (array) ( isset( $d['faq'] ) ? $d['faq'] : array() );
		if ( $faq ) {
			$h[] = '<section class="lapub-faq" id="lapub-faq">';
			$h[] = '<h2 class="lapub-section__title"><span class="lapub-section__num">?</span>' . esc_html__( 'Frequently Asked Questions', 'linkauthority-publisher' ) . '</h2>';
			foreach ( $faq as $k => $f ) {
				$q = isset( $f['question'] ) ? sanitize_text_field( $f['question'] ) : '';
				$a = isset( $f['answer_html'] ) ? $this->frag( $f['answer_html'] ) : '';
				if ( ! $q || ! $a ) {
					continue;
				}
				if ( false === strpos( $a, '<p' ) ) {
					$a = '<p>' . $a . '</p>';
				}
				$h[] = '<details class="lapub-faq__item"' . ( 0 === $k ? ' open' : '' ) . '><summary>' . esc_html( $q ) . '<span class="lapub-faq__chev" aria-hidden="true"></span></summary><div class="lapub-faq__answer">' . $a . '</div></details>';
			}
			$h[] = '</section>';
		}

		// Conclusion.
		if ( ! empty( $d['conclusion_html'] ) ) {
			$h[] = '<section class="lapub-conclusion"><h2 class="lapub-section__title"><span class="lapub-section__num">&#10003;</span>' . esc_html__( 'Final Thoughts', 'linkauthority-publisher' ) . '</h2>' . $this->frag( $d['conclusion_html'] ) . '</section>';
		}

		// CTA + social.
		$h[] = $this->cta_html();

		// Credits.
		if ( $this->credits ) {
			$h[] = '<div class="lapub-credits"><span>' . esc_html__( 'Media credits:', 'linkauthority-publisher' ) . '</span> ' . implode( ' &middot; ', $this->credits ) . '</div>';
		}

		$h[] = '</div>';

		$html = implode( "\n", $h );
		return "<!-- wp:html -->\n" . $html . "\n<!-- /wp:html -->";
	}

	private function photo_figure( $query, $post_id, $alt, $align = 'left' ) {
		$o      = LAPUB_Options::all();
		$photos = $this->pexels->search_photos( $query, 6 );
		if ( is_wp_error( $photos ) ) {
			LAPUB_Logger::warning( 'Pexels photo search failed: ' . $photos->get_error_message(), array( 'query' => $query ) );
			return '';
		}
		$photo = null;
		foreach ( $photos as $p ) {
			if ( ! isset( $this->used_media[ 'p' . $p['id'] ] ) ) {
				$photo = $p;
				break;
			}
		}
		if ( ! $photo ) {
			return '';
		}
		$this->used_media[ 'p' . $photo['id'] ] = true;

		$src    = $photo['src'];
		$srcset = '';
		$alt    = $photo['alt'] ? $photo['alt'] : $alt;

		if ( ! empty( $o['store_pexels_locally'] ) ) {
			$att_id = $this->sideload_remote_file( $photo['src'], $post_id, $alt );
			if ( ! is_wp_error( $att_id ) ) {
				update_post_meta( $att_id, '_wp_attachment_image_alt', $alt );
				update_post_meta( $att_id, '_lapub_pexels_credit', 'Photo by ' . $photo['photographer'] . ' on Pexels' );
				$local = wp_get_attachment_image_src( $att_id, 'large' );
				if ( $local ) {
					$src    = $local[0];
					$srcset = (string) wp_get_attachment_image_srcset( $att_id, 'large' );
				}
			} else {
				LAPUB_Logger::warning( 'Could not store Pexels photo locally, hotlinking instead: ' . $att_id->get_error_message() );
			}
		}

		$this->add_credit( $photo );

		$fig  = '<figure class="lapub-media lapub-media--photo lapub-media--' . esc_attr( $align ) . '">';
		$fig .= '<img src="' . esc_url( $src ) . '"' . ( $srcset ? ' srcset="' . esc_attr( $srcset ) . '" sizes="(max-width: 782px) 100vw, 800px"' : '' ) . ' alt="' . esc_attr( $alt ) . '" loading="lazy" decoding="async" />';
		$fig .= '<figcaption>' . sprintf(
			/* translators: 1: photographer link, 2: Pexels link */
			esc_html__( 'Photo by %1$s on %2$s', 'linkauthority-publisher' ),
			'<a href="' . esc_url( $photo['photographer_url'] ) . '" target="_blank" rel="noopener nofollow">' . esc_html( $photo['photographer'] ) . '</a>',
			'<a href="' . esc_url( $photo['url'] ) . '" target="_blank" rel="noopener nofollow">Pexels</a>'
		) . '</figcaption></figure>';
		return $fig;
	}

	private function video_figure( $query ) {
		$videos = $this->pexels->search_videos( $query, 5 );
		if ( is_wp_error( $videos ) ) {
			LAPUB_Logger::warning( 'Pexels video search failed: ' . $videos->get_error_message(), array( 'query' => $query ) );
			return '';
		}
		$video = null;
		foreach ( $videos as $v ) {
			if ( ! isset( $this->used_media[ 'v' . $v['id'] ] ) && $v['duration'] <= 60 ) {
				$video = $v;
				break;
			}
		}
		if ( ! $video && $videos ) {
			$video = $videos[0];
		}
		if ( ! $video ) {
			return '';
		}
		$this->used_media[ 'v' . $video['id'] ] = true;
		$this->add_credit( $video );

		$fig  = '<figure class="lapub-media lapub-media--video">';
		$fig .= '<video controls muted loop playsinline preload="metadata" poster="' . esc_url( $video['poster'] ) . '">';
		$fig .= '<source src="' . esc_url( $video['file'] ) . '" type="video/mp4" />';
		$fig .= '</video>';
		$fig .= '<figcaption>' . sprintf(
			/* translators: 1: videographer link, 2: Pexels link */
			esc_html__( 'Video by %1$s on %2$s', 'linkauthority-publisher' ),
			'<a href="' . esc_url( $video['user_url'] ) . '" target="_blank" rel="noopener nofollow">' . esc_html( $video['user'] ) . '</a>',
			'<a href="' . esc_url( $video['url'] ) . '" target="_blank" rel="noopener nofollow">Pexels</a>'
		) . '</figcaption></figure>';
		return $fig;
	}

	private function add_credit( array $item ) {
		if ( 'video' === $item['type'] ) {
			$this->credits[] = '<a href="' . esc_url( $item['url'] ) . '" target="_blank" rel="noopener nofollow">' . esc_html( $item['user'] ) . '</a>';
		} else {
			$this->credits[] = '<a href="' . esc_url( $item['url'] ) . '" target="_blank" rel="noopener nofollow">' . esc_html( $item['photographer'] ) . '</a>';
		}
	}

	private function cta_html() {
		$o    = LAPUB_Options::all();
		$d    = $this->data;
		$cta  = isset( $d['cta'] ) && is_array( $d['cta'] ) ? $d['cta'] : array();
		$site = $o['site_url'] ? $o['site_url'] : home_url( '/' );
		$name = $o['site_name'] ? $o['site_name'] : get_bloginfo( 'name' );

		$heading = ! empty( $cta['heading'] ) ? $cta['heading'] : sprintf( __( 'Ready to take the next step with %s?', 'linkauthority-publisher' ), $name );
		$text    = ! empty( $cta['text'] ) ? $cta['text'] : '';
		$label   = ! empty( $cta['button_label'] ) ? $cta['button_label'] : __( 'Visit our website', 'linkauthority-publisher' );
		$url     = ! empty( $cta['button_url'] ) ? $cta['button_url'] : $site;
		// Never let the CTA button point somewhere odd.
		$home_host = wp_parse_url( $site, PHP_URL_HOST );
		$url_host  = wp_parse_url( $url, PHP_URL_HOST );
		if ( ! $url_host || ( $home_host && $url_host !== $home_host ) ) {
			$url = $site;
		}

		$icons = array(
			'facebook'  => 'f',
			'instagram' => '&#9711;',
			'twitter'   => 'X',
			'linkedin'  => 'in',
			'youtube'   => '&#9654;',
			'tiktok'    => '&#9835;',
			'pinterest' => 'P',
		);

		$h   = array();
		$h[] = '<div class="lapub-cta">';
		$h[] = '<div class="lapub-cta__glow"></div>';
		$h[] = '<h2>' . esc_html( $heading ) . '</h2>';
		if ( $text ) {
			$h[] = '<p>' . esc_html( $text ) . '</p>';
		}
		$h[] = '<a class="lapub-btn" href="' . esc_url( $url ) . '">' . esc_html( $label ) . ' <span aria-hidden="true">&rarr;</span></a>';
		$socials = LAPUB_Options::social_links();
		if ( $socials ) {
			$h[] = '<div class="lapub-social"><span class="lapub-social__label">' . esc_html__( 'Follow us', 'linkauthority-publisher' ) . '</span>';
			foreach ( $socials as $key => $s ) {
				$h[] = '<a class="lapub-social__link lapub-social__link--' . esc_attr( $key ) . '" href="' . esc_url( $s['url'] ) . '" target="_blank" rel="noopener" title="' . esc_attr( $s['label'] ) . '"><span class="lapub-social__icon">' . $icons[ $key ] . '</span><span class="lapub-social__name">' . esc_html( $s['label'] ) . '</span></a>';
			}
			$h[] = '</div>';
		}
		$h[] = '</div>';
		return implode( "\n", $h );
	}

	private function faq_for_schema() {
		$out = array();
		foreach ( (array) ( isset( $this->data['faq'] ) ? $this->data['faq'] : array() ) as $f ) {
			if ( empty( $f['question'] ) || empty( $f['answer_html'] ) ) {
				continue;
			}
			$out[] = array(
				'q' => sanitize_text_field( $f['question'] ),
				'a' => wp_strip_all_tags( $f['answer_html'] ),
			);
		}
		return $out;
	}

	private function assign_terms( $post_id ) {
		$o = LAPUB_Options::all();
		$d = $this->data;

		$cat_id = (int) $o['post_category'];
		if ( ! $cat_id && ! empty( $d['category'] ) ) {
			$name = sanitize_text_field( $d['category'] );
			$term = get_term_by( 'name', $name, 'category' );
			if ( $term ) {
				$cat_id = (int) $term->term_id;
			} else {
				$created = wp_insert_term( $name, 'category' );
				if ( ! is_wp_error( $created ) ) {
					$cat_id = (int) $created['term_id'];
				}
			}
		}
		if ( $cat_id ) {
			wp_set_post_categories( $post_id, array( $cat_id ) );
		}

		$tags = array_filter( array_map( 'sanitize_text_field', (array) ( isset( $d['tags'] ) ? $d['tags'] : array() ) ) );
		if ( $tags ) {
			wp_set_post_tags( $post_id, array_slice( $tags, 0, 10 ), false );
		}
	}

	/**
	 * Download a remote file into the media library and attach it to the post.
	 *
	 * @return int|WP_Error Attachment ID.
	 */
	public function sideload_remote_file( $url, $post_id, $description = '' ) {
		$tmp = download_url( $url, 120 );
		if ( is_wp_error( $tmp ) ) {
			return $tmp;
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );
		$name = $path ? wp_basename( $path ) : 'lapub-image';
		$name = sanitize_file_name( $name );
		if ( ! preg_match( '/\.(jpe?g|png|webp|gif)$/i', $name ) ) {
			$type = wp_get_image_mime( $tmp );
			$ext  = 'jpg';
			if ( 'image/png' === $type ) {
				$ext = 'png';
			} elseif ( 'image/webp' === $type ) {
				$ext = 'webp';
			} elseif ( 'image/gif' === $type ) {
				$ext = 'gif';
			}
			$name = preg_replace( '/[^a-z0-9\-_]+/i', '-', $name ) . '.' . $ext;
		}
		$name = 'lapub-' . substr( md5( $url ), 0, 8 ) . '-' . $name;

		$file_array = array(
			'name'     => $name,
			'tmp_name' => $tmp,
		);
		$att_id = media_handle_sideload( $file_array, $post_id, $description );
		if ( is_wp_error( $att_id ) ) {
			@unlink( $tmp ); // phpcs:ignore
			return $att_id;
		}
		return (int) $att_id;
	}
}
