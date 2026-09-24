<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keeps old URLs working, and warns before a change breaks one.
 *
 * Two halves of the same job:
 *
 *   the guard     - before a post is renamed or trashed, check whether anything
 *                   out there links to its current address. If it does, keep
 *                   that address working automatically and say so.
 *   the redirects - a small table of old path to new destination, served as a
 *                   301 on what would otherwise be a 404.
 *
 * "Anything out there" means links LinkAuthority has verified as live, which is
 * why the guard is quiet on a site with no earned links and loud on the one URL
 * that matters.
 */
class LinkAuthority_Partners_Redirects {

	/** Redirects stored. Past this the owner is managing URLs, not accidents. */
	const MAX_REDIRECTS = 500;

	public function init() {
		// Ahead of the 404 handler, and ahead of anything that renders.
		add_action( 'template_redirect', array( $this, 'maybe_redirect' ), 1 );

		add_action( 'post_updated', array( $this, 'guard_permalink_change' ), 10, 3 );
		add_action( 'wp_trash_post', array( $this, 'guard_trash' ) );
		add_action( 'admin_notices', array( $this, 'guard_notice' ) );
	}

	/**
	 * Every stored redirect, keyed by the path it catches.
	 *
	 * @return array
	 */
	public static function all() {
		$stored = get_option( LINKAUTHORITY_PARTNERS_OPT_REDIRECTS, array() );

		return is_array( $stored ) ? $stored : array();
	}

	/**
	 * Normalises a path for storage and lookup: leading slash, no trailing
	 * slash, no query string, no host.
	 *
	 * @param string $url_or_path
	 * @return string
	 */
	public static function normalise_path( $url_or_path ) {
		$path = wp_parse_url( (string) $url_or_path, PHP_URL_PATH );
		if ( null === $path || '' === $path ) {
			$path = (string) $url_or_path;
		}

		$path = '/' . trim( (string) $path, '/' );

		return '/' === $path ? '/' : untrailingslashit( $path );
	}

	/**
	 * Stores a redirect.
	 *
	 * @param string $from   Old path on this site.
	 * @param string $to     Destination: a path here, or a full URL.
	 * @param string $origin Why it exists: 'auto' for the guard, 'manual' otherwise.
	 * @return bool
	 */
	public static function add( $from, $to, $origin = 'manual' ) {
		$from = self::normalise_path( $from );
		$to   = trim( (string) $to );

		if ( '' === $from || '/' === $from || '' === $to ) {
			return false;
		}

		// A redirect to itself is a loop, and a redirect off-site is not what
		// this is for.
		if ( self::normalise_path( $to ) === $from ) {
			return false;
		}

		$host = wp_parse_url( $to, PHP_URL_HOST );
		if ( $host && strtolower( $host ) !== strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) ) {
			return false;
		}

		$redirects = self::all();
		if ( count( $redirects ) >= self::MAX_REDIRECTS && ! isset( $redirects[ $from ] ) ) {
			return false;
		}

		$redirects[ $from ] = array(
			'to'      => $host ? $to : self::normalise_path( $to ),
			'created' => time(),
			'origin'  => 'auto' === $origin ? 'auto' : 'manual',
			'hits'    => isset( $redirects[ $from ]['hits'] ) ? (int) $redirects[ $from ]['hits'] : 0,
		);

		return update_option( LINKAUTHORITY_PARTNERS_OPT_REDIRECTS, $redirects, false );
	}

	/**
	 * @param string $from
	 * @return bool
	 */
	public static function remove( $from ) {
		$redirects = self::all();
		$from      = self::normalise_path( $from );

		if ( ! isset( $redirects[ $from ] ) ) {
			return false;
		}

		unset( $redirects[ $from ] );

		return update_option( LINKAUTHORITY_PARTNERS_OPT_REDIRECTS, $redirects, false );
	}

	/**
	 * Serves a stored redirect instead of a 404.
	 *
	 * Only ever acts on a request WordPress was going to answer with a 404, so
	 * a redirect can never shadow a real page - if the owner later republishes
	 * that URL, the page wins and the redirect goes quiet on its own.
	 *
	 * @return void
	 */
	public function maybe_redirect() {
		if ( ! is_404() ) {
			return;
		}

		$redirects = self::all();
		if ( empty( $redirects ) || empty( $_SERVER['REQUEST_URI'] ) ) {
			return;
		}

		$path = self::normalise_path( wp_unslash( $_SERVER['REQUEST_URI'] ) );
		if ( ! isset( $redirects[ $path ] ) ) {
			return;
		}

		$to = $redirects[ $path ]['to'];
		$to = wp_parse_url( $to, PHP_URL_HOST ) ? $to : home_url( $to );

		$redirects[ $path ]['hits'] = (int) $redirects[ $path ]['hits'] + 1;
		update_option( LINKAUTHORITY_PARTNERS_OPT_REDIRECTS, $redirects, false );

		wp_safe_redirect( $to, 301 );
		exit;
	}

	/**
	 * Paths that external links point at, as last reported by LinkAuthority.
	 *
	 * @return array path => array{links:int, domains:int, topDomains:array}
	 */
	public static function protected_paths() {
		$report = get_option( LINKAUTHORITY_PARTNERS_OPT_LINK_REPORT, array() );
		$paths  = ( is_array( $report ) && ! empty( $report['protectedPaths'] ) ) ? $report['protectedPaths'] : array();

		if ( ! is_array( $paths ) ) {
			return array();
		}

		$out = array();
		foreach ( $paths as $path => $info ) {
			$out[ self::normalise_path( $path ) ] = $info;
		}

		return $out;
	}

	/**
	 * What links to this path, or null when nothing does.
	 *
	 * @param string $path
	 * @return array|null
	 */
	public static function links_to( $path ) {
		$paths = self::protected_paths();
		$path  = self::normalise_path( $path );

		return isset( $paths[ $path ] ) ? $paths[ $path ] : null;
	}

	/**
	 * Catches a permalink change on a published post.
	 *
	 * If the old address had links pointing at it, the old address keeps
	 * working - a redirect is created before the change can cost anything, and
	 * the owner is told rather than asked. Undoing it is one click on the Link
	 * Repair screen; noticing the damage six months later is not.
	 *
	 * @param int     $post_id     Post being updated.
	 * @param WP_Post $post_after  Post after the update.
	 * @param WP_Post $post_before Post before the update.
	 * @return void
	 */
	public function guard_permalink_change( $post_id, $post_after, $post_before ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		// Only a post that was publicly reachable can have earned a link.
		if ( 'publish' !== $post_before->post_status ) {
			return;
		}

		if ( $post_before->post_name === $post_after->post_name && $post_before->post_parent === $post_after->post_parent ) {
			return;
		}

		$old = self::normalise_path( get_permalink( $post_before ) );
		$new = self::normalise_path( get_permalink( $post_after ) );

		if ( $old === $new ) {
			return;
		}

		$links = self::links_to( $old );
		if ( ! $links ) {
			return;
		}

		if ( self::add( $old, $new, 'auto' ) ) {
			$this->flag(
				'kept',
				array(
					'from'    => $old,
					'to'      => $new,
					'links'   => (int) ( $links['links'] ?? 0 ),
					'domains' => (int) ( $links['domains'] ?? 0 ),
				)
			);
		}
	}

	/**
	 * Warns when a post with earned links is trashed.
	 *
	 * Nothing is redirected here: only the owner knows which page should
	 * inherit those visitors, and sending them all to the home page is the
	 * mistake this plugin exists to prevent.
	 *
	 * @param int $post_id
	 * @return void
	 */
	public function guard_trash( $post_id ) {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || 'publish' !== $post->post_status ) {
			return;
		}

		$path  = self::normalise_path( get_permalink( $post ) );
		$links = self::links_to( $path );
		if ( ! $links ) {
			return;
		}

		$this->flag(
			'trashed',
			array(
				'from'    => $path,
				'title'   => $post->post_title,
				'links'   => (int) ( $links['links'] ?? 0 ),
				'domains' => (int) ( $links['domains'] ?? 0 ),
			)
		);
	}

	/**
	 * Stores a message for the next admin screen this user loads.
	 *
	 * @param string $kind
	 * @param array  $data
	 * @return void
	 */
	private function flag( $kind, array $data ) {
		set_transient( 'lap_guard_' . get_current_user_id(), array( 'kind' => $kind ) + $data, 5 * MINUTE_IN_SECONDS );
	}

	/**
	 * Shows what the guard did, once.
	 *
	 * @return void
	 */
	public function guard_notice() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}

		$key  = 'lap_guard_' . get_current_user_id();
		$flag = get_transient( $key );
		if ( ! is_array( $flag ) || empty( $flag['kind'] ) ) {
			return;
		}

		delete_transient( $key );

		$screen_url = admin_url( 'admin.php?page=linkauthority-partners-repair' );

		if ( 'kept' === $flag['kind'] ) {
			printf(
				'<div class="notice notice-success"><p><strong>%s</strong> %s <a href="%s">%s</a></p></div>',
				esc_html__( 'LinkAuthority kept your links working.', 'linkauthority-partners' ),
				esc_html(
					sprintf(
						/* translators: 1: number of links, 2: number of domains, 3: old path, 4: new path. */
						_n(
							'%1$d link from %2$d domain pointed at %3$s, so that address now redirects to %4$s.',
							'%1$d links from %2$d domains pointed at %3$s, so that address now redirects to %4$s.',
							(int) $flag['links'],
							'linkauthority-partners'
						),
						(int) $flag['links'],
						(int) $flag['domains'],
						$flag['from'],
						$flag['to']
					)
				),
				esc_url( $screen_url ),
				esc_html__( 'Manage redirects', 'linkauthority-partners' )
			);

			return;
		}

		printf(
			'<div class="notice notice-warning"><p><strong>%s</strong> %s <a href="%s">%s</a></p></div>',
			esc_html__( 'That page had links pointing at it.', 'linkauthority-partners' ),
			esc_html(
				sprintf(
					/* translators: 1: number of links, 2: number of domains, 3: the path that is now a 404. */
					_n(
						'%1$d link from %2$d domain points at %3$s, which now returns a 404. Choose where those visitors should go.',
						'%1$d links from %2$d domains point at %3$s, which now returns a 404. Choose where those visitors should go.',
						(int) $flag['links'],
						'linkauthority-partners'
					),
					(int) $flag['links'],
					(int) $flag['domains'],
					$flag['from']
				)
			),
			esc_url( $screen_url ),
			esc_html__( 'Add a redirect', 'linkauthority-partners' )
		);
	}
}
