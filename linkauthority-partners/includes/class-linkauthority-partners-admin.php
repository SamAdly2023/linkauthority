<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The LinkAuthority screen in wp-admin: connection status, the token field,
 * the two opt-ins, and the buttons for creating the page and forcing a sync.
 */
class LinkAuthority_Partners_Admin {

	const MENU_SLUG = 'linkauthority-partners';

	public function init() {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_styles' ) );
		add_action( 'admin_notices', array( $this, 'setup_notice' ) );
		add_action( 'admin_post_linkauthority_partners_create_page', array( $this, 'handle_create_page' ) );
		add_action( 'admin_post_linkauthority_partners_refresh', array( $this, 'handle_refresh' ) );
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
		add_menu_page(
			__( 'LinkAuthority Partners', 'linkauthority-partners' ),
			__( 'LinkAuthority', 'linkauthority-partners' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_page' ),
			'dashicons-admin-links',
			58
		);
	}

	/**
	 * Loads the admin styles on this plugin's screen only.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_styles( $hook ) {
		if ( 'toplevel_page_' . self::MENU_SLUG !== $hook ) {
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
		if ( $screen && 'toplevel_page_' . self::MENU_SLUG === $screen->id ) {
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
	 * @param string $notice Notice key.
	 */
	private function redirect_back( $notice ) {
		wp_safe_redirect( add_query_arg( 'linkauthority_partners_notice', $notice, self::page_url() ) );
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
}
