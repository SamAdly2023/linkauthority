<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Settings page, AJAX actions and admin notices.
 */
class LAPUB_Admin {

	const PAGE = 'linkauthority-publisher';
	const CAP  = 'manage_options';

	/** @var LAPUB_Admin */
	private static $instance;

	public static function instance() {
		if ( ! self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'assets' ) );
		add_action( 'admin_post_lapub_save_settings', array( $this, 'save_settings' ) );
		add_action( 'admin_notices', array( $this, 'notices' ) );

		foreach ( array( 'generate_now', 'poll_now', 'cancel_job', 'test_manus', 'test_pexels', 'clear_log', 'status' ) as $action ) {
			add_action( 'wp_ajax_lapub_' . $action, array( $this, 'ajax_' . $action ) );
		}
	}

	public function menu() {
		add_menu_page(
			__( 'LinkAuthority Publisher', 'linkauthority-publisher' ),
			__( 'Publisher', 'linkauthority-publisher' ),
			self::CAP,
			self::PAGE,
			array( $this, 'render' ),
			'dashicons-edit-large',
			26
		);
		add_submenu_page( self::PAGE, __( 'Settings', 'linkauthority-publisher' ), __( 'Settings', 'linkauthority-publisher' ), self::CAP, self::PAGE, array( $this, 'render' ) );
		add_submenu_page( self::PAGE, __( 'Social Posts', 'linkauthority-publisher' ), __( 'Social Posts', 'linkauthority-publisher' ), 'edit_posts', self::PAGE . '-social', array( 'LAPUB_Admin_Social', 'render_posts_page' ) );
	}

	public function assets( $hook ) {
		if ( 'toplevel_page_' . self::PAGE !== $hook && false === strpos( $hook, self::PAGE . '-social' ) ) {
			return;
		}
		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_script( 'wp-color-picker' );
		wp_enqueue_style( 'lapub-admin', LAPUB_URL . 'assets/css/admin.css', array(), LAPUB_VERSION );
		wp_enqueue_script( 'lapub-admin', LAPUB_URL . 'assets/js/admin.js', array( 'jquery', 'wp-color-picker' ), LAPUB_VERSION, true );
		wp_localize_script(
			'lapub-admin',
			'LAPUB',
			array(
				'ajax'  => admin_url( 'admin-ajax.php' ),
				'nonce' => wp_create_nonce( 'lapub_ajax' ),
				'i18n'  => array(
					'working'   => __( 'Working…', 'linkauthority-publisher' ),
					'testing'   => __( 'Testing…', 'linkauthority-publisher' ),
					'ok'        => __( 'Connected', 'linkauthority-publisher' ),
					'confirm'   => __( 'Cancel the running generation job?', 'linkauthority-publisher' ),
					'clearlog'  => __( 'Clear the activity log?', 'linkauthority-publisher' ),
					'generated' => __( 'Generation started. Manus usually needs 5-20 minutes to research and write the article; this page will keep checking.', 'linkauthority-publisher' ),
					'popup'     => __( 'The popup was blocked. Allow popups for this site and try again.', 'linkauthority-publisher' ),
					'disconnect' => __( 'Disconnect this account?', 'linkauthority-publisher' ),
					'copied'    => __( 'Copied', 'linkauthority-publisher' ),
				),
			)
		);
	}

	public function notices() {
		if ( ! current_user_can( self::CAP ) ) {
			return;
		}
		$screen = get_current_screen();
		if ( $screen && 'toplevel_page_' . self::PAGE === $screen->id ) {
			if ( isset( $_GET['saved'] ) ) { // phpcs:ignore
				echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Settings saved.', 'linkauthority-publisher' ) . '</p></div>';
			}
			$just = get_transient( 'lapub_connected_' . get_current_user_id() );
			if ( $just ) {
				delete_transient( 'lapub_connected_' . get_current_user_id() );
				$names = array(
					'meta'      => __( 'Facebook & Instagram', 'linkauthority-publisher' ),
					'pinterest' => __( 'Pinterest', 'linkauthority-publisher' ),
					'linkedin'  => __( 'LinkedIn', 'linkauthority-publisher' ),
				);
				$label = $names[ $just ] ?? ucfirst( (string) $just );
				echo '<div class="notice notice-success is-dismissible"><p><strong>' . esc_html( sprintf(
					/* translators: %s: social network name */
					__( '%s connected.', 'linkauthority-publisher' ),
					$label
				) ) . '</strong> ' . esc_html__( 'New posts will be shared there automatically.', 'linkauthority-publisher' ) . '</p></div>';
			}
			if ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ) {
				echo '<div class="notice notice-info"><p>' . esc_html__( 'WP-Cron is disabled on this site (DISABLE_WP_CRON). Make sure a real system cron is calling wp-cron.php at least every minute so scheduled posts and Manus polling run reliably.', 'linkauthority-publisher' ) . '</p></div>';
			}
			return;
		}
		if ( ! LAPUB_Options::get( 'manus_api_key' ) ) {
			echo '<div class="notice notice-warning"><p>' . sprintf(
				/* translators: %s: settings link */
				esc_html__( 'LinkAuthority Publisher needs your Manus API key before it can write posts. %s', 'linkauthority-publisher' ),
				'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::PAGE ) ) . '">' . esc_html__( 'Open settings', 'linkauthority-publisher' ) . '</a>'
			) . '</p></div>';
		}
	}

	/* ------------------------------------------------------------------ */
	/* Save                                                                */
	/* ------------------------------------------------------------------ */

	public function save_settings() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'You are not allowed to do that.', 'linkauthority-publisher' ) );
		}
		check_admin_referer( 'lapub_save_settings' );

		$in  = isset( $_POST['lapub'] ) && is_array( $_POST['lapub'] ) ? wp_unslash( $_POST['lapub'] ) : array(); // phpcs:ignore
		$old = LAPUB_Options::all();
		$new = array();

		$text = function ( $k ) use ( $in ) {
			return isset( $in[ $k ] ) ? sanitize_text_field( $in[ $k ] ) : '';
		};

		// Keys: keep old value when the field is left blank (so the masked value is not wiped).
		foreach ( array( 'manus_api_key', 'pexels_api_key' ) as $k ) {
			$v         = isset( $in[ $k ] ) ? trim( (string) $in[ $k ] ) : '';
			$new[ $k ] = '' === $v ? $old[ $k ] : sanitize_text_field( $v );
			if ( isset( $in[ $k . '_clear' ] ) ) {
				$new[ $k ] = '';
			}
		}

		$new['manus_agent_profile'] = in_array( $text( 'manus_agent_profile' ), array( 'lite', 'standard', 'max' ), true ) ? $text( 'manus_agent_profile' ) : 'standard';
		$new['manus_locale']        = $text( 'manus_locale' );

		$new['enabled']       = empty( $in['enabled'] ) ? 0 : 1;
		$new['frequency']     = array_key_exists( $text( 'frequency' ), LAPUB_Options::frequencies() ) ? $text( 'frequency' ) : 'daily';
		$new['run_hour']      = max( 0, min( 23, (int) $text( 'run_hour' ) ) );
		$new['post_status']   = in_array( $text( 'post_status' ), array( 'publish', 'draft', 'pending' ), true ) ? $text( 'post_status' ) : 'publish';
		$new['post_author']   = (int) $text( 'post_author' );
		$new['post_category'] = (int) $text( 'post_category' );
		$new['min_words']     = max( 800, (int) $text( 'min_words' ) );
		$new['max_words']     = max( $new['min_words'] + 200, (int) $text( 'max_words' ) );

		$new['site_name']            = $text( 'site_name' );
		$new['site_url']             = esc_url_raw( $text( 'site_url' ) );
		$new['business_description'] = isset( $in['business_description'] ) ? sanitize_textarea_field( $in['business_description'] ) : '';
		$new['target_audience']      = isset( $in['target_audience'] ) ? sanitize_textarea_field( $in['target_audience'] ) : '';
		$new['focus_keywords']       = isset( $in['focus_keywords'] ) ? sanitize_textarea_field( $in['focus_keywords'] ) : '';
		$new['tone']                 = array_key_exists( $text( 'tone' ), LAPUB_Options::tones() ) ? $text( 'tone' ) : 'friendly-expert';
		$new['custom_instructions']  = isset( $in['custom_instructions'] ) ? sanitize_textarea_field( $in['custom_instructions'] ) : '';
		foreach ( array( 'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest' ) as $s ) {
			$new[ 'social_' . $s ] = esc_url_raw( $text( 'social_' . $s ) );
		}

		$new['use_pexels_photos']    = empty( $in['use_pexels_photos'] ) ? 0 : 1;
		$new['use_pexels_videos']    = empty( $in['use_pexels_videos'] ) ? 0 : 1;
		$new['store_pexels_locally'] = empty( $in['store_pexels_locally'] ) ? 0 : 1;
		$new['generate_featured']    = empty( $in['generate_featured'] ) ? 0 : 1;
		$new['add_schema']           = empty( $in['add_schema'] ) ? 0 : 1;
		$new['add_meta_description'] = empty( $in['add_meta_description'] ) ? 0 : 1;
		$new['max_pexels_media']     = max( 0, min( 15, (int) $text( 'max_pexels_media' ) ) );
		$c1                          = LAPUB_Options::hex( $text( 'accent_color' ) );
		$c2                          = LAPUB_Options::hex( $text( 'accent_color_2' ) );
		$new['accent_color']         = $c1 ? $c1 : '#6d28d9';
		$new['accent_color_2']       = $c2 ? $c2 : '#0ea5e9';

		$new = array_merge( $new, LAPUB_Admin_Social::sanitize( $in, $old ) );

		LAPUB_Options::update( $new );
		LAPUB_Scheduler::reschedule();

		$tab = isset( $_POST['lapub_tab'] ) ? sanitize_key( $_POST['lapub_tab'] ) : 'keys'; // phpcs:ignore
		wp_safe_redirect( add_query_arg( array( 'page' => self::PAGE, 'saved' => 1, 'tab' => $tab ), admin_url( 'admin.php' ) ) );
		exit;
	}

	/* ------------------------------------------------------------------ */
	/* AJAX                                                                */
	/* ------------------------------------------------------------------ */

	private function ajax_guard() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'linkauthority-publisher' ) ), 403 );
		}
		check_ajax_referer( 'lapub_ajax', 'nonce' );
	}

	public function ajax_generate_now() {
		$this->ajax_guard();
		$topic  = isset( $_POST['topic'] ) ? sanitize_text_field( wp_unslash( $_POST['topic'] ) ) : ''; // phpcs:ignore
		$result = LAPUB_Scheduler::instance()->start_job( 'manual', mb_substr( $topic, 0, 200 ) );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message(), 'status' => $this->status_payload() ) );
		}
		wp_send_json_success( array( 'message' => __( 'Manus task created.', 'linkauthority-publisher' ), 'status' => $this->status_payload() ) );
	}

	public function ajax_poll_now() {
		$this->ajax_guard();
		LAPUB_Scheduler::instance()->poll_job();
		wp_send_json_success( array( 'status' => $this->status_payload() ) );
	}

	public function ajax_cancel_job() {
		$this->ajax_guard();
		LAPUB_Scheduler::clear_job();
		LAPUB_Logger::warning( 'Generation job cancelled by the user.' );
		wp_send_json_success( array( 'status' => $this->status_payload() ) );
	}

	public function ajax_status() {
		$this->ajax_guard();
		wp_send_json_success( array( 'status' => $this->status_payload() ) );
	}

	public function ajax_test_manus() {
		$this->ajax_guard();
		$key    = isset( $_POST['key'] ) ? sanitize_text_field( wp_unslash( $_POST['key'] ) ) : ''; // phpcs:ignore
		$client = new LAPUB_Manus_Client( $key ? $key : null );
		$res    = $client->test_key();
		if ( is_wp_error( $res ) ) {
			wp_send_json_error( array( 'message' => $res->get_error_message() ) );
		}
		wp_send_json_success( array( 'message' => __( 'Manus API key works.', 'linkauthority-publisher' ) ) );
	}

	public function ajax_test_pexels() {
		$this->ajax_guard();
		$key    = isset( $_POST['key'] ) ? sanitize_text_field( wp_unslash( $_POST['key'] ) ) : ''; // phpcs:ignore
		$client = new LAPUB_Pexels_Client( $key ? $key : null );
		$res    = $client->test_key();
		if ( is_wp_error( $res ) ) {
			wp_send_json_error( array( 'message' => $res->get_error_message() ) );
		}
		wp_send_json_success( array( 'message' => __( 'Pexels API key works.', 'linkauthority-publisher' ) ) );
	}

	public function ajax_clear_log() {
		$this->ajax_guard();
		LAPUB_Logger::clear();
		wp_send_json_success();
	}

	/**
	 * Everything the status panel needs, as HTML + flags.
	 */
	private function status_payload() {
		ob_start();
		$this->render_status_panel();
		$html = ob_get_clean();

		ob_start();
		$this->render_log_table();
		$log = ob_get_clean();

		return array(
			'html'    => $html,
			'log'     => $log,
			'running' => (bool) LAPUB_Scheduler::get_job(),
		);
	}

	/* ------------------------------------------------------------------ */
	/* Rendering                                                           */
	/* ------------------------------------------------------------------ */

	private function tabs() {
		return array(
			'keys'     => __( 'API Keys', 'linkauthority-publisher' ),
			'schedule' => __( 'Schedule & Publishing', 'linkauthority-publisher' ),
			'business' => __( 'Business Profile', 'linkauthority-publisher' ),
			'media'    => __( 'Media & Style', 'linkauthority-publisher' ),
			'social'   => __( 'Social Sharing', 'linkauthority-publisher' ),
			'log'      => __( 'Activity Log', 'linkauthority-publisher' ),
		);
	}

	public function render() {
		if ( ! current_user_can( self::CAP ) ) {
			return;
		}
		$o    = LAPUB_Options::all();
		$tabs = $this->tabs();
		$tab  = isset( $_GET['tab'] ) && isset( $tabs[ sanitize_key( $_GET['tab'] ) ] ) ? sanitize_key( $_GET['tab'] ) : 'keys'; // phpcs:ignore
		?>
		<div class="wrap lapub-wrap">
			<div class="lapub-header">
				<div>
					<h1><span class="dashicons dashicons-edit-large"></span> <?php esc_html_e( 'LinkAuthority Publisher', 'linkauthority-publisher' ); ?></h1>
					<p class="lapub-tagline"><?php esc_html_e( 'Research-driven, long-form SEO articles written by Manus AI, illustrated with Manus + Pexels, published on your schedule.', 'linkauthority-publisher' ); ?></p>
				</div>
				<div class="lapub-header__actions">
					<input type="text" id="lapub-topic" class="lapub-topic" placeholder="<?php esc_attr_e( 'Optional: specific topic or title idea', 'linkauthority-publisher' ); ?>" maxlength="200" />
					<button type="button" class="button button-primary button-hero" id="lapub-generate-now"><span class="dashicons dashicons-controls-play"></span> <?php esc_html_e( 'Generate a post now', 'linkauthority-publisher' ); ?></button>
					<span class="lapub-header__hint"><?php esc_html_e( 'Leave the topic empty and Manus researches the best topic itself.', 'linkauthority-publisher' ); ?></span>
				</div>
			</div>

			<div id="lapub-status"><?php $this->render_status_panel(); ?></div>

			<h2 class="nav-tab-wrapper lapub-tabs">
				<?php foreach ( $tabs as $key => $label ) : ?>
					<a href="#" class="nav-tab <?php echo $tab === $key ? 'nav-tab-active' : ''; ?>" data-tab="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></a>
				<?php endforeach; ?>
			</h2>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="lapub-form">
				<?php wp_nonce_field( 'lapub_save_settings' ); ?>
				<input type="hidden" name="action" value="lapub_save_settings" />
				<input type="hidden" name="lapub_tab" id="lapub-current-tab" value="<?php echo esc_attr( $tab ); ?>" />

				<?php $this->tab_keys( $o, $tab ); ?>
				<?php $this->tab_schedule( $o, $tab ); ?>
				<?php $this->tab_business( $o, $tab ); ?>
				<?php $this->tab_media( $o, $tab ); ?>
				<?php LAPUB_Admin_Social::tab( $o, $tab ); ?>

				<div class="lapub-tab <?php echo 'log' === $tab ? 'is-active' : ''; ?>" data-tab="log">
					<div class="lapub-card">
						<div class="lapub-card__head">
							<h2><?php esc_html_e( 'Activity log', 'linkauthority-publisher' ); ?></h2>
							<button type="button" class="button" id="lapub-clear-log"><?php esc_html_e( 'Clear log', 'linkauthority-publisher' ); ?></button>
						</div>
						<div id="lapub-log"><?php $this->render_log_table(); ?></div>
					</div>
				</div>

				<p class="submit lapub-submit">
					<button type="submit" class="button button-primary button-large"><?php esc_html_e( 'Save settings', 'linkauthority-publisher' ); ?></button>
				</p>
			</form>
		</div>
		<?php
	}

	private function render_status_panel() {
		$o        = LAPUB_Options::all();
		$job      = LAPUB_Scheduler::get_job();
		$next     = LAPUB_Scheduler::next_scheduled();
		$last     = LAPUB_Scheduler::last_run();
		$fmt      = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		$has_keys = $o['manus_api_key'] ? true : false;
		?>
		<div class="lapub-status-grid">
			<div class="lapub-stat-card">
				<span class="lapub-stat-card__label"><?php esc_html_e( 'Automation', 'linkauthority-publisher' ); ?></span>
				<?php if ( ! $has_keys ) : ?>
					<span class="lapub-badge lapub-badge--warn"><?php esc_html_e( 'Missing Manus key', 'linkauthority-publisher' ); ?></span>
				<?php elseif ( $o['enabled'] && $next ) : ?>
					<span class="lapub-badge lapub-badge--ok"><?php esc_html_e( 'Enabled', 'linkauthority-publisher' ); ?></span>
					<span class="lapub-stat-card__sub"><?php echo esc_html( LAPUB_Options::frequencies()[ $o['frequency'] ] ); ?> &middot; <?php esc_html_e( 'next', 'linkauthority-publisher' ); ?> <?php echo esc_html( wp_date( $fmt, $next ) ); ?></span>
				<?php else : ?>
					<span class="lapub-badge"><?php esc_html_e( 'Paused', 'linkauthority-publisher' ); ?></span>
					<span class="lapub-stat-card__sub"><?php esc_html_e( 'Enable it in Schedule & Publishing.', 'linkauthority-publisher' ); ?></span>
				<?php endif; ?>
			</div>

			<div class="lapub-stat-card <?php echo $job ? 'is-running' : ''; ?>">
				<span class="lapub-stat-card__label"><?php esc_html_e( 'Current job', 'linkauthority-publisher' ); ?></span>
				<?php if ( $job ) : ?>
					<?php
					$stages = array(
						'content'  => __( 'Manus is researching & writing the article', 'linkauthority-publisher' ),
						'image'    => __( 'Manus is generating the featured image', 'linkauthority-publisher' ),
						'finalize' => __( 'Fetching Pexels media & building the post', 'linkauthority-publisher' ),
					);
					$url = 'image' === $job['stage'] && $job['image_task_url'] ? $job['image_task_url'] : $job['content_task_url'];
					?>
					<span class="lapub-badge lapub-badge--busy"><span class="lapub-spinner"></span> <?php echo esc_html( isset( $stages[ $job['stage'] ] ) ? $stages[ $job['stage'] ] : $job['stage'] ); ?></span>
					<span class="lapub-stat-card__sub">
						<?php printf( esc_html__( 'Started %s ago', 'linkauthority-publisher' ), esc_html( human_time_diff( (int) $job['started'] ) ) ); ?>
						<?php if ( $url ) : ?> &middot; <a href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Open in Manus', 'linkauthority-publisher' ); ?></a><?php endif; ?>
					</span>
					<span class="lapub-stat-card__actions">
						<button type="button" class="button button-small" id="lapub-poll-now"><?php esc_html_e( 'Check now', 'linkauthority-publisher' ); ?></button>
						<button type="button" class="button button-small button-link-delete" id="lapub-cancel-job"><?php esc_html_e( 'Cancel', 'linkauthority-publisher' ); ?></button>
					</span>
				<?php else : ?>
					<span class="lapub-badge"><?php esc_html_e( 'Idle', 'linkauthority-publisher' ); ?></span>
				<?php endif; ?>
			</div>

			<div class="lapub-stat-card">
				<span class="lapub-stat-card__label"><?php esc_html_e( 'Last run', 'linkauthority-publisher' ); ?></span>
				<?php if ( $last ) : ?>
					<span class="lapub-badge <?php echo 'success' === $last['status'] ? 'lapub-badge--ok' : 'lapub-badge--err'; ?>"><?php echo 'success' === $last['status'] ? esc_html__( 'Success', 'linkauthority-publisher' ) : esc_html__( 'Failed', 'linkauthority-publisher' ); ?></span>
					<span class="lapub-stat-card__sub">
						<?php echo esc_html( wp_date( $fmt, (int) $last['time'] ) ); ?>
						<?php if ( ! empty( $last['post_id'] ) && get_post( $last['post_id'] ) ) : ?>
							&middot; <a href="<?php echo esc_url( get_edit_post_link( $last['post_id'] ) ); ?>"><?php esc_html_e( 'Edit post', 'linkauthority-publisher' ); ?></a>
							&middot; <a href="<?php echo esc_url( get_permalink( $last['post_id'] ) ); ?>" target="_blank"><?php esc_html_e( 'View', 'linkauthority-publisher' ); ?></a>
						<?php else : ?>
							<br /><small><?php echo esc_html( $last['message'] ); ?></small>
						<?php endif; ?>
					</span>
				<?php else : ?>
					<span class="lapub-badge"><?php esc_html_e( 'Never', 'linkauthority-publisher' ); ?></span>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}

	private function render_log_table() {
		$entries = LAPUB_Logger::entries( 150 );
		if ( ! $entries ) {
			echo '<p class="description">' . esc_html__( 'Nothing logged yet.', 'linkauthority-publisher' ) . '</p>';
			return;
		}
		$fmt = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		echo '<table class="widefat striped lapub-log"><thead><tr><th style="width:170px">' . esc_html__( 'Time', 'linkauthority-publisher' ) . '</th><th style="width:90px">' . esc_html__( 'Level', 'linkauthority-publisher' ) . '</th><th>' . esc_html__( 'Message', 'linkauthority-publisher' ) . '</th></tr></thead><tbody>';
		foreach ( $entries as $e ) {
			$ctx = '';
			if ( ! empty( $e['context'] ) ) {
				$bits = array();
				foreach ( (array) $e['context'] as $k => $v ) {
					if ( is_scalar( $v ) ) {
						$v      = (string) $v;
						$bits[] = esc_html( $k ) . ': ' . ( preg_match( '#^https?://#', $v ) ? '<a href="' . esc_url( $v ) . '" target="_blank" rel="noopener">' . esc_html( $v ) . '</a>' : esc_html( $v ) );
					}
				}
				if ( $bits ) {
					$ctx = '<br /><small class="lapub-log__ctx">' . implode( ' &middot; ', $bits ) . '</small>';
				}
			}
			echo '<tr class="lapub-log__row lapub-log__row--' . esc_attr( $e['level'] ) . '"><td>' . esc_html( wp_date( $fmt, (int) $e['time'] ) ) . '</td><td><span class="lapub-level lapub-level--' . esc_attr( $e['level'] ) . '">' . esc_html( $e['level'] ) . '</span></td><td>' . esc_html( $e['message'] ) . $ctx . '</td></tr>';
		}
		echo '</tbody></table>';
	}

	/* ---- Tabs ---- */

	private function tab_keys( $o, $tab ) {
		?>
		<div class="lapub-tab <?php echo 'keys' === $tab ? 'is-active' : ''; ?>" data-tab="keys">
			<div class="lapub-card">
				<h2><?php esc_html_e( 'Manus AI', 'linkauthority-publisher' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Manus writes the article, researches the topic online and generates the featured image. Each post consumes Manus credits (roughly one article task plus one image task).', 'linkauthority-publisher' ); ?></p>
				<details class="lapub-guide"><summary><?php esc_html_e( 'How to get your Manus API key (2 minutes)', 'linkauthority-publisher' ); ?></summary>
					<ol>
						<li><?php printf( wp_kses_post( __( 'Go to <a href="%s" target="_blank" rel="noopener">manus.im</a> and sign in (or create a free account). The API needs a paid plan or purchased credits - the free tier can create tasks but has very few credits.', 'linkauthority-publisher' ) ), 'https://manus.im/' ); ?></li>
						<li><?php esc_html_e( 'Click your avatar / profile picture (bottom-left) → Settings.', 'linkauthority-publisher' ); ?></li>
						<li><?php esc_html_e( 'Open the "API" (or "API Keys") tab and click "Create API key". Give it a name such as "LinkAuthority Publisher".', 'linkauthority-publisher' ); ?></li>
						<li><?php esc_html_e( 'Copy the key immediately - Manus shows it only once - and paste it below, then click "Test connection".', 'linkauthority-publisher' ); ?></li>
						<li><?php printf( wp_kses_post( __( 'Optional: check credit usage and task history any time at <a href="%s" target="_blank" rel="noopener">manus.im</a>; every task the plugin creates also appears in your Manus task list with an "Open in Manus" link in the Activity Log.', 'linkauthority-publisher' ) ), 'https://manus.im/' ); ?></li>
					</ol>
					<p class="description"><?php esc_html_e( 'Tip: start with the "Standard" agent profile. "Lite" is cheaper but researches less; "Max" is the most thorough and uses the most credits.', 'linkauthority-publisher' ); ?></p>
				</details>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lapub-manus-key"><?php esc_html_e( 'Manus API key', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<div class="lapub-key-row">
								<input type="password" id="lapub-manus-key" name="lapub[manus_api_key]" class="regular-text" autocomplete="new-password" placeholder="<?php echo $o['manus_api_key'] ? esc_attr( str_repeat( '•', 12 ) . substr( $o['manus_api_key'], -4 ) ) : 'sk-…'; ?>" />
								<button type="button" class="button lapub-toggle-key" data-target="lapub-manus-key"><span class="dashicons dashicons-visibility"></span></button>
								<button type="button" class="button lapub-test-key" data-service="manus" data-input="lapub-manus-key"><?php esc_html_e( 'Test connection', 'linkauthority-publisher' ); ?></button>
								<span class="lapub-test-result"></span>
							</div>
							<?php if ( $o['manus_api_key'] ) : ?>
								<p class="description"><?php esc_html_e( 'A key is saved. Leave blank to keep it, or paste a new one to replace it.', 'linkauthority-publisher' ); ?> <label><input type="checkbox" name="lapub[manus_api_key_clear]" value="1" /> <?php esc_html_e( 'Remove saved key', 'linkauthority-publisher' ); ?></label></p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-agent-profile"><?php esc_html_e( 'Agent profile', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<select id="lapub-agent-profile" name="lapub[manus_agent_profile]">
								<option value="lite" <?php selected( $o['manus_agent_profile'], 'lite' ); ?>><?php esc_html_e( 'Lite - fastest & cheapest', 'linkauthority-publisher' ); ?></option>
								<option value="standard" <?php selected( $o['manus_agent_profile'], 'standard' ); ?>><?php esc_html_e( 'Standard - balanced (recommended)', 'linkauthority-publisher' ); ?></option>
								<option value="max" <?php selected( $o['manus_agent_profile'], 'max' ); ?>><?php esc_html_e( 'Max - deepest research, most credits', 'linkauthority-publisher' ); ?></option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-locale"><?php esc_html_e( 'Output language', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<input type="text" id="lapub-locale" name="lapub[manus_locale]" class="small-text" value="<?php echo esc_attr( $o['manus_locale'] ); ?>" placeholder="en" />
							<p class="description"><?php esc_html_e( 'Locale code such as en, es, fr, de, ar, ja. Leave empty to use your Manus account default.', 'linkauthority-publisher' ); ?></p>
						</td>
					</tr>
				</table>
			</div>

			<div class="lapub-card">
				<h2><?php esc_html_e( 'Pexels', 'linkauthority-publisher' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Pexels supplies free, copyright-safe photos and videos for the body of each article. The plugin credits the photographer automatically, as the Pexels licence requires. The API is free.', 'linkauthority-publisher' ); ?></p>
				<details class="lapub-guide"><summary><?php esc_html_e( 'How to get your Pexels API key (1 minute)', 'linkauthority-publisher' ); ?></summary>
					<ol>
						<li><?php printf( wp_kses_post( __( 'Go to <a href="%s" target="_blank" rel="noopener">pexels.com/api</a> and click "Get Started" (sign up or log in with a free Pexels account).', 'linkauthority-publisher' ) ), 'https://www.pexels.com/api/' ); ?></li>
						<li><?php esc_html_e( 'Fill in the short form: what you are building (e.g. "Blog images for my website"), your website URL, and agree to the API terms.', 'linkauthority-publisher' ); ?></li>
						<li><?php printf( wp_kses_post( __( 'Your key is shown right away and can always be found again at <a href="%s" target="_blank" rel="noopener">pexels.com/api/new</a> under "Your API Key".', 'linkauthority-publisher' ) ), 'https://www.pexels.com/api/new/' ); ?></li>
						<li><?php esc_html_e( 'Paste it below and click "Test connection".', 'linkauthority-publisher' ); ?></li>
					</ol>
					<p class="description"><?php esc_html_e( 'Free limit: 200 requests per hour / 20,000 per month - one article uses about 10 requests, so this is more than enough.', 'linkauthority-publisher' ); ?></p>
				</details>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lapub-pexels-key"><?php esc_html_e( 'Pexels API key', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<div class="lapub-key-row">
								<input type="password" id="lapub-pexels-key" name="lapub[pexels_api_key]" class="regular-text" autocomplete="new-password" placeholder="<?php echo $o['pexels_api_key'] ? esc_attr( str_repeat( '•', 12 ) . substr( $o['pexels_api_key'], -4 ) ) : ''; ?>" />
								<button type="button" class="button lapub-toggle-key" data-target="lapub-pexels-key"><span class="dashicons dashicons-visibility"></span></button>
								<button type="button" class="button lapub-test-key" data-service="pexels" data-input="lapub-pexels-key"><?php esc_html_e( 'Test connection', 'linkauthority-publisher' ); ?></button>
								<span class="lapub-test-result"></span>
							</div>
							<?php if ( $o['pexels_api_key'] ) : ?>
								<p class="description"><?php esc_html_e( 'A key is saved. Leave blank to keep it.', 'linkauthority-publisher' ); ?> <label><input type="checkbox" name="lapub[pexels_api_key_clear]" value="1" /> <?php esc_html_e( 'Remove saved key', 'linkauthority-publisher' ); ?></label></p>
							<?php endif; ?>
						</td>
					</tr>
				</table>
			</div>
		</div>
		<?php
	}

	private function tab_schedule( $o, $tab ) {
		$users = get_users( array( 'capability' => 'edit_posts', 'fields' => array( 'ID', 'display_name' ), 'number' => 200 ) );
		?>
		<div class="lapub-tab <?php echo 'schedule' === $tab ? 'is-active' : ''; ?>" data-tab="schedule">
			<div class="lapub-card">
				<h2><?php esc_html_e( 'Automatic schedule', 'linkauthority-publisher' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Automation', 'linkauthority-publisher' ); ?></th>
						<td>
							<label class="lapub-switch"><input type="checkbox" name="lapub[enabled]" value="1" <?php checked( $o['enabled'] ); ?> /> <span><?php esc_html_e( 'Generate posts automatically on the schedule below', 'linkauthority-publisher' ); ?></span></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-frequency"><?php esc_html_e( 'Frequency', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<select id="lapub-frequency" name="lapub[frequency]">
								<?php foreach ( LAPUB_Options::frequencies() as $k => $label ) : ?>
									<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $o['frequency'], $k ); ?>><?php echo esc_html( $label ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-hour"><?php esc_html_e( 'Start time', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<select id="lapub-hour" name="lapub[run_hour]">
								<?php for ( $h = 0; $h < 24; $h++ ) : ?>
									<option value="<?php echo (int) $h; ?>" <?php selected( (int) $o['run_hour'], $h ); ?>><?php echo esc_html( sprintf( '%02d:00', $h ) ); ?></option>
								<?php endfor; ?>
							</select>
							<p class="description"><?php printf( esc_html__( 'Site timezone: %s. Generation starts at this hour; the post appears roughly 10-30 minutes later once Manus finishes.', 'linkauthority-publisher' ), esc_html( wp_timezone_string() ) ); ?></p>
						</td>
					</tr>
				</table>
			</div>

			<div class="lapub-card">
				<h2><?php esc_html_e( 'Publishing', 'linkauthority-publisher' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lapub-status-select"><?php esc_html_e( 'Post status', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<select id="lapub-status-select" name="lapub[post_status]">
								<option value="publish" <?php selected( $o['post_status'], 'publish' ); ?>><?php esc_html_e( 'Publish immediately', 'linkauthority-publisher' ); ?></option>
								<option value="draft" <?php selected( $o['post_status'], 'draft' ); ?>><?php esc_html_e( 'Save as draft (review first)', 'linkauthority-publisher' ); ?></option>
								<option value="pending" <?php selected( $o['post_status'], 'pending' ); ?>><?php esc_html_e( 'Pending review', 'linkauthority-publisher' ); ?></option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-author"><?php esc_html_e( 'Post author', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<select id="lapub-author" name="lapub[post_author]">
								<?php foreach ( $users as $u ) : ?>
									<option value="<?php echo (int) $u->ID; ?>" <?php selected( (int) $o['post_author'], (int) $u->ID ); ?>><?php echo esc_html( $u->display_name ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-category"><?php esc_html_e( 'Category', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<?php
							wp_dropdown_categories(
								array(
									'name'             => 'lapub[post_category]',
									'id'               => 'lapub-category',
									'selected'         => (int) $o['post_category'],
									'show_option_none' => __( 'Let Manus choose / create a category', 'linkauthority-publisher' ),
									'option_none_value' => 0,
									'hide_empty'       => false,
									'hierarchical'     => true,
								)
							);
							?>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Article length', 'linkauthority-publisher' ); ?></th>
						<td>
							<input type="number" name="lapub[min_words]" class="small-text" min="800" step="50" value="<?php echo (int) $o['min_words']; ?>" /> &ndash;
							<input type="number" name="lapub[max_words]" class="small-text" min="1000" step="50" value="<?php echo (int) $o['max_words']; ?>" /> <?php esc_html_e( 'words', 'linkauthority-publisher' ); ?>
							<p class="description"><?php esc_html_e( 'Default 2,500-3,000. If Manus returns a noticeably shorter article the plugin automatically asks it once to expand.', 'linkauthority-publisher' ); ?></p>
						</td>
					</tr>
				</table>
			</div>
		</div>
		<?php
	}

	private function tab_business( $o, $tab ) {
		?>
		<div class="lapub-tab <?php echo 'business' === $tab ? 'is-active' : ''; ?>" data-tab="business">
			<div class="lapub-card">
				<h2><?php esc_html_e( 'About your business / website', 'linkauthority-publisher' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Everything here is sent to Manus with every article request. The more specific you are, the better the topics and the more relevant the traffic.', 'linkauthority-publisher' ); ?></p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lapub-site-name"><?php esc_html_e( 'Business / site name', 'linkauthority-publisher' ); ?></label></th>
						<td><input type="text" id="lapub-site-name" name="lapub[site_name]" class="regular-text" value="<?php echo esc_attr( $o['site_name'] ); ?>" placeholder="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-site-url"><?php esc_html_e( 'Website URL', 'linkauthority-publisher' ); ?></label></th>
						<td><input type="url" id="lapub-site-url" name="lapub[site_url]" class="regular-text" value="<?php echo esc_attr( $o['site_url'] ); ?>" placeholder="<?php echo esc_attr( home_url( '/' ) ); ?>" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-desc"><?php esc_html_e( 'Description', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<textarea id="lapub-desc" name="lapub[business_description]" rows="6" class="large-text" placeholder="<?php esc_attr_e( 'What do you sell or do? Where are you based? What makes you different? Which products/services should articles promote?', 'linkauthority-publisher' ); ?>"><?php echo esc_textarea( $o['business_description'] ); ?></textarea>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-audience"><?php esc_html_e( 'Target audience', 'linkauthority-publisher' ); ?></label></th>
						<td><textarea id="lapub-audience" name="lapub[target_audience]" rows="3" class="large-text" placeholder="<?php esc_attr_e( 'e.g. Homeowners in Ohio aged 30-55 looking for energy-efficient renovations', 'linkauthority-publisher' ); ?>"><?php echo esc_textarea( $o['target_audience'] ); ?></textarea></td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-keywords"><?php esc_html_e( 'Priority keywords / topics', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<textarea id="lapub-keywords" name="lapub[focus_keywords]" rows="3" class="large-text" placeholder="<?php esc_attr_e( 'Comma-separated, e.g. kitchen remodel cost, best countertop materials, small bathroom ideas', 'linkauthority-publisher' ); ?>"><?php echo esc_textarea( $o['focus_keywords'] ); ?></textarea>
							<p class="description"><?php esc_html_e( 'Manus researches search demand around these and picks a fresh angle each time, avoiding topics you already covered.', 'linkauthority-publisher' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-tone"><?php esc_html_e( 'Brand voice', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<select id="lapub-tone" name="lapub[tone]">
								<?php foreach ( LAPUB_Options::tones() as $k => $label ) : ?>
									<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $o['tone'], $k ); ?>><?php echo esc_html( $label ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-custom"><?php esc_html_e( 'Extra instructions', 'linkauthority-publisher' ); ?></label></th>
						<td><textarea id="lapub-custom" name="lapub[custom_instructions]" rows="3" class="large-text" placeholder="<?php esc_attr_e( 'Optional. e.g. Always mention our free consultation. Never discuss competitors by name. Use British spelling.', 'linkauthority-publisher' ); ?>"><?php echo esc_textarea( $o['custom_instructions'] ); ?></textarea></td>
					</tr>
				</table>
			</div>

			<div class="lapub-card">
				<h2><?php esc_html_e( 'Social media', 'linkauthority-publisher' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Shown as follow buttons in the call-to-action at the end of every post and added to the article schema (sameAs).', 'linkauthority-publisher' ); ?></p>
				<table class="form-table" role="presentation">
					<?php
					$socials = array(
						'facebook'  => 'Facebook',
						'instagram' => 'Instagram',
						'twitter'   => 'X (Twitter)',
						'linkedin'  => 'LinkedIn',
						'youtube'   => 'YouTube',
						'tiktok'    => 'TikTok',
						'pinterest' => 'Pinterest',
					);
					foreach ( $socials as $k => $label ) :
						?>
						<tr>
							<th scope="row"><label for="lapub-social-<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $label ); ?></label></th>
							<td><input type="url" id="lapub-social-<?php echo esc_attr( $k ); ?>" name="lapub[social_<?php echo esc_attr( $k ); ?>]" class="regular-text" value="<?php echo esc_attr( $o[ 'social_' . $k ] ); ?>" placeholder="https://" /></td>
						</tr>
					<?php endforeach; ?>
				</table>
			</div>
		</div>
		<?php
	}

	private function tab_media( $o, $tab ) {
		?>
		<div class="lapub-tab <?php echo 'media' === $tab ? 'is-active' : ''; ?>" data-tab="media">
			<div class="lapub-card">
				<h2><?php esc_html_e( 'Images & video', 'linkauthority-publisher' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Featured image', 'linkauthority-publisher' ); ?></th>
						<td><label><input type="checkbox" name="lapub[generate_featured]" value="1" <?php checked( $o['generate_featured'] ); ?> /> <?php esc_html_e( 'Generate a unique featured image with Manus (falls back to a Pexels photo if it fails)', 'linkauthority-publisher' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Pexels media', 'linkauthority-publisher' ); ?></th>
						<td>
							<label><input type="checkbox" name="lapub[use_pexels_photos]" value="1" <?php checked( $o['use_pexels_photos'] ); ?> /> <?php esc_html_e( 'Insert Pexels photos inside sections', 'linkauthority-publisher' ); ?></label><br />
							<label><input type="checkbox" name="lapub[use_pexels_videos]" value="1" <?php checked( $o['use_pexels_videos'] ); ?> /> <?php esc_html_e( 'Insert Pexels videos (max 2 per post)', 'linkauthority-publisher' ); ?></label><br />
							<label><input type="checkbox" name="lapub[store_pexels_locally]" value="1" <?php checked( $o['store_pexels_locally'] ); ?> /> <?php esc_html_e( 'Download photos into the Media Library (recommended; videos are always streamed from Pexels)', 'linkauthority-publisher' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-max-media"><?php esc_html_e( 'Max media items per post', 'linkauthority-publisher' ); ?></label></th>
						<td><input type="number" id="lapub-max-media" name="lapub[max_pexels_media]" class="small-text" min="0" max="15" value="<?php echo (int) $o['max_pexels_media']; ?>" /></td>
					</tr>
				</table>
			</div>

			<div class="lapub-card">
				<h2><?php esc_html_e( 'Styling', 'linkauthority-publisher' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Generated posts get a magazine-style layout: key-takeaways card, table of contents, numbered sections, pull-stats, pro-tip callouts, an FAQ accordion and a gradient call-to-action with your social links. Pick two brand colours for the gradient accents.', 'linkauthority-publisher' ); ?></p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lapub-accent"><?php esc_html_e( 'Primary accent', 'linkauthority-publisher' ); ?></label></th>
						<td><input type="text" id="lapub-accent" name="lapub[accent_color]" class="lapub-color" value="<?php echo esc_attr( $o['accent_color'] ); ?>" data-default-color="#6d28d9" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-accent-2"><?php esc_html_e( 'Secondary accent', 'linkauthority-publisher' ); ?></label></th>
						<td><input type="text" id="lapub-accent-2" name="lapub[accent_color_2]" class="lapub-color" value="<?php echo esc_attr( $o['accent_color_2'] ); ?>" data-default-color="#0ea5e9" /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'SEO extras', 'linkauthority-publisher' ); ?></th>
						<td>
							<label><input type="checkbox" name="lapub[add_schema]" value="1" <?php checked( $o['add_schema'] ); ?> /> <?php esc_html_e( 'Output BlogPosting + FAQPage JSON-LD schema', 'linkauthority-publisher' ); ?></label><br />
							<label><input type="checkbox" name="lapub[add_meta_description]" value="1" <?php checked( $o['add_meta_description'] ); ?> /> <?php esc_html_e( 'Output meta description (skipped automatically when Yoast, Rank Math, AIOSEO or SEOPress is active - their fields are filled instead)', 'linkauthority-publisher' ); ?></label>
						</td>
					</tr>
				</table>
			</div>
		</div>
		<?php
	}
}
