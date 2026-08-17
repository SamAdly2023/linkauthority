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
			__( 'LinkAuthority Business Partners', 'linkauthority-partners' ),
			__( 'LinkAuthority', 'linkauthority-partners' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_page' ),
			'dashicons-admin-links',
			58
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
					__( 'LinkAuthority Business Partners needs your site token before it can list anything. <a href="%s">Add it now</a>.', 'linkauthority-partners' ),
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
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'LinkAuthority Business Partners', 'linkauthority-partners' ); ?></h1>

			<?php if ( ! empty( $notice ) ) : ?>
				<div class="notice notice-<?php echo esc_attr( $notice[0] ); ?> is-dismissible">
					<p><?php echo esc_html( $notice[1] ); ?></p>
				</div>
			<?php endif; ?>

			<?php settings_errors( LINKAUTHORITY_PARTNERS_OPT_SETTINGS ); ?>

			<h2><?php esc_html_e( 'Connection', 'linkauthority-partners' ); ?></h2>
			<table class="widefat striped" style="max-width:640px">
				<tbody>
					<tr>
						<td><strong><?php esc_html_e( 'Status', 'linkauthority-partners' ); ?></strong></td>
						<td>
							<?php
							if ( '' === $settings['token'] ) {
								esc_html_e( 'Not connected - add your site token below.', 'linkauthority-partners' );
							} elseif ( ! empty( $status['isActive'] ) ) {
								esc_html_e( 'Connected and listed.', 'linkauthority-partners' );
							} else {
								esc_html_e( 'Token saved, but this site is not listed yet.', 'linkauthority-partners' );
							}
							?>
						</td>
					</tr>
					<tr>
						<td><strong><?php esc_html_e( 'Businesses listed', 'linkauthority-partners' ); ?></strong></td>
						<td><?php echo esc_html( (string) ( is_array( $partners ) ? count( $partners ) : 0 ) ); ?></td>
					</tr>
					<tr>
						<td><strong><?php esc_html_e( 'Last sync', 'linkauthority-partners' ); ?></strong></td>
						<td>
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
						</td>
					</tr>
					<tr>
						<td><strong><?php esc_html_e( 'Partners page', 'linkauthority-partners' ); ?></strong></td>
						<td>
							<?php if ( $page instanceof WP_Post ) : ?>
								<a href="<?php echo esc_url( get_permalink( $page ) ); ?>"><?php echo esc_html( get_permalink( $page ) ); ?></a>
							<?php else : ?>
								<?php esc_html_e( 'Not created yet.', 'linkauthority-partners' ); ?>
							<?php endif; ?>
						</td>
					</tr>
				</tbody>
			</table>

			<p style="margin-top:1em">
				<?php if ( ! $page instanceof WP_Post ) : ?>
					<a class="button button-secondary" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=linkauthority_partners_create_page' ), 'linkauthority_partners_create_page' ) ); ?>">
						<?php esc_html_e( 'Create the Business Partners page', 'linkauthority-partners' ); ?>
					</a>
				<?php endif; ?>
				<a class="button button-secondary" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=linkauthority_partners_refresh' ), 'linkauthority_partners_refresh' ) ); ?>">
					<?php esc_html_e( 'Refresh now', 'linkauthority-partners' ); ?>
				</a>
			</p>

			<p class="description" style="max-width:640px">
				<?php esc_html_e( 'You can also drop the [linkauthority_partners] shortcode onto any page or widget to show the directory there.', 'linkauthority-partners' ); ?>
			</p>

			<h2><?php esc_html_e( 'Settings', 'linkauthority-partners' ); ?></h2>
			<form method="post" action="options.php">
				<?php settings_fields( 'linkauthority_partners_settings_group' ); ?>
				<table class="form-table" role="presentation">
					<tr>
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
							>
							<p class="description">
								<?php esc_html_e( 'Found in your LinkAuthority dashboard under My Sites → Integration. Saving it connects this site to the network.', 'linkauthority-partners' ); ?>
							</p>
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
			</form>
		</div>
		<?php
	}
}
