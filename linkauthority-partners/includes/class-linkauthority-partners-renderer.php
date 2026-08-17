<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders the directory at output time from the cached partner list.
 *
 * Nothing is ever written into post_content: the shortcode builds the markup on
 * each render, and the stylesheet is a real enqueued file rather than an inline
 * <style> tag, so KSES, wpautop and wptexturize have nothing of ours to mangle.
 */
class LinkAuthority_Partners_Renderer {

	public function init() {
		add_shortcode( 'linkauthority_partners', array( $this, 'render' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_styles' ) );
		add_action( 'wp_head', array( $this, 'seo_head' ) );
		add_action( 'template_redirect', array( $this, 'track_pageview' ) );
	}

	/**
	 * Whether the current request is going to render the directory.
	 *
	 * @return bool
	 */
	private function is_partners_view() {
		$post = get_post();

		return $post instanceof WP_Post && has_shortcode( $post->post_content, 'linkauthority_partners' );
	}

	public function enqueue_styles() {
		if ( ! $this->is_partners_view() ) {
			return;
		}

		wp_enqueue_style(
			'linkauthority-partners',
			LINKAUTHORITY_PARTNERS_PLUGIN_URL . 'assets/css/partners.css',
			array(),
			LINKAUTHORITY_PARTNERS_VERSION
		);
	}

	/**
	 * Counts front-end views of the directory so the total can be reported back
	 * on the next sync. Opt-in, and never counts logged-in editors.
	 */
	public function track_pageview() {
		$settings = linkauthority_partners_get_settings();
		if ( empty( $settings['report_views'] ) ) {
			return;
		}

		if ( is_admin() || is_user_logged_in() || ! $this->is_partners_view() ) {
			return;
		}

		update_option( LINKAUTHORITY_PARTNERS_OPT_PAGE_VIEWS, (int) get_option( LINKAUTHORITY_PARTNERS_OPT_PAGE_VIEWS, 0 ) + 1, false );
	}

	/**
	 * Structured data describing the listed businesses.
	 */
	public function seo_head() {
		if ( ! $this->is_partners_view() ) {
			return;
		}

		$partners = $this->get_partners();
		if ( empty( $partners ) ) {
			return;
		}

		$items    = array();
		$position = 1;

		foreach ( $partners as $partner ) {
			if ( '' === $partner['title'] || '' === $partner['url'] ) {
				continue;
			}

			$org = array(
				'@type' => 'Organization',
				'name'  => $partner['title'],
				'url'   => $partner['url'],
			);

			if ( '' !== $partner['logo'] ) {
				$org['logo'] = $partner['logo'];
			}
			if ( '' !== $partner['description'] ) {
				$org['description'] = $partner['description'];
			}

			$items[] = array(
				'@type'    => 'ListItem',
				'position' => $position,
				'item'     => $org,
			);
			$position++;
		}

		if ( empty( $items ) ) {
			return;
		}

		$schema = array(
			'@context'        => 'https://schema.org',
			'@type'           => 'ItemList',
			'name'            => get_the_title(),
			'itemListElement' => $items,
		);

		echo '<script type="application/ld+json">' . wp_json_encode( $schema ) . '</script>' . "\n";
	}

	/**
	 * The cached partner list, normalised so every entry has all four keys.
	 *
	 * @return array
	 */
	private function get_partners() {
		$partners = get_option( LINKAUTHORITY_PARTNERS_OPT_PARTNERS, array() );
		if ( ! is_array( $partners ) ) {
			return array();
		}

		$normalised = array();
		foreach ( $partners as $partner ) {
			if ( ! is_array( $partner ) || empty( $partner['url'] ) ) {
				continue;
			}

			$normalised[] = array(
				'title'       => (string) ( $partner['title'] ?? '' ),
				'description' => (string) ( $partner['description'] ?? '' ),
				'logo'        => (string) ( $partner['logo'] ?? '' ),
				'url'         => (string) $partner['url'],
			);
		}

		return $normalised;
	}

	/**
	 * Shortcode handler.
	 *
	 * @return string
	 */
	public function render() {
		$partners = $this->get_partners();

		$html  = '<div class="linkauthority-partners-silo">';
		$html .= '<p class="la-intro">' . esc_html__( 'We are proud to support the following businesses. Take a moment to check out what they do.', 'linkauthority-partners' ) . '</p>';

		if ( empty( $partners ) ) {
			$html .= '<div class="la-empty">' . esc_html__( 'No businesses listed yet. Check back soon.', 'linkauthority-partners' ) . '</div>';
		} else {
			$html .= '<div class="la-grid">';

			foreach ( $partners as $partner ) {
				$title = esc_html( $partner['title'] );

				$html .= '<div class="la-card">';
				$html .= '<div>';
				$html .= '<div class="la-card-head">';

				if ( '' !== $partner['logo'] ) {
					$html .= '<img class="la-logo" src="' . esc_url( $partner['logo'] ) . '" alt="' . esc_attr(
						sprintf(
							/* translators: %s: partner business name. */
							__( '%s logo', 'linkauthority-partners' ),
							$partner['title']
						)
					) . '" loading="lazy" width="44" height="44">';
				} else {
					$html .= '<span class="la-logo-fallback" aria-hidden="true">' . esc_html( mb_substr( $partner['title'], 0, 1 ) ) . '</span>';
				}

				$html .= '<h3>' . $title . '</h3>';
				$html .= '</div>';
				$html .= '<p>' . esc_html( $partner['description'] ) . '</p>';
				$html .= '</div>';
				$html .= '<a class="la-btn" href="' . esc_url( $partner['url'] ) . '">' . sprintf(
					/* translators: %s: partner business name. */
					esc_html__( 'Visit %s', 'linkauthority-partners' ),
					$title
				) . ' &rarr;</a>';
				$html .= '</div>';
			}

			$html .= '</div>';
		}

		$settings = linkauthority_partners_get_settings();
		if ( ! empty( $settings['show_credit'] ) ) {
			$html .= '<div class="la-footer">' . sprintf(
				/* translators: %s: link to the LinkAuthority website. */
				esc_html__( 'Site by %s', 'linkauthority-partners' ),
				'<a href="' . esc_url( LINKAUTHORITY_PARTNERS_API_BASE ) . '">LinkAuthority</a>'
			) . '</div>';
		}

		$html .= '</div>';

		return $html;
	}
}
