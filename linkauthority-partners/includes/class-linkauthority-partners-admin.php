<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The LinkAuthority screen in wp-admin: connection status, the token field,
 * the two opt-ins, and the buttons for creating the page and forcing a sync.
 */
class LinkAuthority_Partners_Admin {

	const MENU_SLUG    = 'linkauthority-partners';
	const NETWORK_SLUG = 'linkauthority-partners-network';

	/**
	 * Hook suffixes of our two screens, as add_menu_page / add_submenu_page
	 * returned them, so the stylesheet loads on exactly those.
	 *
	 * @var string[]
	 */
	private $hooks = array();

	public function init() {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_styles' ) );
		add_action( 'admin_notices', array( $this, 'setup_notice' ) );
		add_action( 'admin_post_linkauthority_partners_create_page', array( $this, 'handle_create_page' ) );
		add_action( 'admin_post_linkauthority_partners_refresh', array( $this, 'handle_refresh' ) );
		add_action( 'admin_post_linkauthority_partners_backlinks', array( $this, 'handle_backlinks' ) );
		add_action( 'admin_post_linkauthority_partners_curation', array( $this, 'handle_curation' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( LINKAUTHORITY_PARTNERS_PLUGIN_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * URL of the plugin's admin screen.
	 *
	 * @return string
	 */
	public static function page_url() {
		return admin_url( 'admin.php?page=' . self::MENU_SLUG );
	}

	/**
	 * URL of the Network screen.
	 *
	 * @return string
	 */
	public static function network_url() {
		return admin_url( 'admin.php?page=' . self::NETWORK_SLUG );
	}

	/**
	 * @param array $links Existing action links.
	 * @return array
	 */
	public function action_links( $links ) {
		$settings_link = '<a href="' . esc_url( self::page_url() ) . '">'
			. esc_html__( 'Settings', 'linkauthority-partners' ) . '</a>';

		array_unshift( $links, $settings_link );

		return $links;
	}

	/**
	 * A top-level entry rather than a Settings submenu: without a token the
	 * plugin has nothing to show, so the screen that takes the token needs to be
	 * findable rather than buried.
	 */
	public function add_menu() {
		$this->hooks[] = add_menu_page(
			__( 'LinkAuthority Partners', 'linkauthority-partners' ),
			__( 'LinkAuthority', 'linkauthority-partners' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_page' ),
			'dashicons-admin-links',
			58
		);

		// Re-registering the top-level slug as the first submenu is how WordPress
		// names that entry; without it the first child inherits the parent title.
		add_submenu_page(
			self::MENU_SLUG,
			__( 'LinkAuthority Partners', 'linkauthority-partners' ),
			__( 'Dashboard', 'linkauthority-partners' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_page' )
		);

		$this->hooks[] = add_submenu_page(
			self::MENU_SLUG,
			__( 'The Network', 'linkauthority-partners' ),
			__( 'Network', 'linkauthority-partners' ),
			'manage_options',
			self::NETWORK_SLUG,
			array( $this, 'render_network_page' )
		);
	}

	/**
	 * Loads the admin styles on this plugin's screen only.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_styles( $hook ) {
		if ( ! in_array( $hook, $this->hooks, true ) ) {
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
	 * Points the site owner at the token field, since an unconfigured plugin
	 * renders an empty directory and gives no hint as to why.
	 */
	public function setup_notice() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$screen = get_current_screen();
		if ( $screen && in_array( $screen->id, $this->hooks, true ) ) {
			return;
		}

		if ( '' !== linkauthority_partners_get_token() ) {
			return;
		}

		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			wp_kses(
				sprintf(
					/* translators: %s: link to the plugin's settings screen. */
					__( 'LinkAuthority Partners needs your site token before it can list anything. <a href="%s">Add it now</a>.', 'linkauthority-partners' ),
					esc_url( self::page_url() )
				),
				array( 'a' => array( 'href' => array() ) )
			)
		);
	}

	/**
	 * Creates the Business Partners page on request. Deliberately not done on
	 * activation - the plugin shouldn't publish anything the owner didn't ask
	 * for.
	 */
	public function handle_create_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'linkauthority-partners' ) );
		}

		check_admin_referer( 'linkauthority_partners_create_page' );

		$existing = get_page_by_path( LINKAUTHORITY_PARTNERS_PAGE_SLUG );
		$notice   = 'exists';

		if ( ! $existing instanceof WP_Post ) {
			$page_id = wp_insert_post(
				array(
					'post_title'   => __( 'Business Partners', 'linkauthority-partners' ),
					'post_name'    => LINKAUTHORITY_PARTNERS_PAGE_SLUG,
					'post_content' => '[linkauthority_partners]',
					'post_status'  => 'publish',
					'post_type'    => 'page',
				)
			);

			$notice = ( $page_id && ! is_wp_error( $page_id ) ) ? 'created' : 'failed';
		}

		$this->redirect_back( $notice );
	}

	/**
	 * Forces an immediate sync.
	 */
	public function handle_refresh() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'linkauthority-partners' ) );
		}

		check_admin_referer( 'linkauthority_partners_refresh' );

		$token = linkauthority_partners_get_token();
		if ( '' === $token ) {
			$this->redirect_back( 'no-token' );
		}

		LinkAuthority_Partners_API::connect( $token );
		LinkAuthority_Partners_API::get_status();

		$this->redirect_back( LinkAuthority_Partners_API::refresh_partners() ? 'refreshed' : 'refresh-failed' );
	}

	/**
	 * Re-runs the backlink audit on the server and reloads the cached result.
	 */
	public function handle_backlinks() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'linkauthority-partners' ) );
		}

		check_admin_referer( 'linkauthority_partners_backlinks' );

		if ( '' === linkauthority_partners_get_token() ) {
			$this->redirect_back( 'no-token' );
		}

		$data = LinkAuthority_Partners_API::get_backlinks( true );

		if ( ! is_array( $data ) ) {
			$this->redirect_back( 'backlinks-failed' );
		}

		// The server rate limits the crawl. Say so rather than pretend it ran.
		$this->redirect_back( ! empty( $data['refreshedNow'] ) ? 'backlinks-refreshed' : 'backlinks-limited' );
	}

	/**
	 * Saves the owner's choices from the Network screen.
	 *
	 * The screen may have been filtered, so only the members it actually
	 * rendered are decided here: each one is hidden unless its "show" box was
	 * ticked. Members outside the filter keep whatever state they had.
	 */
	public function handle_curation() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'linkauthority-partners' ) );
		}

		check_admin_referer( 'linkauthority_partners_curation' );

		if ( '' === linkauthority_partners_get_token() ) {
			$this->redirect_back( 'no-token', self::network_url() );
		}

		$network = LinkAuthority_Partners_API::get_network();
		if ( ! is_array( $network ) ) {
			$this->redirect_back( 'network-failed', self::network_url() );
		}

		$ids   = array();
		$shown = array();
		if ( isset( $_POST['members'] ) && is_array( $_POST['members'] ) ) {
			$ids = array_map( 'sanitize_key', wp_unslash( $_POST['members'] ) );
		}
		if ( isset( $_POST['show'] ) && is_array( $_POST['show'] ) ) {
			$shown = array_map( 'sanitize_key', wp_unslash( $_POST['show'] ) );
		}

		$hidden = array();
		foreach ( $network['members'] as $member ) {
			$id = isset( $member['id'] ) ? (string) $member['id'] : '';
			if ( '' === $id ) {
				continue;
			}
			if ( in_array( $id, $ids, true ) ) {
				if ( ! in_array( $id, $shown, true ) ) {
					$hidden[] = $id;
				}
			} elseif ( ! empty( $member['hidden'] ) ) {
				$hidden[] = $id;
			}
		}

		$scope = ! empty( $_POST['niche_only'] ) ? 'niche' : 'all';

		if ( ! LinkAuthority_Partners_API::save_curation( $hidden, $scope ) ) {
			$this->redirect_back( 'network-failed', self::network_url() );
		}

		// The live page renders from the cached list; pull it again so the
		// change shows immediately rather than on the next scheduled sync.
		LinkAuthority_Partners_API::refresh_partners();

		$this->redirect_back( 'curated', self::network_url() );
	}

	/**
	 * @param string $notice Notice key.
	 * @param string $to     Screen to return to; the dashboard by default.
	 */
	private function redirect_back( $notice, $to = '' ) {
		wp_safe_redirect( add_query_arg( 'linkauthority_partners_notice', $notice, $to ? $to : self::page_url() ) );
		exit;
	}

	/**
	 * Message for a notice key, or an empty array when there's nothing to show.
	 *
	 * @param string $key Notice key.
	 * @return array
	 */
	private function notice_for( $key ) {
		$notices = array(
			'created'        => array( 'success', __( 'Business Partners page created.', 'linkauthority-partners' ) ),
			'exists'         => array( 'info', __( 'That page already exists.', 'linkauthority-partners' ) ),
			'failed'         => array( 'error', __( 'The page could not be created.', 'linkauthority-partners' ) ),
			'refreshed'      => array( 'success', __( 'Partner directory updated.', 'linkauthority-partners' ) ),
			'refresh-failed' => array( 'error', __( 'LinkAuthority could not be reached. Try again in a moment.', 'linkauthority-partners' ) ),
			'no-token'       => array( 'error', __( 'Add your site token first.', 'linkauthority-partners' ) ),
			'backlinks-refreshed' => array( 'success', __( 'Backlinks re-checked across the network.', 'linkauthority-partners' ) ),
			'backlinks-limited'   => array( 'info', __( 'Backlinks were checked recently. The network is re-crawled at most once an hour; the report below is the latest.', 'linkauthority-partners' ) ),
			'backlinks-failed'    => array( 'error', __( 'LinkAuthority could not be reached. Try again in a moment.', 'linkauthority-partners' ) ),
			'curated'             => array( 'success', __( 'Saved. Your Business Partners page has been updated.', 'linkauthority-partners' ) ),
			'network-failed'      => array( 'error', __( 'LinkAuthority could not be reached. Nothing was changed.', 'linkauthority-partners' ) ),
		);

		return $notices[ $key ] ?? array();
	}

	public function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$settings  = linkauthority_partners_get_settings();
		$partners  = get_option( LINKAUTHORITY_PARTNERS_OPT_PARTNERS, array() );
		$last_sync = (int) get_option( LINKAUTHORITY_PARTNERS_OPT_LAST_SYNC, 0 );
		$status    = get_option( LINKAUTHORITY_PARTNERS_OPT_STATUS, array() );
		$page      = get_page_by_path( LINKAUTHORITY_PARTNERS_PAGE_SLUG );
		$backlinks = get_option( LINKAUTHORITY_PARTNERS_OPT_BACKLINKS, array() );

		// First visit with a token and nothing cached: fetch once so the section
		// shows real figures rather than a button asking to be clicked.
		if ( '' !== $settings['token'] && empty( $backlinks ) ) {
			$fetched   = LinkAuthority_Partners_API::get_backlinks( false );
			$backlinks = is_array( $fetched ) ? $fetched : array();
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- display-only notice key from our own redirect.
		$notice_key = isset( $_GET['linkauthority_partners_notice'] ) ? sanitize_key( wp_unslash( $_GET['linkauthority_partners_notice'] ) ) : '';
		$notice     = $this->notice_for( $notice_key );
		$dashboard = LINKAUTHORITY_PARTNERS_API_BASE;

		if ( '' === $settings['token'] ) {
			$state_class = 'is-off';
			$state_label = __( 'Not connected', 'linkauthority-partners' );
		} elseif ( ! empty( $status['isActive'] ) ) {
			$state_class = 'is-live';
			$state_label = __( 'Connected and listed', 'linkauthority-partners' );
		} else {
			$state_class = 'is-pending';
			$state_label = __( 'Token saved, not listed yet', 'linkauthority-partners' );
		}
		?>
		<div class="wrap lap-admin">
			<h1><?php esc_html_e( 'LinkAuthority Partners', 'linkauthority-partners' ); ?></h1>

			<?php if ( ! empty( $notice ) ) : ?>
				<div class="notice notice-<?php echo esc_attr( $notice[0] ); ?> is-dismissible">
					<p><?php echo esc_html( $notice[1] ); ?></p>
				</div>
			<?php endif; ?>

			<?php settings_errors( LINKAUTHORITY_PARTNERS_OPT_SETTINGS ); ?>

			<div class="lap-card">
				<h2><?php esc_html_e( 'Connection', 'linkauthority-partners' ); ?></h2>
				<p class="lap-card-intro"><?php esc_html_e( 'How this site currently stands on the LinkAuthority network.', 'linkauthority-partners' ); ?></p>

				<dl class="lap-facts">
					<dt><?php esc_html_e( 'Status', 'linkauthority-partners' ); ?></dt>
					<dd><span class="lap-pill <?php echo esc_attr( $state_class ); ?>"><?php echo esc_html( $state_label ); ?></span></dd>

					<dt><?php esc_html_e( 'Businesses listed', 'linkauthority-partners' ); ?></dt>
					<dd><?php echo esc_html( (string) ( is_array( $partners ) ? count( $partners ) : 0 ) ); ?></dd>

					<dt><?php esc_html_e( 'Last sync', 'linkauthority-partners' ); ?></dt>
					<dd>
						<?php
						if ( $last_sync ) {
							printf(
								/* translators: %s: human-readable time difference, e.g. "5 mins". */
								esc_html__( '%s ago', 'linkauthority-partners' ),
								esc_html( human_time_diff( $last_sync, time() ) )
							);
						} else {
							esc_html_e( 'Never', 'linkauthority-partners' );
						}
						?>
					</dd>

					<dt><?php esc_html_e( 'Partners page', 'linkauthority-partners' ); ?></dt>
					<dd>
						<?php if ( $page instanceof WP_Post ) : ?>
							<a href="<?php echo esc_url( get_permalink( $page ) ); ?>"><?php echo esc_html( get_permalink( $page ) ); ?></a>
						<?php else : ?>
							<?php esc_html_e( 'Not created yet', 'linkauthority-partners' ); ?>
						<?php endif; ?>
					</dd>

					<dt><?php esc_html_e( 'Your dashboard', 'linkauthority-partners' ); ?></dt>
					<dd><a href="<?php echo esc_url( $dashboard ); ?>" target="_blank" rel="noopener"><?php echo esc_html( $dashboard ); ?></a></dd>
				</dl>

				<p class="lap-actions">
					<?php if ( ! $page instanceof WP_Post ) : ?>
						<a class="button button-primary" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=linkauthority_partners_create_page' ), 'linkauthority_partners_create_page' ) ); ?>">
							<?php esc_html_e( 'Create the Business Partners page', 'linkauthority-partners' ); ?>
						</a>
					<?php endif; ?>
					<a class="button button-secondary" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=linkauthority_partners_refresh' ), 'linkauthority_partners_refresh' ) ); ?>">
						<?php esc_html_e( 'Refresh now', 'linkauthority-partners' ); ?>
					</a>
				</p>

				<p class="lap-hint">
					<?php
					printf(
						/* translators: %s: the [linkauthority_partners] shortcode. */
						esc_html__( 'You can also drop %s onto any page or widget to show the directory there.', 'linkauthority-partners' ),
						'<code class="lap-shortcode">[linkauthority_partners]</code>'
					);
					?>
				</p>
			</div>

			<?php if ( '' !== $settings['token'] ) : ?>
			<div class="lap-card lap-backlinks">
				<h2><?php esc_html_e( 'Link authority and backlinks', 'linkauthority-partners' ); ?></h2>
				<p class="lap-card-intro">
					<?php esc_html_e( 'Your measured authority, and every link the network is actually sending you - fetched from the partner pages themselves, with each link\'s rel attribute read rather than assumed.', 'linkauthority-partners' ); ?>
				</p>

				<?php
				$auth   = isset( $backlinks['authority'] ) && is_array( $backlinks['authority'] ) ? $backlinks['authority'] : null;
				$report = isset( $backlinks['report'] ) && is_array( $backlinks['report'] ) ? $backlinks['report'] : null;
				$totals = $report && isset( $report['totals'] ) ? $report['totals'] : array();
				$by     = $report && isset( $report['byValue'] ) ? $report['byValue'] : array();
				$links  = $report && isset( $report['links'] ) && is_array( $report['links'] ) ? $report['links'] : array();
				?>

				<div class="lap-stats">
					<div class="lap-stat lap-stat-authority">
						<span class="lap-stat-label"><?php esc_html_e( 'Link authority', 'linkauthority-partners' ); ?></span>
						<?php if ( $auth && isset( $auth['score'] ) ) : ?>
							<span class="lap-stat-value"><?php echo esc_html( number_format_i18n( (float) $auth['score'], 1 ) ); ?><small>/<?php echo esc_html( (int) $auth['scale'] ); ?></small></span>
							<span class="lap-stat-note"><?php echo esc_html( $auth['source'] ); ?></span>
						<?php else : ?>
							<span class="lap-stat-value lap-stat-none"><?php esc_html_e( 'Not measured', 'linkauthority-partners' ); ?></span>
							<span class="lap-stat-note">
								<?php empty( $backlinks['authorityConfigured'] )
									? esc_html_e( 'Authority lookups are not enabled on the server yet.', 'linkauthority-partners' )
									: esc_html_e( 'No score has been recorded for this domain.', 'linkauthority-partners' ); ?>
							</span>
						<?php endif; ?>
					</div>
					<div class="lap-stat">
						<span class="lap-stat-label"><?php esc_html_e( 'Live backlinks', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( (int) ( $totals['live'] ?? 0 ) ); ?></span>
						<span class="lap-stat-note"><?php printf( esc_html__( 'of %d partners checked', 'linkauthority-partners' ), (int) ( $report['networkSize'] ?? 0 ) ); ?></span>
					</div>
					<div class="lap-stat">
						<span class="lap-stat-label"><?php esc_html_e( 'Dofollow', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( (int) ( $totals['dofollow'] ?? 0 ) ); ?></span>
						<span class="lap-stat-note"><?php esc_html_e( 'pass ranking equity', 'linkauthority-partners' ); ?></span>
					</div>
					<div class="lap-stat">
						<span class="lap-stat-label"><?php esc_html_e( 'Nofollow', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( (int) ( $totals['nofollow'] ?? 0 ) ); ?></span>
						<span class="lap-stat-note"><?php esc_html_e( 'mentions only', 'linkauthority-partners' ); ?></span>
					</div>
					<div class="lap-stat">
						<span class="lap-stat-label"><?php esc_html_e( 'Strong', 'linkauthority-partners' ); ?></span>
						<span class="lap-stat-value"><?php echo esc_html( (int) ( $by['strong'] ?? 0 ) ); ?></span>
						<span class="lap-stat-note"><?php esc_html_e( 'from well-linked domains', 'linkauthority-partners' ); ?></span>
					</div>
				</div>

				<?php if ( empty( $links ) ) : ?>
					<p class="lap-empty">
						<?php $report
							? esc_html_e( 'No partner pages to check yet. As members join the network, their links to you will appear here.', 'linkauthority-partners' )
							: esc_html_e( 'The report could not be loaded. Use the button below to try again.', 'linkauthority-partners' ); ?>
					</p>
				<?php else : ?>
					<table class="widefat striped lap-links">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Linking site', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Status', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Type', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Their authority', 'linkauthority-partners' ); ?></th>
								<th><?php esc_html_e( 'Value to you', 'linkauthority-partners' ); ?></th>
							</tr>
						</thead>
						<tbody>
						<?php foreach ( $links as $link ) :
							$value  = isset( $link['value'] ) && is_array( $link['value'] ) ? $link['value'] : array( 'label' => 'none', 'reason' => '' );
							$label  = sanitize_key( $value['label'] ?? 'none' );
							$status = sanitize_key( $link['status'] ?? '' );
							$labels = array(
								'strong'   => __( 'Strong', 'linkauthority-partners' ),
								'useful'   => __( 'Useful', 'linkauthority-partners' ),
								'modest'   => __( 'Modest', 'linkauthority-partners' ),
								'citation' => __( 'Citation', 'linkauthority-partners' ),
								'none'     => __( 'None', 'linkauthority-partners' ),
							);
							$statuses = array(
								'live'         => __( 'Live', 'linkauthority-partners' ),
								'missing'      => __( 'Missing', 'linkauthority-partners' ),
								'unreachable'  => __( 'Unreachable', 'linkauthority-partners' ),
								'no-directory' => __( 'No page', 'linkauthority-partners' ),
							);
							?>
							<tr>
								<td>
									<?php if ( ! empty( $link['page'] ) ) : ?>
										<a href="<?php echo esc_url( $link['page'] ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( wp_parse_url( $link['from'], PHP_URL_HOST ) ?: $link['from'] ); ?></a>
									<?php else : ?>
										<?php echo esc_html( wp_parse_url( $link['from'], PHP_URL_HOST ) ?: $link['from'] ); ?>
									<?php endif; ?>
									<?php if ( ! empty( $link['anchor'] ) ) : ?>
										<span class="lap-anchor"><?php echo esc_html( $link['anchor'] ); ?></span>
									<?php endif; ?>
								</td>
								<td><span class="lap-pill lap-status-<?php echo esc_attr( $status ); ?>"><?php echo esc_html( $statuses[ $status ] ?? $status ); ?></span></td>
								<td>
									<?php if ( 'live' !== $status ) : ?>
										&mdash;
									<?php elseif ( ! empty( $link['dofollow'] ) ) : ?>
										<span class="lap-pill lap-follow"><?php esc_html_e( 'Dofollow', 'linkauthority-partners' ); ?></span>
									<?php else : ?>
										<span class="lap-pill lap-nofollow"><?php echo esc_html( ! empty( $link['rel'] ) ? $link['rel'] : 'nofollow' ); ?></span>
									<?php endif; ?>
								</td>
								<td class="lap-num">
									<?php echo isset( $link['fromAuthority'] ) && is_numeric( $link['fromAuthority'] )
										? esc_html( number_format_i18n( (float) $link['fromAuthority'], 1 ) ) . '<small>/10</small>'
										: '<span class="lap-muted">' . esc_html__( 'not measured', 'linkauthority-partners' ) . '</span>'; ?>
								</td>
								<td>
									<span class="lap-pill lap-value-<?php echo esc_attr( $label ); ?>"><?php echo esc_html( $labels[ $label ] ?? $label ); ?></span>
									<?php if ( ! empty( $value['reason'] ) ) : ?>
										<span class="lap-reason"><?php echo esc_html( $value['reason'] ); ?></span>
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
						</tbody>
					</table>
				<?php endif; ?>

				<div class="lap-actions">
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<input type="hidden" name="action" value="linkauthority_partners_backlinks">
						<?php wp_nonce_field( 'linkauthority_partners_backlinks' ); ?>
						<?php submit_button( __( 'Re-check backlinks now', 'linkauthority-partners' ), 'secondary', 'submit', false ); ?>
					</form>
					<?php if ( ! empty( $report['checkedAt'] ) ) : ?>
						<span class="lap-muted">
							<?php
							// Firestore timestamps arrive as {_seconds}, fresh ones as an ISO string.
							$checked_ts = 0;
							if ( is_array( $report['checkedAt'] ) && isset( $report['checkedAt']['_seconds'] ) ) {
								$checked_ts = (int) $report['checkedAt']['_seconds'];
							} elseif ( is_string( $report['checkedAt'] ) ) {
								$checked_ts = (int) strtotime( $report['checkedAt'] );
							}
							if ( $checked_ts ) {
								printf( esc_html__( 'Last checked %s ago.', 'linkauthority-partners' ), esc_html( human_time_diff( $checked_ts ) ) );
							}
							?>
						</span>
					<?php endif; ?>
				</div>

				<p class="lap-scope">
					<?php esc_html_e( 'This covers links from LinkAuthority members - the ones we can verify by fetching the page. It is not a crawl of the whole web; a full backlink index needs a commercial data source, and nothing here is estimated to fill that gap.', 'linkauthority-partners' ); ?>
				</p>
			</div>
			<?php endif; ?>

			<form method="post" action="options.php">
				<div class="lap-card">
					<h2><?php esc_html_e( 'Settings', 'linkauthority-partners' ); ?></h2>
					<p class="lap-card-intro"><?php esc_html_e( 'Your site token connects this install to your LinkAuthority account.', 'linkauthority-partners' ); ?></p>

					<?php settings_fields( 'linkauthority_partners_settings_group' ); ?>
					<table class="form-table" role="presentation">
					<tr class="lap-token-row">
						<th scope="row">
							<label for="linkauthority_partners_token"><?php esc_html_e( 'Site token', 'linkauthority-partners' ); ?></label>
						</th>
						<td>
							<input
								type="text"
								id="linkauthority_partners_token"
								class="regular-text"
								name="<?php echo esc_attr( LINKAUTHORITY_PARTNERS_OPT_SETTINGS ); ?>[token]"
								value="<?php echo esc_attr( $settings['token'] ); ?>"
								autocomplete="off"
								spellcheck="false"
							>
							<p class="lap-hint">
								<?php esc_html_e( 'Open your dashboard, go to My Sites, click Integration on this site, and copy the site token. Saving it here connects the site to the network.', 'linkauthority-partners' ); ?>
							</p>
							<a class="button button-secondary lap-get-token" href="<?php echo esc_url( $dashboard ); ?>" target="_blank" rel="noopener">
								<?php esc_html_e( 'Get my token from LinkAuthority', 'linkauthority-partners' ); ?>
							</a>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Credit link', 'linkauthority-partners' ); ?></th>
						<td>
							<label>
								<input
									type="checkbox"
									name="<?php echo esc_attr( LINKAUTHORITY_PARTNERS_OPT_SETTINGS ); ?>[show_credit]"
									value="1"
									<?php checked( ! empty( $settings['show_credit'] ) ); ?>
								>
								<?php esc_html_e( 'Show a small "Site by LinkAuthority" link below the directory', 'linkauthority-partners' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Link repair', 'linkauthority-partners' ); ?></th>
						<td>
							<label>
								<input
									type="checkbox"
									name="<?php echo esc_attr( LINKAUTHORITY_PARTNERS_OPT_SETTINGS ); ?>[link_repair]"
									value="1"
									<?php checked( ! empty( $settings['link_repair'] ) ); ?>
								>
								<?php esc_html_e( 'Watch for links to this site that have stopped working', 'linkauthority-partners' ); ?>
							</label>
							<p class="description">
								<?php esc_html_e( 'On by default. When a visitor arrives from another site, the plugin reports two URLs: the page they came from, and the address on this site they asked for. Nothing identifying the visitor is collected. This is what lets LinkAuthority tell you when a page you renamed left someone else\'s link pointing at a 404 - switch it off and that goes unnoticed.', 'linkauthority-partners' ); ?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Page views', 'linkauthority-partners' ); ?></th>
						<td>
							<label>
								<input
									type="checkbox"
									name="<?php echo esc_attr( LINKAUTHORITY_PARTNERS_OPT_SETTINGS ); ?>[report_views]"
									value="1"
									<?php checked( ! empty( $settings['report_views'] ) ); ?>
								>
								<?php esc_html_e( 'Count views of the directory and report the running total to LinkAuthority', 'linkauthority-partners' ); ?>
							</label>
							<p class="description">
								<?php esc_html_e( 'Off by default. Only a total count is sent - no visitor details, and logged-in users are never counted.', 'linkauthority-partners' ); ?>
							</p>
						</td>
					</tr>
					</table>
					<?php submit_button(); ?>
				</div>
			</form>
		</div>
		<?php
	}
	/**
	 * The Network screen: every active member, filterable by niche, with a
	 * "show on my page" box per member and the niche-only switch.
	 *
	 * The exchange itself stays automatic - every member links to every other.
	 * What the owner decides here is only who appears on their own page.
	 */
	public function render_network_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only filters and our own notice key.
		$notice_key = isset( $_GET['linkauthority_partners_notice'] ) ? sanitize_key( wp_unslash( $_GET['linkauthority_partners_notice'] ) ) : '';
		$niche      = isset( $_GET['niche'] ) ? sanitize_text_field( wp_unslash( $_GET['niche'] ) ) : '';
		$query      = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : '';
		// phpcs:enable
		$notice = $this->notice_for( $notice_key );

		$token    = linkauthority_partners_get_token();
		$network  = '' !== $token ? LinkAuthority_Partners_API::get_network() : false;
		$members  = is_array( $network ) ? $network['members'] : array();
		$cats     = is_array( $network ) && ! empty( $network['categories'] ) ? (array) $network['categories'] : array();
		$site     = is_array( $network ) && isset( $network['site'] ) ? $network['site'] : array();
		$niche_on = isset( $site['partnerScope'] ) && 'niche' === $site['partnerScope'];
		$my_cat   = isset( $site['category'] ) ? (string) $site['category'] : '';

		$hidden_total = 0;
		foreach ( $members as $m ) {
			if ( ! empty( $m['hidden'] ) ) {
				$hidden_total++;
			}
		}

		$shown = array_filter(
			$members,
			function ( $m ) use ( $niche, $query ) {
				if ( '' !== $niche && ( ! isset( $m['category'] ) || $m['category'] !== $niche ) ) {
					return false;
				}
				if ( '' === $query ) {
					return true;
				}
				$hay = strtolower( ( $m['name'] ?? '' ) . ' ' . ( $m['url'] ?? '' ) . ' ' . ( $m['category'] ?? '' ) . ' ' . ( $m['description'] ?? '' ) );
				return false !== strpos( $hay, strtolower( $query ) );
			}
		);
		?>
		<div class="wrap lap-admin lap-network">
			<h1><?php esc_html_e( 'The Network', 'linkauthority-partners' ); ?></h1>

			<?php if ( ! empty( $notice ) ) : ?>
				<div class="notice notice-<?php echo esc_attr( $notice[0] ); ?> is-dismissible">
					<p><?php echo esc_html( $notice[1] ); ?></p>
				</div>
			<?php endif; ?>

			<?php if ( '' === $token ) : ?>
				<div class="lap-card">
					<p><?php esc_html_e( 'Add your site token on the Dashboard screen first. The network is only visible to connected sites.', 'linkauthority-partners' ); ?></p>
					<p><a class="button button-primary" href="<?php echo esc_url( self::page_url() ); ?>"><?php esc_html_e( 'Go to the Dashboard', 'linkauthority-partners' ); ?></a></p>
				</div>
			<?php elseif ( ! is_array( $network ) ) : ?>
				<div class="lap-card">
					<p><?php esc_html_e( 'LinkAuthority could not be reached. Reload in a moment.', 'linkauthority-partners' ); ?></p>
				</div>
			<?php else : ?>

			<div class="lap-card">
				<h2>
					<?php
					printf(
						/* translators: %d: number of active member sites. */
						esc_html( _n( '%d active site is linking to you', '%d active sites are linking to you', count( $members ), 'linkauthority-partners' ) ),
						(int) count( $members )
					);
					?>
				</h2>
				<p class="lap-card-intro">
					<?php esc_html_e( 'Every site below carries a dofollow link to you, and your Business Partners page carries a link back to each of them. Listings update automatically as members join and leave - there is nothing to request. What you control here is who appears on your page: untick a site to hide it from your page only. It keeps linking to you.', 'linkauthority-partners' ); ?>
				</p>

				<form method="get" class="lap-filters">
					<input type="hidden" name="page" value="<?php echo esc_attr( self::NETWORK_SLUG ); ?>">
					<input type="search" name="q" value="<?php echo esc_attr( $query ); ?>" placeholder="<?php esc_attr_e( 'Search name, niche or URL', 'linkauthority-partners' ); ?>">
					<select name="niche">
						<option value=""><?php esc_html_e( 'All niches', 'linkauthority-partners' ); ?></option>
						<?php foreach ( $cats as $cat ) : ?>
							<option value="<?php echo esc_attr( $cat ); ?>" <?php selected( $niche, $cat ); ?>><?php echo esc_html( $cat ); ?></option>
						<?php endforeach; ?>
					</select>
					<?php submit_button( __( 'Filter', 'linkauthority-partners' ), 'secondary', '', false ); ?>
					<?php if ( '' !== $niche || '' !== $query ) : ?>
						<a class="button-link" href="<?php echo esc_url( self::network_url() ); ?>"><?php esc_html_e( 'Clear', 'linkauthority-partners' ); ?></a>
					<?php endif; ?>
				</form>
			</div>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="linkauthority_partners_curation">
				<?php wp_nonce_field( 'linkauthority_partners_curation' ); ?>

				<div class="lap-card">
					<h2><?php esc_html_e( 'Your page', 'linkauthority-partners' ); ?></h2>
					<label class="lap-switch">
						<input type="checkbox" name="niche_only" value="1" <?php checked( $niche_on ); ?>>
						<?php
						if ( '' !== $my_cat ) {
							printf(
								/* translators: %s: this site's category. */
								esc_html__( 'Only list partners in my category (%s)', 'linkauthority-partners' ),
								esc_html( $my_cat )
							);
						} else {
							esc_html_e( 'Only list partners in my category', 'linkauthority-partners' );
						}
						?>
					</label>
					<?php if ( $hidden_total ) : ?>
						<p class="lap-muted">
							<?php
							printf(
								/* translators: %d: number of hidden partners. */
								esc_html( _n( '%d site is hidden from your page.', '%d sites are hidden from your page.', $hidden_total, 'linkauthority-partners' ) ),
								(int) $hidden_total
							);
							?>
						</p>
					<?php endif; ?>
				</div>

				<?php if ( empty( $members ) ) : ?>
					<div class="lap-card"><p class="lap-empty"><?php esc_html_e( 'No other sites are active yet. As soon as one activates, it appears here - and your link appears on it.', 'linkauthority-partners' ); ?></p></div>
				<?php elseif ( empty( $shown ) ) : ?>
					<div class="lap-card"><p class="lap-empty"><?php esc_html_e( 'Nothing matches those filters.', 'linkauthority-partners' ); ?></p></div>
				<?php else : ?>
					<div class="lap-members">
					<?php
					foreach ( $shown as $m ) :
						$id = isset( $m['id'] ) ? sanitize_key( $m['id'] ) : '';
						if ( '' === $id ) {
							continue;
						}
						$host    = wp_parse_url( $m['url'] ?? '', PHP_URL_HOST );
						$host    = $host ? preg_replace( '/^www\./', '', $host ) : ( $m['url'] ?? '' );
						$is_hid  = ! empty( $m['hidden'] );
						$out     = $niche_on && '' !== $my_cat && ( $m['category'] ?? '' ) !== $my_cat;
						$classes = 'lap-member' . ( $is_hid || $out ? ' is-off' : '' );
						?>
						<div class="<?php echo esc_attr( $classes ); ?>">
							<input type="hidden" name="members[]" value="<?php echo esc_attr( $id ); ?>">
							<div class="lap-member-logo">
								<?php if ( ! empty( $m['logo'] ) ) : ?>
									<img src="<?php echo esc_url( $m['logo'] ); ?>" alt="" loading="lazy">
								<?php else : ?>
									<span class="dashicons dashicons-admin-site-alt3"></span>
								<?php endif; ?>
							</div>
							<div class="lap-member-body">
								<strong class="lap-member-name"><?php echo esc_html( ! empty( $m['name'] ) ? $m['name'] : $host ); ?></strong>
								<a class="lap-member-host" href="<?php echo esc_url( $m['url'] ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $host ); ?></a>
								<div class="lap-member-meta">
									<?php if ( ! empty( $m['category'] ) ) : ?>
										<span class="lap-tag"><?php echo esc_html( $m['category'] ); ?></span>
									<?php endif; ?>
									<?php if ( ! empty( $m['location']['city'] ) ) : ?>
										<span class="lap-muted"><?php echo esc_html( $m['location']['city'] . ( ! empty( $m['location']['country'] ) ? ', ' . $m['location']['country'] : '' ) ); ?></span>
									<?php else : ?>
										<span class="lap-muted"><?php esc_html_e( 'Worldwide', 'linkauthority-partners' ); ?></span>
									<?php endif; ?>
									<span class="lap-muted lap-member-auth">
										<?php
										if ( isset( $m['domainAuthority'] ) && is_numeric( $m['domainAuthority'] ) ) {
											/* translators: %s: authority score out of 10. */
											printf( esc_html__( 'authority %s/10', 'linkauthority-partners' ), esc_html( number_format_i18n( (float) $m['domainAuthority'], 1 ) ) );
										} else {
											esc_html_e( 'authority not measured', 'linkauthority-partners' );
										}
										?>
									</span>
								</div>
								<?php if ( ! empty( $m['description'] ) ) : ?>
									<p class="lap-member-desc"><?php echo esc_html( wp_trim_words( $m['description'], 30 ) ); ?></p>
								<?php endif; ?>
								<?php if ( $out ) : ?>
									<p class="lap-member-note"><?php esc_html_e( 'Outside your category - not on your page while the switch above is on. Still links to you.', 'linkauthority-partners' ); ?></p>
								<?php endif; ?>
							</div>
							<label class="lap-member-toggle">
								<input type="checkbox" name="show[]" value="<?php echo esc_attr( $id ); ?>" <?php checked( ! $is_hid ); ?>>
								<?php esc_html_e( 'Show on my page', 'linkauthority-partners' ); ?>
							</label>
						</div>
					<?php endforeach; ?>
					</div>
				<?php endif; ?>

				<?php if ( ! empty( $members ) ) : ?>
					<p class="lap-actions">
						<?php submit_button( __( 'Save my page', 'linkauthority-partners' ), 'primary', 'submit', false ); ?>
						<span class="lap-muted"><?php esc_html_e( 'Only the sites listed above are changed; filtered-out sites keep their setting.', 'linkauthority-partners' ); ?></span>
					</p>
				<?php endif; ?>
			</form>

			<?php endif; ?>
		</div>
		<?php
	}
}
