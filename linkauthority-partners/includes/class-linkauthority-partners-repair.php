<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The Link Repair screen: which earned links are landing on a dead page, and
 * one button each to make them land somewhere again.
 *
 * Every row here was verified from LinkAuthority's side - the linking page was
 * fetched and the link found on it, the target was fetched and its status code
 * recorded. A row that says "broken" means someone else is still sending
 * people to an address that answers 404, which is the only case where a
 * redirect recovers anything.
 */
class LinkAuthority_Partners_Repair {

	const SLUG = 'linkauthority-partners-repair';

	/** @var string */
	private $hook = '';

	public function init() {
		add_action( 'admin_menu', array( $this, 'add_menu' ), 11 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'admin_post_linkauthority_partners_fix', array( $this, 'handle_fix' ) );
		add_action( 'admin_post_linkauthority_partners_redirect', array( $this, 'handle_redirect' ) );
		add_action( 'admin_post_linkauthority_partners_recheck', array( $this, 'handle_recheck' ) );
	}

	/**
	 * @return string
	 */
	public static function url() {
		return admin_url( 'admin.php?page=' . self::SLUG );
	}

	public function add_menu() {
		$broken = $this->summary()['broken'] ?? 0;

		$label = __( 'Link Repair', 'linkauthority-partners' );
		if ( $broken > 0 ) {
			// The count in the menu is the entire point of the feature: it is
			// the only place a site owner will ever be told, unprompted, that
			// something they did months ago is still costing them.
			$label .= ' <span class="awaiting-mod"><span class="pending-count">' . (int) $broken . '</span></span>';
		}

		$this->hook = add_submenu_page(
			LinkAuthority_Partners_Admin::MENU_SLUG,
			__( 'Link Repair', 'linkauthority-partners' ),
			$label,
			'manage_options',
			self::SLUG,
			array( $this, 'render' )
		);
	}

	/**
	 * @param string $hook
	 * @return void
	 */
	public function enqueue( $hook ) {
		if ( $hook !== $this->hook ) {
			return;
		}

		wp_enqueue_style(
			'linkauthority-partners-admin',
			LINKAUTHORITY_PARTNERS_PLUGIN_URL . 'assets/css/admin.css',
			array(),
			LINKAUTHORITY_PARTNERS_VERSION
		);
	}

	/**
	 * The cached report, or an empty shape when there is nothing yet.
	 *
	 * @return array
	 */
	private function report() {
		$report = get_option( LINKAUTHORITY_PARTNERS_OPT_LINK_REPORT, array() );

		return is_array( $report ) ? $report : array();
	}

	/**
	 * @return array
	 */
	private function summary() {
		$report = $this->report();

		return ( isset( $report['summary'] ) && is_array( $report['summary'] ) ) ? $report['summary'] : array();
	}

	/**
	 * Creates the redirect that fixes one broken link, and tells LinkAuthority
	 * it was handled so the next verification confirms it.
	 *
	 * @return void
	 */
	public function handle_fix() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'linkauthority-partners' ) );
		}

		check_admin_referer( 'linkauthority_partners_fix' );

		$link_id = isset( $_POST['link_id'] ) ? sanitize_text_field( wp_unslash( $_POST['link_id'] ) ) : '';
		$from    = isset( $_POST['from'] ) ? sanitize_text_field( wp_unslash( $_POST['from'] ) ) : '';
		$to      = isset( $_POST['to'] ) ? sanitize_text_field( wp_unslash( $_POST['to'] ) ) : '';
		$ignore  = ! empty( $_POST['ignore'] );

		if ( $ignore ) {
			LinkAuthority_Partners_API::report_fix( $link_id, null, true );
			$this->back( 'ignored' );
		}

		if ( '' === $from || '' === $to ) {
			$this->back( 'fix-invalid' );
		}

		if ( ! LinkAuthority_Partners_Redirects::add( $from, $to, 'manual' ) ) {
			$this->back( 'fix-invalid' );
		}

		LinkAuthority_Partners_API::report_fix( $link_id, $to );

		$this->back( 'fixed' );
	}

	/**
	 * Adds or removes a redirect from the table at the bottom of the screen.
	 *
	 * @return void
	 */
	public function handle_redirect() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'linkauthority-partners' ) );
		}

		check_admin_referer( 'linkauthority_partners_redirect' );

		$delete = isset( $_POST['delete'] ) ? sanitize_text_field( wp_unslash( $_POST['delete'] ) ) : '';
		if ( '' !== $delete ) {
			LinkAuthority_Partners_Redirects::remove( $delete );
			$this->back( 'redirect-removed' );
		}

		$from = isset( $_POST['from'] ) ? sanitize_text_field( wp_unslash( $_POST['from'] ) ) : '';
		$to   = isset( $_POST['to'] ) ? sanitize_text_field( wp_unslash( $_POST['to'] ) ) : '';

		$this->back( LinkAuthority_Partners_Redirects::add( $from, $to, 'manual' ) ? 'redirect-added' : 'fix-invalid' );
	}

	/**
	 * Sends anything queued locally and asks the service to re-verify.
	 *
	 * @return void
	 */
	public function handle_recheck() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'linkauthority-partners' ) );
		}

		check_admin_referer( 'linkauthority_partners_recheck' );

		if ( '' === linkauthority_partners_get_token() ) {
			$this->back( 'no-token' );
		}

		( new LinkAuthority_Partners_Links() )->flush();

		$report = LinkAuthority_Partners_API::get_link_report( true );
		if ( ! is_array( $report ) ) {
			$this->back( 'recheck-failed' );
		}

		$this->back( empty( $report['verifiedNow'] ) ? 'recheck-limited' : 'rechecked' );
	}

	/**
	 * @param string $notice
	 * @return void
	 */
	private function back( $notice ) {
		wp_safe_redirect( add_query_arg( 'linkauthority_partners_notice', $notice, self::url() ) );
		exit;
	}

	/**
	 * @param string $key
	 * @return array
	 */
	private function notice_for( $key ) {
		$notices = array(
			'fixed'            => array( 'success', __( 'Redirect created. Those visitors now land on a real page.', 'linkauthority-partners' ) ),
			'ignored'          => array( 'info', __( 'Link ignored. It will not be reported again.', 'linkauthority-partners' ) ),
			'fix-invalid'      => array( 'error', __( 'That redirect could not be created. The destination must be a page on this site, and cannot be the same address.', 'linkauthority-partners' ) ),
			'redirect-added'   => array( 'success', __( 'Redirect added.', 'linkauthority-partners' ) ),
			'redirect-removed' => array( 'success', __( 'Redirect removed.', 'linkauthority-partners' ) ),
			'rechecked'        => array( 'success', __( 'Links re-checked.', 'linkauthority-partners' ) ),
			'recheck-limited'  => array( 'info', __( 'Links were checked recently. The report below is the latest; each link is re-checked at most once an hour.', 'linkauthority-partners' ) ),
			'recheck-failed'   => array( 'error', __( 'LinkAuthority could not be reached. Try again in a moment.', 'linkauthority-partners' ) ),
			'no-token'         => array( 'error', __( 'Add your site token first.', 'linkauthority-partners' ) ),
		);

		return $notices[ $key ] ?? array();
	}

	/**
	 * Host of a URL, for display.
	 *
	 * @param string $url
	 * @return string
	 */
	private function host( $url ) {
		$host = wp_parse_url( (string) $url, PHP_URL_HOST );

		return $host ? preg_replace( '/^www\./', '', $host ) : (string) $url;
	}

	public function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$token = linkauthority_partners_get_token();

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- display-only notice key from our own redirect.
		$notice_key = isset( $_GET['linkauthority_partners_notice'] ) ? sanitize_key( wp_unslash( $_GET['linkauthority_partners_notice'] ) ) : '';
		$notice     = $this->notice_for( $notice_key );

		$report = $this->report();
		if ( '' !== $token && empty( $report ) ) {
			$fetched = LinkAuthority_Partners_API::get_link_report( false );
			$report  = is_array( $fetched ) ? $fetched : array();
		}

		$summary   = ( isset( $report['summary'] ) && is_array( $report['summary'] ) ) ? $report['summary'] : array();
		$links     = ( isset( $report['links'] ) && is_array( $report['links'] ) ) ? $report['links'] : array();
		$redirects = LinkAuthority_Partners_Redirects::all();

		$broken = array_values(
			array_filter(
				$links,
				static function ( $l ) {
					return 'target-missing' === ( $l['status'] ?? '' ) && empty( $l['dismissed'] );
				}
			)
		);
		$healthy = array_values(
			array_filter(
				$links,
				static function ( $l ) {
					return 'live' === ( $l['status'] ?? '' );
				}
			)
		);
		?>
		<div class="wrap lap-admin lap-repair">
			<h1><?php esc_html_e( 'Link Repair', 'linkauthority-partners' ); ?></h1>

			<?php if ( ! empty( $notice ) ) : ?>
				<div class="notice notice-<?php echo esc_attr( $notice[0] ); ?> is-dismissible"><p><?php echo esc_html( $notice[1] ); ?></p></div>
			<?php endif; ?>

			<?php if ( '' === $token ) : ?>
				<div class="lap-card">
					<p><?php esc_html_e( 'Add your site token on the LinkAuthority Dashboard screen to switch link repair on.', 'linkauthority-partners' ); ?></p>
					<p><a class="button button-primary" href="<?php echo esc_url( LinkAuthority_Partners_Admin::page_url() ); ?>"><?php esc_html_e( 'Go to the Dashboard', 'linkauthority-partners' ); ?></a></p>
				</div>
			<?php else : ?>

			<div class="lap-card">
				<h2><?php esc_html_e( 'Links pointing at this site', 'linkauthority-partners' ); ?></h2>
				<p class="lap-card-intro">
					<?php esc_html_e( 'Found by watching where your visitors actually arrive from, then verified by fetching both ends: the page that links to you, and the page it links to. A link counts as broken only when it is still live on their side and dead on yours - that is the kind you can win back with a redirect.', 'linkauthority-partners' ); ?>
				</p>

				<div class="lap-stats">
					<div class="lap-stat <?php echo ( (int) ( $summary['broken'] ?? 0 ) > 0 ) ? 'lap-stat-alarm' : ''; ?>">
						<span class="lap-stat-label"><?php esc_html_e( 'Broken', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( (int) ( $summary['broken'] ?? 0 ) ); ?></span>
						<span class="lap-stat-note">
							<?php
							printf(
								/* translators: %d: number of linking domains. */
								esc_html( _n( 'from %d domain, landing on a 404', 'from %d domains, landing on a 404', (int) ( $summary['brokenDomains'] ?? 0 ), 'linkauthority-partners' ) ),
								(int) ( $summary['brokenDomains'] ?? 0 )
							);
							?>
						</span>
					</div>
					<div class="lap-stat">
						<span class="lap-stat-label"><?php esc_html_e( 'Working', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( (int) ( $summary['live'] ?? 0 ) ); ?></span>
						<span class="lap-stat-note"><?php esc_html_e( 'verified live on both ends', 'linkauthority-partners' ); ?></span>
					</div>
					<div class="lap-stat">
						<span class="lap-stat-label"><?php esc_html_e( 'Dofollow', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( (int) ( $summary['dofollow'] ?? 0 ) ); ?></span>
						<span class="lap-stat-note"><?php esc_html_e( 'pass ranking equity', 'linkauthority-partners' ); ?></span>
					</div>
					<div class="lap-stat">
						<span class="lap-stat-label"><?php esc_html_e( 'Protected URLs', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( count( LinkAuthority_Partners_Redirects::protected_paths() ) ); ?></span>
						<span class="lap-stat-note"><?php esc_html_e( 'renaming one keeps working automatically', 'linkauthority-partners' ); ?></span>
					</div>
				</div>

				<div class="lap-actions">
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<input type="hidden" name="action" value="linkauthority_partners_recheck">
						<?php wp_nonce_field( 'linkauthority_partners_recheck' ); ?>
						<?php submit_button( __( 'Check links now', 'linkauthority-partners' ), 'secondary', 'submit', false ); ?>
					</form>
				</div>
			</div>

			<?php if ( empty( $broken ) ) : ?>
				<div class="lap-card">
					<p class="lap-empty">
						<?php
						empty( $links )
							? esc_html_e( 'Nothing to repair yet. Links are discovered as visitors arrive from other sites, so this fills in on its own - and if one ever breaks, it appears here the first time someone follows it.', 'linkauthority-partners' )
							: esc_html_e( 'Nothing is broken. Every link we know about lands on a working page.', 'linkauthority-partners' );
						?>
					</p>
				</div>
			<?php else : ?>
				<div class="lap-card lap-broken">
					<h2><?php esc_html_e( 'Broken links to repair', 'linkauthority-partners' ); ?></h2>
					<p class="lap-card-intro"><?php esc_html_e( 'Each of these is a real site still sending people to an address that no longer answers. Point it at the page that replaced it.', 'linkauthority-partners' ); ?></p>

					<?php foreach ( $broken as $link ) : ?>
						<?php
						$path    = LinkAuthority_Partners_Redirects::normalise_path( $link['targetUrl'] ?? '' );
						$link_id = isset( $link['id'] ) ? (string) $link['id'] : '';
						?>
						<div class="lap-fix">
							<div class="lap-fix-what">
								<p class="lap-fix-path"><code><?php echo esc_html( $path ); ?></code> <span class="lap-pill lap-status-missing"><?php echo esc_html( (int) ( $link['targetStatus'] ?? 404 ) ); ?></span></p>
								<p class="lap-muted">
									<?php
									printf(
										/* translators: 1: linking domain, 2: anchor text. */
										esc_html__( 'Linked from %1$s%2$s', 'linkauthority-partners' ),
										'<a href="' . esc_url( $link['sourceUrl'] ?? '' ) . '" target="_blank" rel="noopener noreferrer">' . esc_html( $this->host( $link['sourceUrl'] ?? '' ) ) . '</a>',
										! empty( $link['anchor'] ) ? esc_html( ' — "' . $link['anchor'] . '"' ) : ''
									);
									?>
									<?php if ( ! empty( $link['hits'] ) ) : ?>
										&middot;
										<?php
										printf(
											/* translators: %d: number of visitors seen following the link. */
											esc_html( _n( '%d visitor arrived this way', '%d visitors arrived this way', (int) $link['hits'], 'linkauthority-partners' ) ),
											(int) $link['hits']
										);
										?>
									<?php endif; ?>
								</p>
							</div>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="lap-fix-form">
								<input type="hidden" name="action" value="linkauthority_partners_fix">
								<input type="hidden" name="link_id" value="<?php echo esc_attr( $link_id ); ?>">
								<input type="hidden" name="from" value="<?php echo esc_attr( $path ); ?>">
								<?php wp_nonce_field( 'linkauthority_partners_fix' ); ?>
								<label class="screen-reader-text" for="to-<?php echo esc_attr( $link_id ); ?>"><?php esc_html_e( 'Send visitors to', 'linkauthority-partners' ); ?></label>
								<input type="text" id="to-<?php echo esc_attr( $link_id ); ?>" name="to" list="lap-pages" placeholder="/the-replacement-page" class="regular-text">
								<?php submit_button( __( 'Redirect', 'linkauthority-partners' ), 'primary', 'submit', false ); ?>
								<button type="submit" name="ignore" value="1" class="button-link lap-ignore"><?php esc_html_e( 'Ignore', 'linkauthority-partners' ); ?></button>
							</form>
						</div>
					<?php endforeach; ?>

				</div>
			<?php endif; ?>

			<?php if ( ! empty( $healthy ) ) : ?>
				<div class="lap-card">
					<h2><?php esc_html_e( 'Links that are working', 'linkauthority-partners' ); ?></h2>
					<table class="widefat striped lap-links">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Linking site', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Points at', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Type', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Visitors', 'linkauthority-partners' ); ?></th>
							</tr>
						</thead>
						<tbody>
						<?php foreach ( array_slice( $healthy, 0, 100 ) as $link ) : ?>
							<tr>
								<td><a href="<?php echo esc_url( $link['sourceUrl'] ?? '' ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $this->host( $link['sourceUrl'] ?? '' ) ); ?></a></td>
								<td><code><?php echo esc_html( LinkAuthority_Partners_Redirects::normalise_path( $link['targetUrl'] ?? '' ) ); ?></code></td>
								<td>
									<?php if ( ! empty( $link['dofollow'] ) ) : ?>
										<span class="lap-pill lap-follow"><?php esc_html_e( 'Dofollow', 'linkauthority-partners' ); ?></span>
									<?php else : ?>
										<span class="lap-pill lap-nofollow"><?php echo esc_html( ! empty( $link['rel'] ) ? $link['rel'] : 'nofollow' ); ?></span>
									<?php endif; ?>
								</td>
								<td class="lap-num"><?php echo esc_html( (int) ( $link['hits'] ?? 0 ) ); ?></td>
							</tr>
						<?php endforeach; ?>
						</tbody>
					</table>
				</div>
			<?php endif; ?>

			<div class="lap-card">
				<h2><?php esc_html_e( 'Redirects', 'linkauthority-partners' ); ?></h2>
				<p class="lap-card-intro"><?php esc_html_e( 'Old addresses that keep working. These only ever answer a request that would otherwise be a 404, so republishing a page at one of them takes precedence automatically.', 'linkauthority-partners' ); ?></p>

				<?php if ( ! empty( $redirects ) ) : ?>
					<table class="widefat striped lap-links">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Old address', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Goes to', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Created by', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Used', 'linkauthority-partners' ); ?></th>
								<th></th>
							</tr>
						</thead>
						<tbody>
						<?php foreach ( $redirects as $from => $row ) : ?>
							<tr>
								<td><code><?php echo esc_html( $from ); ?></code></td>
								<td><code><?php echo esc_html( $row['to'] ?? '' ); ?></code></td>
								<td><?php echo 'auto' === ( $row['origin'] ?? '' ) ? esc_html__( 'The guard', 'linkauthority-partners' ) : esc_html__( 'You', 'linkauthority-partners' ); ?></td>
								<td class="lap-num"><?php echo esc_html( (int) ( $row['hits'] ?? 0 ) ); ?></td>
								<td>
									<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
										<input type="hidden" name="action" value="linkauthority_partners_redirect">
										<input type="hidden" name="delete" value="<?php echo esc_attr( $from ); ?>">
										<?php wp_nonce_field( 'linkauthority_partners_redirect' ); ?>
										<button type="submit" class="button-link delete"><?php esc_html_e( 'Remove', 'linkauthority-partners' ); ?></button>
									</form>
								</td>
							</tr>
						<?php endforeach; ?>
						</tbody>
					</table>
				<?php else : ?>
					<p class="lap-empty"><?php esc_html_e( 'No redirects yet. One is created automatically if you rename a page that other sites link to.', 'linkauthority-partners' ); ?></p>
				<?php endif; ?>

				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="lap-filters">
					<input type="hidden" name="action" value="linkauthority_partners_redirect">
					<?php wp_nonce_field( 'linkauthority_partners_redirect' ); ?>
					<label class="screen-reader-text" for="lap-from"><?php esc_html_e( 'Old address', 'linkauthority-partners' ); ?></label>
					<input type="text" id="lap-from" name="from" placeholder="/old-page" class="regular-text">
					<span aria-hidden="true">&rarr;</span>
					<label class="screen-reader-text" for="lap-to"><?php esc_html_e( 'Goes to', 'linkauthority-partners' ); ?></label>
					<input type="text" id="lap-to" name="to" list="lap-pages" placeholder="/new-page" class="regular-text">
					<?php submit_button( __( 'Add redirect', 'linkauthority-partners' ), 'secondary', 'submit', false ); ?>
				</form>
			</div>

			<datalist id="lap-pages">
				<?php
				foreach ( get_posts(
					array(
						'post_type'      => array( 'post', 'page' ),
						'post_status'    => 'publish',
						'posts_per_page' => 100,
						'orderby'        => 'modified',
						'order'          => 'DESC',
					)
				) as $candidate ) :
					?>
					<option value="<?php echo esc_attr( LinkAuthority_Partners_Redirects::normalise_path( get_permalink( $candidate ) ) ); ?>"><?php echo esc_attr( $candidate->post_title ); ?></option>
				<?php endforeach; ?>
			</datalist>

			<?php endif; ?>
		</div>
		<?php
	}
}
