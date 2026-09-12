<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Settings page, AJAX actions and admin notices.
 */
class MAB_Admin {

	const PAGE = 'manus-auto-blogger';
	const CAP  = 'manage_options';

	/** @var MAB_Admin */
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
		add_action( 'admin_post_mab_save_settings', array( $this, 'save_settings' ) );
		add_action( 'admin_notices', array( $this, 'notices' ) );

		foreach ( array( 'generate_now', 'poll_now', 'cancel_job', 'test_manus', 'test_pexels', 'clear_log', 'status' ) as $action ) {
			add_action( 'wp_ajax_mab_' . $action, array( $this, 'ajax_' . $action ) );
		}
	}

	public function menu() {
		add_menu_page(
			__( 'Manus Auto Blogger', 'manus-auto-blogger' ),
			__( 'Auto Blogger', 'manus-auto-blogger' ),
			self::CAP,
			self::PAGE,
			array( $this, 'render' ),
			'dashicons-edit-large',
			26
		);
		add_submenu_page( self::PAGE, __( 'Settings', 'manus-auto-blogger' ), __( 'Settings', 'manus-auto-blogger' ), self::CAP, self::PAGE, array( $this, 'render' ) );
		add_submenu_page( self::PAGE, __( 'Social Posts', 'manus-auto-blogger' ), __( 'Social Posts', 'manus-auto-blogger' ), 'edit_posts', self::PAGE . '-social', array( 'MAB_Admin_Social', 'render_posts_page' ) );
	}

	public function assets( $hook ) {
		if ( 'toplevel_page_' . self::PAGE !== $hook && false === strpos( $hook, self::PAGE . '-social' ) ) {
			return;
		}
		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_script( 'wp-color-picker' );
		wp_enqueue_style( 'mab-admin', MAB_URL . 'assets/css/admin.css', array(), MAB_VERSION );
		wp_enqueue_script( 'mab-admin', MAB_URL . 'assets/js/admin.js', array( 'jquery', 'wp-color-picker' ), MAB_VERSION, true );
		wp_localize_script(
			'mab-admin',
			'MAB',
			array(
				'ajax'  => admin_url( 'admin-ajax.php' ),
				'nonce' => wp_create_nonce( 'mab_ajax' ),
				'i18n'  => array(
					'working'   => __( 'Working…', 'manus-auto-blogger' ),
					'testing'   => __( 'Testing…', 'manus-auto-blogger' ),
					'ok'        => __( 'Connected', 'manus-auto-blogger' ),
					'confirm'   => __( 'Cancel the running generation job?', 'manus-auto-blogger' ),
					'clearlog'  => __( 'Clear the activity log?', 'manus-auto-blogger' ),
					'generated' => __( 'Generation started. Manus usually needs 5-20 minutes to research and write the article; this page will keep checking.', 'manus-auto-blogger' ),
					'popup'     => __( 'The popup was blocked. Allow popups for this site and try again.', 'manus-auto-blogger' ),
					'disconnect' => __( 'Disconnect this account?', 'manus-auto-blogger' ),
					'copied'    => __( 'Copied', 'manus-auto-blogger' ),
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
				echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Settings saved.', 'manus-auto-blogger' ) . '</p></div>';
			}
			if ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ) {
				echo '<div class="notice notice-info"><p>' . esc_html__( 'WP-Cron is disabled on this site (DISABLE_WP_CRON). Make sure a real system cron is calling wp-cron.php at least every minute so scheduled posts and Manus polling run reliably.', 'manus-auto-blogger' ) . '</p></div>';
			}
			return;
		}
		if ( ! MAB_Options::get( 'manus_api_key' ) ) {
			echo '<div class="notice notice-warning"><p>' . sprintf(
				/* translators: %s: settings link */
				esc_html__( 'Manus Auto Blogger needs your Manus API key before it can write posts. %s', 'manus-auto-blogger' ),
				'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::PAGE ) ) . '">' . esc_html__( 'Open settings', 'manus-auto-blogger' ) . '</a>'
			) . '</p></div>';
		}
	}

	/* ------------------------------------------------------------------ */
	/* Save                                                                */
	/* ------------------------------------------------------------------ */

	public function save_settings() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'You are not allowed to do that.', 'manus-auto-blogger' ) );
		}
		check_admin_referer( 'mab_save_settings' );

		$in  = isset( $_POST['mab'] ) && is_array( $_POST['mab'] ) ? wp_unslash( $_POST['mab'] ) : array(); // phpcs:ignore
		$old = MAB_Options::all();
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
		$new['frequency']     = array_key_exists( $text( 'frequency' ), MAB_Options::frequencies() ) ? $text( 'frequency' ) : 'daily';
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
		$new['tone']                 = array_key_exists( $text( 'tone' ), MAB_Options::tones() ) ? $text( 'tone' ) : 'friendly-expert';
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
		$c1                          = MAB_Options::hex( $text( 'accent_color' ) );
		$c2                          = MAB_Options::hex( $text( 'accent_color_2' ) );
		$new['accent_color']         = $c1 ? $c1 : '#6d28d9';
		$new['accent_color_2']       = $c2 ? $c2 : '#0ea5e9';

		$new = array_merge( $new, MAB_Admin_Social::sanitize( $in, $old ) );

		MAB_Options::update( $new );
		MAB_Scheduler::reschedule();

		$tab = isset( $_POST['mab_tab'] ) ? sanitize_key( $_POST['mab_tab'] ) : 'keys'; // phpcs:ignore
		wp_safe_redirect( add_query_arg( array( 'page' => self::PAGE, 'saved' => 1, 'tab' => $tab ), admin_url( 'admin.php' ) ) );
		exit;
	}

	/* ------------------------------------------------------------------ */
	/* AJAX                                                                */
	/* ------------------------------------------------------------------ */

	private function ajax_guard() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_send_json_error( array( 'message' => __( 'Not allowed.', 'manus-auto-blogger' ) ), 403 );
		}
		check_ajax_referer( 'mab_ajax', 'nonce' );
	}

	public function ajax_generate_now() {
		$this->ajax_guard();
		$topic  = isset( $_POST['topic'] ) ? sanitize_text_field( wp_unslash( $_POST['topic'] ) ) : ''; // phpcs:ignore
		$result = MAB_Scheduler::instance()->start_job( 'manual', mb_substr( $topic, 0, 200 ) );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message(), 'status' => $this->status_payload() ) );
		}
		wp_send_json_success( array( 'message' => __( 'Manus task created.', 'manus-auto-blogger' ), 'status' => $this->status_payload() ) );
	}

	public function ajax_poll_now() {
		$this->ajax_guard();
		MAB_Scheduler::instance()->poll_job();
		wp_send_json_success( array( 'status' => $this->status_payload() ) );
	}

	public function ajax_cancel_job() {
		$this->ajax_guard();
		MAB_Scheduler::clear_job();
		MAB_Logger::warning( 'Generation job cancelled by the user.' );
		wp_send_json_success( array( 'status' => $this->status_payload() ) );
	}

	public function ajax_status() {
		$this->ajax_guard();
		wp_send_json_success( array( 'status' => $this->status_payload() ) );
	}

	public function ajax_test_manus() {
		$this->ajax_guard();
		$key    = isset( $_POST['key'] ) ? sanitize_text_field( wp_unslash( $_POST['key'] ) ) : ''; // phpcs:ignore
		$client = new MAB_Manus_Client( $key ? $key : null );
		$res    = $client->test_key();
		if ( is_wp_error( $res ) ) {
			wp_send_json_error( array( 'message' => $res->get_error_message() ) );
		}
		wp_send_json_success( array( 'message' => __( 'Manus API key works.', 'manus-auto-blogger' ) ) );
	}

	public function ajax_test_pexels() {
		$this->ajax_guard();
		$key    = isset( $_POST['key'] ) ? sanitize_text_field( wp_unslash( $_POST['key'] ) ) : ''; // phpcs:ignore
		$client = new MAB_Pexels_Client( $key ? $key : null );
		$res    = $client->test_key();
		if ( is_wp_error( $res ) ) {
			wp_send_json_error( array( 'message' => $res->get_error_message() ) );
		}
		wp_send_json_success( array( 'message' => __( 'Pexels API key works.', 'manus-auto-blogger' ) ) );
	}

	public function ajax_clear_log() {
		$this->ajax_guard();
		MAB_Logger::clear();
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
			'running' => (bool) MAB_Scheduler::get_job(),
		);
	}

	/* ------------------------------------------------------------------ */
	/* Rendering                                                           */
	/* ------------------------------------------------------------------ */

	private function tabs() {
		return array(
			'keys'     => __( 'API Keys', 'manus-auto-blogger' ),
			'schedule' => __( 'Schedule & Publishing', 'manus-auto-blogger' ),
			'business' => __( 'Business Profile', 'manus-auto-blogger' ),
			'media'    => __( 'Media & Style', 'manus-auto-blogger' ),
			'social'   => __( 'Social Sharing', 'manus-auto-blogger' ),
			'log'      => __( 'Activity Log', 'manus-auto-blogger' ),
		);
	}

	public function render() {
		if ( ! current_user_can( self::CAP ) ) {
			return;
		}
		$o    = MAB_Options::all();
		$tabs = $this->tabs();
		$tab  = isset( $_GET['tab'] ) && isset( $tabs[ sanitize_key( $_GET['tab'] ) ] ) ? sanitize_key( $_GET['tab'] ) : 'keys'; // phpcs:ignore
		?>
		<div class="wrap mab-wrap">
			<div class="mab-header">
				<div>
					<h1><span class="dashicons dashicons-edit-large"></span> <?php esc_html_e( 'Manus Auto Blogger', 'manus-auto-blogger' ); ?></h1>
					<p class="mab-tagline"><?php esc_html_e( 'Research-driven, long-form SEO articles written by Manus AI, illustrated with Manus + Pexels, published on your schedule.', 'manus-auto-blogger' ); ?></p>
				</div>
				<div class="mab-header__actions">
					<input type="text" id="mab-topic" class="mab-topic" placeholder="<?php esc_attr_e( 'Optional: specific topic or title idea', 'manus-auto-blogger' ); ?>" maxlength="200" />
					<button type="button" class="button button-primary button-hero" id="mab-generate-now"><span class="dashicons dashicons-controls-play"></span> <?php esc_html_e( 'Generate a post now', 'manus-auto-blogger' ); ?></button>
					<span class="mab-header__hint"><?php esc_html_e( 'Leave the topic empty and Manus researches the best topic itself.', 'manus-auto-blogger' ); ?></span>
				</div>
			</div>

			<div id="mab-status"><?php $this->render_status_panel(); ?></div>

			<h2 class="nav-tab-wrapper mab-tabs">
				<?php foreach ( $tabs as $key => $label ) : ?>
					<a href="#" class="nav-tab <?php echo $tab === $key ? 'nav-tab-active' : ''; ?>" data-tab="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></a>
				<?php endforeach; ?>
			</h2>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="mab-form">
				<?php wp_nonce_field( 'mab_save_settings' ); ?>
				<input type="hidden" name="action" value="mab_save_settings" />
				<input type="hidden" name="mab_tab" id="mab-current-tab" value="<?php echo esc_attr( $tab ); ?>" />

				<?php $this->tab_keys( $o, $tab ); ?>
				<?php $this->tab_schedule( $o, $tab ); ?>
				<?php $this->tab_business( $o, $tab ); ?>
				<?php $this->tab_media( $o, $tab ); ?>
				<?php MAB_Admin_Social::tab( $o, $tab ); ?>

				<div class="mab-tab <?php echo 'log' === $tab ? 'is-active' : ''; ?>" data-tab="log">
					<div class="mab-card">
						<div class="mab-card__head">
							<h2><?php esc_html_e( 'Activity log', 'manus-auto-blogger' ); ?></h2>
							<button type="button" class="button" id="mab-clear-log"><?php esc_html_e( 'Clear log', 'manus-auto-blogger' ); ?></button>
						</div>
						<div id="mab-log"><?php $this->render_log_table(); ?></div>
					</div>
				</div>

				<p class="submit mab-submit">
					<button type="submit" class="button button-primary button-large"><?php esc_html_e( 'Save settings', 'manus-auto-blogger' ); ?></button>
				</p>
			</form>
		</div>
		<?php
	}

	private function render_status_panel() {
		$o        = MAB_Options::all();
		$job      = MAB_Scheduler::get_job();
		$next     = MAB_Scheduler::next_scheduled();
		$last     = MAB_Scheduler::last_run();
		$fmt      = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		$has_keys = $o['manus_api_key'] ? true : false;
		?>
		<div class="mab-status-grid">
			<div class="mab-stat-card">
				<span class="mab-stat-card__label"><?php esc_html_e( 'Automation', 'manus-auto-blogger' ); ?></span>
				<?php if ( ! $has_keys ) : ?>
					<span class="mab-badge mab-badge--warn"><?php esc_html_e( 'Missing Manus key', 'manus-auto-blogger' ); ?></span>
				<?php elseif ( $o['enabled'] && $next ) : ?>
					<span class="mab-badge mab-badge--ok"><?php esc_html_e( 'Enabled', 'manus-auto-blogger' ); ?></span>
					<span class="mab-stat-card__sub"><?php echo esc_html( MAB_Options::frequencies()[ $o['frequency'] ] ); ?> &middot; <?php esc_html_e( 'next', 'manus-auto-blogger' ); ?> <?php echo esc_html( wp_date( $fmt, $next ) ); ?></span>
				<?php else : ?>
					<span class="mab-badge"><?php esc_html_e( 'Paused', 'manus-auto-blogger' ); ?></span>
					<span class="mab-stat-card__sub"><?php esc_html_e( 'Enable it in Schedule & Publishing.', 'manus-auto-blogger' ); ?></span>
				<?php endif; ?>
			</div>

			<div class="mab-stat-card <?php echo $job ? 'is-running' : ''; ?>">
				<span class="mab-stat-card__label"><?php esc_html_e( 'Current job', 'manus-auto-blogger' ); ?></span>
				<?php if ( $job ) : ?>
					<?php
					$stages = array(
						'content'  => __( 'Manus is researching & writing the article', 'manus-auto-blogger' ),
						'image'    => __( 'Manus is generating the featured image', 'manus-auto-blogger' ),
						'finalize' => __( 'Fetching Pexels media & building the post', 'manus-auto-blogger' ),
					);
					$url = 'image' === $job['stage'] && $job['image_task_url'] ? $job['image_task_url'] : $job['content_task_url'];
					?>
					<span class="mab-badge mab-badge--busy"><span class="mab-spinner"></span> <?php echo esc_html( isset( $stages[ $job['stage'] ] ) ? $stages[ $job['stage'] ] : $job['stage'] ); ?></span>
					<span class="mab-stat-card__sub">
						<?php printf( esc_html__( 'Started %s ago', 'manus-auto-blogger' ), esc_html( human_time_diff( (int) $job['started'] ) ) ); ?>
						<?php if ( $url ) : ?> &middot; <a href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Open in Manus', 'manus-auto-blogger' ); ?></a><?php endif; ?>
					</span>
					<span class="mab-stat-card__actions">
						<button type="button" class="button button-small" id="mab-poll-now"><?php esc_html_e( 'Check now', 'manus-auto-blogger' ); ?></button>
						<button type="button" class="button button-small button-link-delete" id="mab-cancel-job"><?php esc_html_e( 'Cancel', 'manus-auto-blogger' ); ?></button>
					</span>
				<?php else : ?>
					<span class="mab-badge"><?php esc_html_e( 'Idle', 'manus-auto-blogger' ); ?></span>
				<?php endif; ?>
			</div>

			<div class="mab-stat-card">
				<span class="mab-stat-card__label"><?php esc_html_e( 'Last run', 'manus-auto-blogger' ); ?></span>
				<?php if ( $last ) : ?>
					<span class="mab-badge <?php echo 'success' === $last['status'] ? 'mab-badge--ok' : 'mab-badge--err'; ?>"><?php echo 'success' === $last['status'] ? esc_html__( 'Success', 'manus-auto-blogger' ) : esc_html__( 'Failed', 'manus-auto-blogger' ); ?></span>
					<span class="mab-stat-card__sub">
						<?php echo esc_html( wp_date( $fmt, (int) $last['time'] ) ); ?>
						<?php if ( ! empty( $last['post_id'] ) && get_post( $last['post_id'] ) ) : ?>
							&middot; <a href="<?php echo esc_url( get_edit_post_link( $last['post_id'] ) ); ?>"><?php esc_html_e( 'Edit post', 'manus-auto-blogger' ); ?></a>
							&middot; <a href="<?php echo esc_url( get_permalink( $last['post_id'] ) ); ?>" target="_blank"><?php esc_html_e( 'View', 'manus-auto-blogger' ); ?></a>
						<?php else : ?>
							<br /><small><?php echo esc_html( $last['message'] ); ?></small>
						<?php endif; ?>
					</span>
				<?php else : ?>
					<span class="mab-badge"><?php esc_html_e( 'Never', 'manus-auto-blogger' ); ?></span>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}

	private function render_log_table() {
		$entries = MAB_Logger::entries( 150 );
		if ( ! $entries ) {
			echo '<p class="description">' . esc_html__( 'Nothing logged yet.', 'manus-auto-blogger' ) . '</p>';
			return;
		}
		$fmt = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		echo '<table class="widefat striped mab-log"><thead><tr><th style="width:170px">' . esc_html__( 'Time', 'manus-auto-blogger' ) . '</th><th style="width:90px">' . esc_html__( 'Level', 'manus-auto-blogger' ) . '</th><th>' . esc_html__( 'Message', 'manus-auto-blogger' ) . '</th></tr></thead><tbody>';
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
					$ctx = '<br /><small class="mab-log__ctx">' . implode( ' &middot; ', $bits ) . '</small>';
				}
			}
			echo '<tr class="mab-log__row mab-log__row--' . esc_attr( $e['level'] ) . '"><td>' . esc_html( wp_date( $fmt, (int) $e['time'] ) ) . '</td><td><span class="mab-level mab-level--' . esc_attr( $e['level'] ) . '">' . esc_html( $e['level'] ) . '</span></td><td>' . esc_html( $e['message'] ) . $ctx . '</td></tr>';
		}
		echo '</tbody></table>';
	}

	/* ---- Tabs ---- */

	private function tab_keys( $o, $tab ) {
		?>
		<div class="mab-tab <?php echo 'keys' === $tab ? 'is-active' : ''; ?>" data-tab="keys">
			<div class="mab-card">
				<h2><?php esc_html_e( 'Manus AI', 'manus-auto-blogger' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Manus writes the article, researches the topic online and generates the featured image. Each post consumes Manus credits (roughly one article task plus one image task).', 'manus-auto-blogger' ); ?></p>
				<details class="mab-guide"><summary><?php esc_html_e( 'How to get your Manus API key (2 minutes)', 'manus-auto-blogger' ); ?></summary>
					<ol>
						<li><?php printf( wp_kses_post( __( 'Go to <a href="%s" target="_blank" rel="noopener">manus.im</a> and sign in (or create a free account). The API needs a paid plan or purchased credits - the free tier can create tasks but has very few credits.', 'manus-auto-blogger' ) ), 'https://manus.im/' ); ?></li>
						<li><?php esc_html_e( 'Click your avatar / profile picture (bottom-left) → Settings.', 'manus-auto-blogger' ); ?></li>
						<li><?php esc_html_e( 'Open the "API" (or "API Keys") tab and click "Create API key". Give it a name such as "WordPress Auto Blogger".', 'manus-auto-blogger' ); ?></li>
						<li><?php esc_html_e( 'Copy the key immediately - Manus shows it only once - and paste it below, then click "Test connection".', 'manus-auto-blogger' ); ?></li>
						<li><?php printf( wp_kses_post( __( 'Optional: check credit usage and task history any time at <a href="%s" target="_blank" rel="noopener">manus.im</a>; every task the plugin creates also appears in your Manus task list with an "Open in Manus" link in the Activity Log.', 'manus-auto-blogger' ) ), 'https://manus.im/' ); ?></li>
					</ol>
					<p class="description"><?php esc_html_e( 'Tip: start with the "Standard" agent profile. "Lite" is cheaper but researches less; "Max" is the most thorough and uses the most credits.', 'manus-auto-blogger' ); ?></p>
				</details>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="mab-manus-key"><?php esc_html_e( 'Manus API key', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<div class="mab-key-row">
								<input type="password" id="mab-manus-key" name="mab[manus_api_key]" class="regular-text" autocomplete="new-password" placeholder="<?php echo $o['manus_api_key'] ? esc_attr( str_repeat( '•', 12 ) . substr( $o['manus_api_key'], -4 ) ) : 'sk-…'; ?>" />
								<button type="button" class="button mab-toggle-key" data-target="mab-manus-key"><span class="dashicons dashicons-visibility"></span></button>
								<button type="button" class="button mab-test-key" data-service="manus" data-input="mab-manus-key"><?php esc_html_e( 'Test connection', 'manus-auto-blogger' ); ?></button>
								<span class="mab-test-result"></span>
							</div>
							<?php if ( $o['manus_api_key'] ) : ?>
								<p class="description"><?php esc_html_e( 'A key is saved. Leave blank to keep it, or paste a new one to replace it.', 'manus-auto-blogger' ); ?> <label><input type="checkbox" name="mab[manus_api_key_clear]" value="1" /> <?php esc_html_e( 'Remove saved key', 'manus-auto-blogger' ); ?></label></p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-agent-profile"><?php esc_html_e( 'Agent profile', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<select id="mab-agent-profile" name="mab[manus_agent_profile]">
								<option value="lite" <?php selected( $o['manus_agent_profile'], 'lite' ); ?>><?php esc_html_e( 'Lite - fastest & cheapest', 'manus-auto-blogger' ); ?></option>
								<option value="standard" <?php selected( $o['manus_agent_profile'], 'standard' ); ?>><?php esc_html_e( 'Standard - balanced (recommended)', 'manus-auto-blogger' ); ?></option>
								<option value="max" <?php selected( $o['manus_agent_profile'], 'max' ); ?>><?php esc_html_e( 'Max - deepest research, most credits', 'manus-auto-blogger' ); ?></option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-locale"><?php esc_html_e( 'Output language', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<input type="text" id="mab-locale" name="mab[manus_locale]" class="small-text" value="<?php echo esc_attr( $o['manus_locale'] ); ?>" placeholder="en" />
							<p class="description"><?php esc_html_e( 'Locale code such as en, es, fr, de, ar, ja. Leave empty to use your Manus account default.', 'manus-auto-blogger' ); ?></p>
						</td>
					</tr>
				</table>
			</div>

			<div class="mab-card">
				<h2><?php esc_html_e( 'Pexels', 'manus-auto-blogger' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Pexels supplies free, copyright-safe photos and videos for the body of each article. The plugin credits the photographer automatically, as the Pexels licence requires. The API is free.', 'manus-auto-blogger' ); ?></p>
				<details class="mab-guide"><summary><?php esc_html_e( 'How to get your Pexels API key (1 minute)', 'manus-auto-blogger' ); ?></summary>
					<ol>
						<li><?php printf( wp_kses_post( __( 'Go to <a href="%s" target="_blank" rel="noopener">pexels.com/api</a> and click "Get Started" (sign up or log in with a free Pexels account).', 'manus-auto-blogger' ) ), 'https://www.pexels.com/api/' ); ?></li>
						<li><?php esc_html_e( 'Fill in the short form: what you are building (e.g. "Blog images for my website"), your website URL, and agree to the API terms.', 'manus-auto-blogger' ); ?></li>
						<li><?php printf( wp_kses_post( __( 'Your key is shown right away and can always be found again at <a href="%s" target="_blank" rel="noopener">pexels.com/api/new</a> under "Your API Key".', 'manus-auto-blogger' ) ), 'https://www.pexels.com/api/new/' ); ?></li>
						<li><?php esc_html_e( 'Paste it below and click "Test connection".', 'manus-auto-blogger' ); ?></li>
					</ol>
					<p class="description"><?php esc_html_e( 'Free limit: 200 requests per hour / 20,000 per month - one article uses about 10 requests, so this is more than enough.', 'manus-auto-blogger' ); ?></p>
				</details>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="mab-pexels-key"><?php esc_html_e( 'Pexels API key', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<div class="mab-key-row">
								<input type="password" id="mab-pexels-key" name="mab[pexels_api_key]" class="regular-text" autocomplete="new-password" placeholder="<?php echo $o['pexels_api_key'] ? esc_attr( str_repeat( '•', 12 ) . substr( $o['pexels_api_key'], -4 ) ) : ''; ?>" />
								<button type="button" class="button mab-toggle-key" data-target="mab-pexels-key"><span class="dashicons dashicons-visibility"></span></button>
								<button type="button" class="button mab-test-key" data-service="pexels" data-input="mab-pexels-key"><?php esc_html_e( 'Test connection', 'manus-auto-blogger' ); ?></button>
								<span class="mab-test-result"></span>
							</div>
							<?php if ( $o['pexels_api_key'] ) : ?>
								<p class="description"><?php esc_html_e( 'A key is saved. Leave blank to keep it.', 'manus-auto-blogger' ); ?> <label><input type="checkbox" name="mab[pexels_api_key_clear]" value="1" /> <?php esc_html_e( 'Remove saved key', 'manus-auto-blogger' ); ?></label></p>
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
		<div class="mab-tab <?php echo 'schedule' === $tab ? 'is-active' : ''; ?>" data-tab="schedule">
			<div class="mab-card">
				<h2><?php esc_html_e( 'Automatic schedule', 'manus-auto-blogger' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Automation', 'manus-auto-blogger' ); ?></th>
						<td>
							<label class="mab-switch"><input type="checkbox" name="mab[enabled]" value="1" <?php checked( $o['enabled'] ); ?> /> <span><?php esc_html_e( 'Generate posts automatically on the schedule below', 'manus-auto-blogger' ); ?></span></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-frequency"><?php esc_html_e( 'Frequency', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<select id="mab-frequency" name="mab[frequency]">
								<?php foreach ( MAB_Options::frequencies() as $k => $label ) : ?>
									<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $o['frequency'], $k ); ?>><?php echo esc_html( $label ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-hour"><?php esc_html_e( 'Start time', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<select id="mab-hour" name="mab[run_hour]">
								<?php for ( $h = 0; $h < 24; $h++ ) : ?>
									<option value="<?php echo (int) $h; ?>" <?php selected( (int) $o['run_hour'], $h ); ?>><?php echo esc_html( sprintf( '%02d:00', $h ) ); ?></option>
								<?php endfor; ?>
							</select>
							<p class="description"><?php printf( esc_html__( 'Site timezone: %s. Generation starts at this hour; the post appears roughly 10-30 minutes later once Manus finishes.', 'manus-auto-blogger' ), esc_html( wp_timezone_string() ) ); ?></p>
						</td>
					</tr>
				</table>
			</div>

			<div class="mab-card">
				<h2><?php esc_html_e( 'Publishing', 'manus-auto-blogger' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="mab-status-select"><?php esc_html_e( 'Post status', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<select id="mab-status-select" name="mab[post_status]">
								<option value="publish" <?php selected( $o['post_status'], 'publish' ); ?>><?php esc_html_e( 'Publish immediately', 'manus-auto-blogger' ); ?></option>
								<option value="draft" <?php selected( $o['post_status'], 'draft' ); ?>><?php esc_html_e( 'Save as draft (review first)', 'manus-auto-blogger' ); ?></option>
								<option value="pending" <?php selected( $o['post_status'], 'pending' ); ?>><?php esc_html_e( 'Pending review', 'manus-auto-blogger' ); ?></option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-author"><?php esc_html_e( 'Post author', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<select id="mab-author" name="mab[post_author]">
								<?php foreach ( $users as $u ) : ?>
									<option value="<?php echo (int) $u->ID; ?>" <?php selected( (int) $o['post_author'], (int) $u->ID ); ?>><?php echo esc_html( $u->display_name ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-category"><?php esc_html_e( 'Category', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<?php
							wp_dropdown_categories(
								array(
									'name'             => 'mab[post_category]',
									'id'               => 'mab-category',
									'selected'         => (int) $o['post_category'],
									'show_option_none' => __( 'Let Manus choose / create a category', 'manus-auto-blogger' ),
									'option_none_value' => 0,
									'hide_empty'       => false,
									'hierarchical'     => true,
								)
							);
							?>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Article length', 'manus-auto-blogger' ); ?></th>
						<td>
							<input type="number" name="mab[min_words]" class="small-text" min="800" step="50" value="<?php echo (int) $o['min_words']; ?>" /> &ndash;
							<input type="number" name="mab[max_words]" class="small-text" min="1000" step="50" value="<?php echo (int) $o['max_words']; ?>" /> <?php esc_html_e( 'words', 'manus-auto-blogger' ); ?>
							<p class="description"><?php esc_html_e( 'Default 2,500-3,000. If Manus returns a noticeably shorter article the plugin automatically asks it once to expand.', 'manus-auto-blogger' ); ?></p>
						</td>
					</tr>
				</table>
			</div>
		</div>
		<?php
	}

	private function tab_business( $o, $tab ) {
		?>
		<div class="mab-tab <?php echo 'business' === $tab ? 'is-active' : ''; ?>" data-tab="business">
			<div class="mab-card">
				<h2><?php esc_html_e( 'About your business / website', 'manus-auto-blogger' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Everything here is sent to Manus with every article request. The more specific you are, the better the topics and the more relevant the traffic.', 'manus-auto-blogger' ); ?></p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="mab-site-name"><?php esc_html_e( 'Business / site name', 'manus-auto-blogger' ); ?></label></th>
						<td><input type="text" id="mab-site-name" name="mab[site_name]" class="regular-text" value="<?php echo esc_attr( $o['site_name'] ); ?>" placeholder="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-site-url"><?php esc_html_e( 'Website URL', 'manus-auto-blogger' ); ?></label></th>
						<td><input type="url" id="mab-site-url" name="mab[site_url]" class="regular-text" value="<?php echo esc_attr( $o['site_url'] ); ?>" placeholder="<?php echo esc_attr( home_url( '/' ) ); ?>" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-desc"><?php esc_html_e( 'Description', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<textarea id="mab-desc" name="mab[business_description]" rows="6" class="large-text" placeholder="<?php esc_attr_e( 'What do you sell or do? Where are you based? What makes you different? Which products/services should articles promote?', 'manus-auto-blogger' ); ?>"><?php echo esc_textarea( $o['business_description'] ); ?></textarea>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-audience"><?php esc_html_e( 'Target audience', 'manus-auto-blogger' ); ?></label></th>
						<td><textarea id="mab-audience" name="mab[target_audience]" rows="3" class="large-text" placeholder="<?php esc_attr_e( 'e.g. Homeowners in Ohio aged 30-55 looking for energy-efficient renovations', 'manus-auto-blogger' ); ?>"><?php echo esc_textarea( $o['target_audience'] ); ?></textarea></td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-keywords"><?php esc_html_e( 'Priority keywords / topics', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<textarea id="mab-keywords" name="mab[focus_keywords]" rows="3" class="large-text" placeholder="<?php esc_attr_e( 'Comma-separated, e.g. kitchen remodel cost, best countertop materials, small bathroom ideas', 'manus-auto-blogger' ); ?>"><?php echo esc_textarea( $o['focus_keywords'] ); ?></textarea>
							<p class="description"><?php esc_html_e( 'Manus researches search demand around these and picks a fresh angle each time, avoiding topics you already covered.', 'manus-auto-blogger' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-tone"><?php esc_html_e( 'Brand voice', 'manus-auto-blogger' ); ?></label></th>
						<td>
							<select id="mab-tone" name="mab[tone]">
								<?php foreach ( MAB_Options::tones() as $k => $label ) : ?>
									<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $o['tone'], $k ); ?>><?php echo esc_html( $label ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-custom"><?php esc_html_e( 'Extra instructions', 'manus-auto-blogger' ); ?></label></th>
						<td><textarea id="mab-custom" name="mab[custom_instructions]" rows="3" class="large-text" placeholder="<?php esc_attr_e( 'Optional. e.g. Always mention our free consultation. Never discuss competitors by name. Use British spelling.', 'manus-auto-blogger' ); ?>"><?php echo esc_textarea( $o['custom_instructions'] ); ?></textarea></td>
					</tr>
				</table>
			</div>

			<div class="mab-card">
				<h2><?php esc_html_e( 'Social media', 'manus-auto-blogger' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Shown as follow buttons in the call-to-action at the end of every post and added to the article schema (sameAs).', 'manus-auto-blogger' ); ?></p>
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
							<th scope="row"><label for="mab-social-<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $label ); ?></label></th>
							<td><input type="url" id="mab-social-<?php echo esc_attr( $k ); ?>" name="mab[social_<?php echo esc_attr( $k ); ?>]" class="regular-text" value="<?php echo esc_attr( $o[ 'social_' . $k ] ); ?>" placeholder="https://" /></td>
						</tr>
					<?php endforeach; ?>
				</table>
			</div>
		</div>
		<?php
	}

	private function tab_media( $o, $tab ) {
		?>
		<div class="mab-tab <?php echo 'media' === $tab ? 'is-active' : ''; ?>" data-tab="media">
			<div class="mab-card">
				<h2><?php esc_html_e( 'Images & video', 'manus-auto-blogger' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Featured image', 'manus-auto-blogger' ); ?></th>
						<td><label><input type="checkbox" name="mab[generate_featured]" value="1" <?php checked( $o['generate_featured'] ); ?> /> <?php esc_html_e( 'Generate a unique featured image with Manus (falls back to a Pexels photo if it fails)', 'manus-auto-blogger' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Pexels media', 'manus-auto-blogger' ); ?></th>
						<td>
							<label><input type="checkbox" name="mab[use_pexels_photos]" value="1" <?php checked( $o['use_pexels_photos'] ); ?> /> <?php esc_html_e( 'Insert Pexels photos inside sections', 'manus-auto-blogger' ); ?></label><br />
							<label><input type="checkbox" name="mab[use_pexels_videos]" value="1" <?php checked( $o['use_pexels_videos'] ); ?> /> <?php esc_html_e( 'Insert Pexels videos (max 2 per post)', 'manus-auto-blogger' ); ?></label><br />
							<label><input type="checkbox" name="mab[store_pexels_locally]" value="1" <?php checked( $o['store_pexels_locally'] ); ?> /> <?php esc_html_e( 'Download photos into the Media Library (recommended; videos are always streamed from Pexels)', 'manus-auto-blogger' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-max-media"><?php esc_html_e( 'Max media items per post', 'manus-auto-blogger' ); ?></label></th>
						<td><input type="number" id="mab-max-media" name="mab[max_pexels_media]" class="small-text" min="0" max="15" value="<?php echo (int) $o['max_pexels_media']; ?>" /></td>
					</tr>
				</table>
			</div>

			<div class="mab-card">
				<h2><?php esc_html_e( 'Styling', 'manus-auto-blogger' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Generated posts get a magazine-style layout: key-takeaways card, table of contents, numbered sections, pull-stats, pro-tip callouts, an FAQ accordion and a gradient call-to-action with your social links. Pick two brand colours for the gradient accents.', 'manus-auto-blogger' ); ?></p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="mab-accent"><?php esc_html_e( 'Primary accent', 'manus-auto-blogger' ); ?></label></th>
						<td><input type="text" id="mab-accent" name="mab[accent_color]" class="mab-color" value="<?php echo esc_attr( $o['accent_color'] ); ?>" data-default-color="#6d28d9" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="mab-accent-2"><?php esc_html_e( 'Secondary accent', 'manus-auto-blogger' ); ?></label></th>
						<td><input type="text" id="mab-accent-2" name="mab[accent_color_2]" class="mab-color" value="<?php echo esc_attr( $o['accent_color_2'] ); ?>" data-default-color="#0ea5e9" /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'SEO extras', 'manus-auto-blogger' ); ?></th>
						<td>
							<label><input type="checkbox" name="mab[add_schema]" value="1" <?php checked( $o['add_schema'] ); ?> /> <?php esc_html_e( 'Output BlogPosting + FAQPage JSON-LD schema', 'manus-auto-blogger' ); ?></label><br />
							<label><input type="checkbox" name="mab[add_meta_description]" value="1" <?php checked( $o['add_meta_description'] ); ?> /> <?php esc_html_e( 'Output meta description (skipped automatically when Yoast, Rank Math, AIOSEO or SEOPress is active - their fields are filled instead)', 'manus-auto-blogger' ); ?></label>
						</td>
					</tr>
				</table>
			</div>
		</div>
		<?php
	}
}
