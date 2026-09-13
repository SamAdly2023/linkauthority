<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Front-end output for generated posts: styles, schema.org JSON-LD and meta description.
 */
class LAPUB_Frontend {

	/** @var LAPUB_Frontend */
	private static $instance;

	public static function instance() {
		if ( ! self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'wp_head', array( $this, 'head_output' ), 5 );
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_editor' ) );
	}

	private function is_generated_post() {
		if ( ! is_singular( 'post' ) ) {
			return false;
		}
		return (bool) get_post_meta( get_queried_object_id(), '_lapub_generated', true );
	}

	public function enqueue() {
		if ( ! $this->is_generated_post() ) {
			return;
		}
		wp_enqueue_style( 'lapub-frontend', LAPUB_URL . 'assets/css/frontend.css', array(), LAPUB_VERSION );
		wp_add_inline_style( 'lapub-frontend', self::accent_css() );
	}

	/**
	 * enqueue_block_assets also fires inside the block-editor iframe, so generated posts look right while editing.
	 */
	public function enqueue_editor() {
		if ( ! is_admin() ) {
			return;
		}
		wp_enqueue_style( 'lapub-frontend-editor', LAPUB_URL . 'assets/css/frontend.css', array(), LAPUB_VERSION );
		wp_add_inline_style( 'lapub-frontend-editor', self::accent_css() );
	}

	public static function accent_css() {
		$o  = LAPUB_Options::all();
		$c1 = LAPUB_Options::hex( $o['accent_color'] );
		$c2 = LAPUB_Options::hex( $o['accent_color_2'] );
		$c1 = $c1 ? $c1 : '#6d28d9';
		$c2 = $c2 ? $c2 : '#0ea5e9';
		return ':root{--lapub-accent:' . $c1 . ';--lapub-accent-2:' . $c2 . ';--lapub-accent-rgb:' . self::hex_to_rgb( $c1 ) . ';--lapub-accent-2-rgb:' . self::hex_to_rgb( $c2 ) . ';}';
	}

	private static function hex_to_rgb( $hex ) {
		$hex = ltrim( $hex, '#' );
		if ( 3 === strlen( $hex ) ) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}
		$r = hexdec( substr( $hex, 0, 2 ) );
		$g = hexdec( substr( $hex, 2, 2 ) );
		$b = hexdec( substr( $hex, 4, 2 ) );
		return $r . ',' . $g . ',' . $b;
	}

	/**
	 * Meta description (only when no major SEO plugin is handling it) + JSON-LD.
	 */
	public function head_output() {
		if ( ! $this->is_generated_post() ) {
			return;
		}
		$post_id = get_queried_object_id();
		$o       = LAPUB_Options::all();

		$seo_plugin_active = defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'AIOSEO_VERSION' ) || defined( 'SEOPRESS_VERSION' );

		if ( ! empty( $o['add_meta_description'] ) && ! $seo_plugin_active ) {
			$desc = get_post_meta( $post_id, '_lapub_meta_description', true );
			if ( $desc ) {
				echo '<meta name="description" content="' . esc_attr( $desc ) . '" />' . "\n";
			}
		}

		if ( empty( $o['add_schema'] ) ) {
			return;
		}

		$post   = get_post( $post_id );
		$author = get_userdata( $post->post_author );
		$image  = get_the_post_thumbnail_url( $post_id, 'full' );

		$article = array(
			'@context'         => 'https://schema.org',
			'@type'            => 'BlogPosting',
			'headline'         => wp_strip_all_tags( get_the_title( $post_id ) ),
			'description'      => get_post_meta( $post_id, '_lapub_meta_description', true ),
			'datePublished'    => get_the_date( 'c', $post_id ),
			'dateModified'     => get_the_modified_date( 'c', $post_id ),
			'mainEntityOfPage' => get_permalink( $post_id ),
			'author'           => array(
				'@type' => 'Person',
				'name'  => $author ? $author->display_name : get_bloginfo( 'name' ),
			),
			'publisher'        => array(
				'@type' => 'Organization',
				'name'  => $o['site_name'] ? $o['site_name'] : get_bloginfo( 'name' ),
				'url'   => $o['site_url'] ? $o['site_url'] : home_url( '/' ),
			),
		);
		if ( $image ) {
			$article['image'] = $image;
		}
		$socials = LAPUB_Options::social_links();
		if ( $socials ) {
			$article['publisher']['sameAs'] = wp_list_pluck( $socials, 'url' );
		}
		$words = (int) get_post_meta( $post_id, '_lapub_word_count', true );
		if ( $words ) {
			$article['wordCount'] = $words;
		}

		echo '<script type="application/ld+json">' . wp_json_encode( $article, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";

		// FAQPage rich result (skip if an SEO plugin may already output one).
		$faq = get_post_meta( $post_id, '_lapub_faq', true );
		if ( is_array( $faq ) && $faq && ! $seo_plugin_active ) {
			$entities = array();
			foreach ( $faq as $item ) {
				$entities[] = array(
					'@type'          => 'Question',
					'name'           => $item['q'],
					'acceptedAnswer' => array(
						'@type' => 'Answer',
						'text'  => $item['a'],
					),
				);
			}
			$schema = array(
				'@context'   => 'https://schema.org',
				'@type'      => 'FAQPage',
				'mainEntity' => $entities,
			);
			echo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
		}
	}
}
