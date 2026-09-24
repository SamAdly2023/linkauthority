<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Sees the external links pointing at this site, and reports the pairs.
 *
 * Two things are worth noticing, and both are visible from inside WordPress in
 * a way no outside crawler can match:
 *
 *   a visitor arrives from another site  - that link exists, and carries traffic
 *   a visitor hits a 404 from another site - that is a broken backlink, caught
 *                                            in the act, the moment it happens
 *
 * What leaves this site is a pair of URLs: where the visitor came from, and
 * which address on this site they asked for. Nothing that identifies the
 * visitor is collected, and nothing is sent during their page load - sightings
 * queue locally and go out on the hourly cron.
 *
 * Almost every request exits at the first line of `maybe_record()`, because
 * direct traffic, crawlers and internal navigation have no external referrer.
 */
class LinkAuthority_Partners_Links {

	/** Sightings held locally before the next flush. */
	const MAX_QUEUE = 100;

	/** Pairs remembered so a popular link is not re-queued on every visit. */
	const MAX_SEEN = 500;

	public function init() {
		add_action( 'template_redirect', array( $this, 'maybe_record' ), 20 );
		add_action( LINKAUTHORITY_PARTNERS_CRON_LINKS, array( $this, 'flush' ) );
	}

	/**
	 * Records a sighting when the current request arrived from somewhere else.
	 *
	 * @return void
	 */
	public function maybe_record() {
		// The common case: no referrer at all. Nothing is read, queried or written.
		if ( empty( $_SERVER['HTTP_REFERER'] ) ) {
			return;
		}

		if ( is_admin() || wp_doing_ajax() || is_user_logged_in() ) {
			return;
		}

		$settings = linkauthority_partners_get_settings();
		if ( empty( $settings['link_repair'] ) || '' === (string) $settings['token'] ) {
			return;
		}

		$referer = esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) );
		$source  = wp_parse_url( $referer );
		if ( empty( $source['host'] ) ) {
			return;
		}

		// Links from this site to itself are navigation, not backlinks.
		$home = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( $this->same_host( $source['host'], $home ) ) {
			return;
		}

		$target = $this->current_url();
		if ( '' === $target ) {
			return;
		}

		$this->queue(
			array(
				'sourceUrl' => $referer,
				'targetUrl' => $target,
				'kind'      => is_404() ? '404' : 'referrer',
			),
			is_404()
		);
	}

	/**
	 * Adds a sighting to the local queue.
	 *
	 * A pair already queued or recently reported is skipped, so a link that
	 * sends a thousand visitors costs one row rather than a thousand - except
	 * for a 404, which is always worth recording again because it is the event
	 * the site owner actually needs to hear about.
	 *
	 * @param array $sighting  URL pair and kind.
	 * @param bool  $always    Skip the "seen before" check.
	 * @return void
	 */
	private function queue( array $sighting, $always = false ) {
		$key = md5( $sighting['sourceUrl'] . '|' . $sighting['targetUrl'] . '|' . $sighting['kind'] );

		$seen = get_option( LINKAUTHORITY_PARTNERS_OPT_SEEN, array() );
		$seen = is_array( $seen ) ? $seen : array();

		if ( ! $always && in_array( $key, $seen, true ) ) {
			return;
		}

		$queue = get_option( LINKAUTHORITY_PARTNERS_OPT_SIGHTINGS, array() );
		$queue = is_array( $queue ) ? $queue : array();

		if ( count( $queue ) >= self::MAX_QUEUE ) {
			return;
		}

		$queue[ $key ] = $sighting;
		update_option( LINKAUTHORITY_PARTNERS_OPT_SIGHTINGS, $queue, false );

		$seen[] = $key;
		if ( count( $seen ) > self::MAX_SEEN ) {
			$seen = array_slice( $seen, - self::MAX_SEEN );
		}
		update_option( LINKAUTHORITY_PARTNERS_OPT_SEEN, $seen, false );
	}

	/**
	 * Sends the queue to LinkAuthority and reloads the report.
	 *
	 * The queue is only cleared when the service accepted it; a failed send
	 * leaves the sightings in place for the next run rather than losing them.
	 *
	 * @return void
	 */
	public function flush() {
		if ( '' === linkauthority_partners_get_token() ) {
			return;
		}

		$queue = get_option( LINKAUTHORITY_PARTNERS_OPT_SIGHTINGS, array() );
		$queue = is_array( $queue ) ? $queue : array();

		if ( ! empty( $queue ) && LinkAuthority_Partners_API::send_sightings( array_values( $queue ) ) ) {
			update_option( LINKAUTHORITY_PARTNERS_OPT_SIGHTINGS, array(), false );
		}

		LinkAuthority_Partners_API::get_link_report( true );
	}

	/**
	 * The full URL of the current request, which is the address the visitor
	 * followed a link to - including the one that just 404'd.
	 *
	 * @return string
	 */
	private function current_url() {
		if ( empty( $_SERVER['REQUEST_URI'] ) ) {
			return '';
		}

		$path = wp_unslash( $_SERVER['REQUEST_URI'] );
		$path = '/' . ltrim( sanitize_text_field( $path ), '/' );

		return home_url( $path );
	}

	/**
	 * @param string $a
	 * @param string $b
	 * @return bool
	 */
	private function same_host( $a, $b ) {
		$strip = static function ( $host ) {
			return strtolower( preg_replace( '/^www\./', '', (string) $host ) );
		};

		return $strip( $a ) === $strip( $b );
	}
}
