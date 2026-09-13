<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin UI for social sharing: the "Social Sharing" settings tab and the "Social Posts" list page.
 */
class LAPUB_Admin_Social {

	/* ------------------------------------------------------------------ */
	/* Settings tab                                                        */
	/* ------------------------------------------------------------------ */

	public static function tab( $o, $tab ) {
		$redirect = LAPUB_OAuth::redirect_uri();
		$is_https = 0 === strpos( home_url(), 'https://' );
		?>
		<div class="lapub-tab <?php echo 'social' === $tab ? 'is-active' : ''; ?>" data-tab="social">

			<div class="lapub-card">
				<h2><?php esc_html_e( 'Automatic sharing', 'linkauthority-publisher' ); ?></h2>
				<p class="description"><?php esc_html_e( 'When a generated post is published, share it using the featured image and the platform-specific captions Manus writes with every article. Any post can also be shared manually from its edit screen.', 'linkauthority-publisher' ); ?></p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Auto-share', 'linkauthority-publisher' ); ?></th>
						<td><label class="lapub-switch"><input type="checkbox" name="lapub[auto_share]" value="1" <?php checked( $o['auto_share'] ); ?> /> <span><?php esc_html_e( 'Share every generated post automatically when it is published', 'linkauthority-publisher' ); ?></span></label></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Platforms', 'linkauthority-publisher' ); ?></th>
						<td>
							<?php foreach ( LAPUB_Social_Accounts::platforms() as $key => $label ) : ?>
								<label style="display:inline-block;margin-right:18px"><input type="checkbox" name="lapub[share_<?php echo esc_attr( $key ); ?>]" value="1" <?php checked( $o[ 'share_' . $key ] ); ?> /> <?php echo esc_html( $label ); ?></label>
							<?php endforeach; ?>
							<p class="description"><?php esc_html_e( 'Applies to direct posting (Option B). Option A sends everything to Make and your scenario decides.', 'linkauthority-publisher' ); ?></p>
						</td>
					</tr>
				</table>
			</div>

			<div class="lapub-card">
				<h2><span class="lapub-opt">A</span> <?php esc_html_e( 'Make.com webhook', 'linkauthority-publisher' ); ?></h2>
				<p class="description"><?php esc_html_e( 'The plugin POSTs a JSON payload to your Make webhook after each post is published; your Make scenario handles Facebook, Instagram, Pinterest, LinkedIn, Google Sheets or anything else.', 'linkauthority-publisher' ); ?></p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Enable', 'linkauthority-publisher' ); ?></th>
						<td><label><input type="checkbox" name="lapub[make_enabled]" value="1" <?php checked( $o['make_enabled'] ); ?> /> <?php esc_html_e( 'Send published posts to Make.com', 'linkauthority-publisher' ); ?></label></td>
					</tr>
					<tr>
						<th scope="row"><label for="lapub-make-url"><?php esc_html_e( 'Webhook URL', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<div class="lapub-key-row">
								<input type="url" id="lapub-make-url" name="lapub[make_webhook_url]" class="regular-text" value="<?php echo esc_attr( $o['make_webhook_url'] ); ?>" placeholder="https://hook.eu1.make.com/xxxxxxxx" />
								<button type="button" class="button" id="lapub-webhook-test"><?php esc_html_e( 'Send test payload', 'linkauthority-publisher' ); ?></button>
								<span class="lapub-test-result"></span>
							</div>
							<details class="lapub-details"><summary><?php esc_html_e( 'Payload fields sent to Make', 'linkauthority-publisher' ); ?></summary>
<pre class="lapub-pre">{
  "event": "post_published",
  "post_id": 123,
  "title": "…", "url": "https://…", "excerpt": "…",
  "meta_description": "…", "focus_keyword": "…",
  "tags": ["…"], "categories": ["…"], "hashtags": "#… #…",
  "featured_image_url": "https://…/image.png",
  "featured_image_jpeg_url": "https://…/image-social.jpg",
  "published_at": "2026-09-13T08:15:00+00:00",
  "author": "…", "site_name": "…", "site_url": "https://…",
  "social": {
    "facebook_post": "…", "instagram_caption": "…",
    "pinterest_title": "…", "pinterest_description": "…",
    "linkedin_post": "…"
  }
}</pre>
							<p class="description"><?php esc_html_e( 'In Make: Webhooks → Custom webhook → copy its URL here → click "Send test payload" so Make learns the structure → map the fields into your Facebook / Instagram / Pinterest / LinkedIn / Google Sheets modules.', 'linkauthority-publisher' ); ?></p>
							</details>
						</td>
					</tr>
				</table>
			</div>

			<div class="lapub-card">
				<h2><span class="lapub-opt">B</span> <?php esc_html_e( 'Direct posting from WordPress', 'linkauthority-publisher' ); ?></h2>
				<p class="description">
					<?php esc_html_e( 'Connect your accounts and the plugin posts directly from this website. The easiest way is through LinkAuthority Connect: click Connect, log in to the network in the popup and choose your page, board or profile - no developer apps needed. Advanced users can use their own developer apps instead (see the fold-out on each card).', 'linkauthority-publisher' ); ?>
				</p>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="lapub-cloud-license"><?php esc_html_e( 'LinkAuthority licence key', 'linkauthority-publisher' ); ?></label></th>
						<td>
							<div class="lapub-key-row">
								<input type="text" id="lapub-cloud-license" name="lapub[cloud_license]" class="regular-text" value="<?php echo esc_attr( $o['cloud_license'] ); ?>" placeholder="LAP-XXXX-XXXX-XXXX" />
								<button type="button" class="button" id="lapub-cloud-verify"><?php esc_html_e( 'Check licence', 'linkauthority-publisher' ); ?></button>
								<span class="lapub-test-result"></span>
							</div>
							<p class="description"><?php esc_html_e( 'Included with your purchase. Required for the one-click Connect buttons; not needed when you use your own developer apps.', 'linkauthority-publisher' ); ?></p>
						</td>
					</tr>
					<tr class="lapub-advanced-row">
						<th scope="row"><label for="lapub-cloud-url"><?php esc_html_e( 'Connect server', 'linkauthority-publisher' ); ?></label></th>
						<td><input type="url" id="lapub-cloud-url" name="lapub[cloud_url]" class="regular-text" value="<?php echo esc_attr( $o['cloud_url'] ); ?>" /> <span class="description"><?php esc_html_e( 'Leave as is unless support tells you otherwise.', 'linkauthority-publisher' ); ?></span></td>
					</tr>
				</table>
				<p class="lapub-redirect"><strong><?php esc_html_e( 'Redirect URL (only needed for your own developer apps):', 'linkauthority-publisher' ); ?></strong> <code id="lapub-redirect-uri"><?php echo esc_html( $redirect ); ?></code> <button type="button" class="button button-small lapub-copy" data-copy="<?php echo esc_attr( $redirect ); ?>"><?php esc_html_e( 'Copy', 'linkauthority-publisher' ); ?></button></p>
				<?php if ( ! $is_https ) : ?>
					<div class="notice notice-warning inline"><p><?php esc_html_e( 'Your site is not using HTTPS. Meta, Pinterest and LinkedIn require an https:// redirect URL, and Instagram/Pinterest must be able to download your featured images from a public URL - localhost or staging sites behind a login will not work.', 'linkauthority-publisher' ); ?></p></div>
				<?php endif; ?>

				<div class="lapub-platforms">
					<?php self::platform_card_meta( $o ); ?>
					<?php self::platform_card_pinterest( $o ); ?>
					<?php self::platform_card_linkedin( $o ); ?>
				</div>
			</div>
		</div>
		<?php
	}

	private static function status_badge( $connected, $text ) {
		echo '<span class="lapub-badge ' . ( $connected ? 'lapub-badge--ok' : '' ) . '">' . esc_html( $text ) . '</span>';
	}

	private static function platform_card_meta( $o ) {
		$m  = LAPUB_Social_Accounts::get( 'meta' );
		$fb = LAPUB_Social_Accounts::facebook_page();
		$ig = LAPUB_Social_Accounts::instagram_account();
		?>
		<div class="lapub-platform">
			<div class="lapub-platform__head">
				<span class="lapub-platform__icon lapub-platform__icon--meta">f</span>
				<div>
					<h3><?php esc_html_e( 'Facebook Page & Instagram', 'linkauthority-publisher' ); ?></h3>
					<p class="description"><?php esc_html_e( 'Instagram must be a Business/Creator account linked to your Facebook Page.', 'linkauthority-publisher' ); ?></p>
				</div>
			</div>
			<div class="lapub-platform__status">
				<?php self::status_badge( (bool) $fb, $fb ? 'Facebook: ' . $fb['name'] : __( 'Facebook not connected', 'linkauthority-publisher' ) ); ?>
				<?php self::status_badge( (bool) $ig, $ig ? 'Instagram: @' . $ig['ig_username'] : __( 'Instagram not connected', 'linkauthority-publisher' ) ); ?>
				<?php self::via_badge( $m ); ?>
				<?php if ( ! empty( $m['expires'] ) ) : ?><span class="description"><?php printf( esc_html__( 'Token valid until %s', 'linkauthority-publisher' ), esc_html( wp_date( get_option( 'date_format' ), (int) $m['expires'] ) ) ); ?></span><?php endif; ?>
			</div>
			<p class="lapub-platform__actions">
				<button type="button" class="button button-primary lapub-connect-cloud" data-provider="meta"><?php echo $fb || $ig ? esc_html__( 'Reconnect / change pages', 'linkauthority-publisher' ) : esc_html__( 'Connect Facebook & Instagram', 'linkauthority-publisher' ); ?></button>
				<?php if ( $m ) : ?><button type="button" class="button lapub-disconnect" data-provider="meta"><?php esc_html_e( 'Disconnect', 'linkauthority-publisher' ); ?></button><?php endif; ?>
			</p>
			<details class="lapub-details lapub-details--own"><summary><?php esc_html_e( 'Advanced: use my own Meta app instead', 'linkauthority-publisher' ); ?></summary>
				<table class="form-table lapub-compact" role="presentation">
					<tr><th><label for="lapub-meta-id"><?php esc_html_e( 'App ID', 'linkauthority-publisher' ); ?></label></th><td><input type="text" id="lapub-meta-id" name="lapub[meta_app_id]" class="regular-text" value="<?php echo esc_attr( $o['meta_app_id'] ); ?>" /></td></tr>
					<tr><th><label for="lapub-meta-secret"><?php esc_html_e( 'App Secret', 'linkauthority-publisher' ); ?></label></th><td><input type="password" id="lapub-meta-secret" name="lapub[meta_app_secret]" class="regular-text" autocomplete="new-password" value="<?php echo esc_attr( $o['meta_app_secret'] ); ?>" /></td></tr>
					<tr><th><label for="lapub-meta-config"><?php esc_html_e( 'Login Configuration ID', 'linkauthority-publisher' ); ?></label></th><td><input type="text" id="lapub-meta-config" name="lapub[meta_config_id]" class="regular-text" value="<?php echo esc_attr( $o['meta_config_id'] ); ?>" /> <span class="description"><?php esc_html_e( 'Optional. From Facebook Login for Business → Configurations.', 'linkauthority-publisher' ); ?></span></td></tr>
				</table>
				<ol class="lapub-steps">
					<li><?php printf( wp_kses_post( __( 'Go to <a href="%s" target="_blank" rel="noopener">developers.facebook.com/apps</a> → Create App → use case "Other" → type "Business".', 'linkauthority-publisher' ) ), 'https://developers.facebook.com/apps/' ); ?></li>
					<li><?php esc_html_e( 'Add the products "Facebook Login for Business" and "Instagram → API setup with Facebook login". In Facebook Login for Business → Settings paste the redirect URL shown above into "Valid OAuth Redirect URIs".', 'linkauthority-publisher' ); ?></li>
					<li><?php esc_html_e( 'App settings → Basic: copy App ID and App Secret here, add your domain to App Domains, save. Keep the app in Development mode - that is enough for pages you administer.', 'linkauthority-publisher' ); ?></li>
				</ol>
				<p><button type="button" class="button lapub-connect" data-provider="meta"><?php esc_html_e( 'Connect with my own app', 'linkauthority-publisher' ); ?></button></p>
			</details>
		</div>
		<?php
	}

	private static function platform_card_pinterest( $o ) {
		$p = LAPUB_Social_Accounts::get( 'pinterest' );
		$b = LAPUB_Social_Accounts::pinterest_board();
		?>
		<div class="lapub-platform">
			<div class="lapub-platform__head">
				<span class="lapub-platform__icon lapub-platform__icon--pinterest">P</span>
				<div>
					<h3><?php esc_html_e( 'Pinterest', 'linkauthority-publisher' ); ?></h3>
					<p class="description"><?php esc_html_e( 'Creates a Pin with the featured image, title, description and a link back to the article. Requires a Pinterest business account.', 'linkauthority-publisher' ); ?></p>
				</div>
			</div>
			<div class="lapub-platform__status">
				<?php self::status_badge( (bool) $b, $b ? '@' . $b['username'] . ' → ' . $b['board_name'] : __( 'Not connected', 'linkauthority-publisher' ) ); ?>
				<?php self::via_badge( $p ); ?>
			</div>
			<p class="lapub-platform__actions">
				<button type="button" class="button button-primary lapub-connect-cloud" data-provider="pinterest"><?php echo $b ? esc_html__( 'Reconnect / change board', 'linkauthority-publisher' ) : esc_html__( 'Connect Pinterest', 'linkauthority-publisher' ); ?></button>
				<?php if ( $p ) : ?><button type="button" class="button lapub-disconnect" data-provider="pinterest"><?php esc_html_e( 'Disconnect', 'linkauthority-publisher' ); ?></button><?php endif; ?>
			</p>
			<details class="lapub-details lapub-details--own"><summary><?php esc_html_e( 'Advanced: use my own Pinterest app instead', 'linkauthority-publisher' ); ?></summary>
				<table class="form-table lapub-compact" role="presentation">
					<tr><th><label for="lapub-pin-id"><?php esc_html_e( 'App ID', 'linkauthority-publisher' ); ?></label></th><td><input type="text" id="lapub-pin-id" name="lapub[pinterest_app_id]" class="regular-text" value="<?php echo esc_attr( $o['pinterest_app_id'] ); ?>" /></td></tr>
					<tr><th><label for="lapub-pin-secret"><?php esc_html_e( 'App Secret', 'linkauthority-publisher' ); ?></label></th><td><input type="password" id="lapub-pin-secret" name="lapub[pinterest_app_secret]" class="regular-text" autocomplete="new-password" value="<?php echo esc_attr( $o['pinterest_app_secret'] ); ?>" /></td></tr>
				</table>
				<ol class="lapub-steps">
					<li><?php printf( wp_kses_post( __( 'Go to <a href="%s" target="_blank" rel="noopener">developers.pinterest.com/apps</a> (business account) → Create app.', 'linkauthority-publisher' ) ), 'https://developers.pinterest.com/apps/' ); ?></li>
					<li><?php esc_html_e( 'Add the redirect URL shown above under "Redirect URIs"; copy the App ID and App secret key here.', 'linkauthority-publisher' ); ?></li>
					<li><?php esc_html_e( 'Request "Trial access" so the app may create pins on your own account.', 'linkauthority-publisher' ); ?></li>
				</ol>
				<p><button type="button" class="button lapub-connect" data-provider="pinterest"><?php esc_html_e( 'Connect with my own app', 'linkauthority-publisher' ); ?></button></p>
			</details>
		</div>
		<?php
	}

	private static function platform_card_linkedin( $o ) {
		$l = LAPUB_Social_Accounts::get( 'linkedin' );
		$a = LAPUB_Social_Accounts::linkedin_author();
		?>
		<div class="lapub-platform">
			<div class="lapub-platform__head">
				<span class="lapub-platform__icon lapub-platform__icon--linkedin">in</span>
				<div>
					<h3><?php esc_html_e( 'LinkedIn', 'linkauthority-publisher' ); ?></h3>
					<p class="description"><?php esc_html_e( 'Shares the article with its preview card on your personal profile (Company Pages need extra LinkedIn approval).', 'linkauthority-publisher' ); ?></p>
				</div>
			</div>
			<div class="lapub-platform__status">
				<?php self::status_badge( (bool) $a, $a ? $a['author_name'] : __( 'Not connected', 'linkauthority-publisher' ) ); ?>
				<?php self::via_badge( $l ); ?>
				<?php if ( ! empty( $l['expires'] ) ) : ?><span class="description"><?php printf( esc_html__( 'Valid until %s (LinkedIn tokens last 60 days - reconnect when expired)', 'linkauthority-publisher' ), esc_html( wp_date( get_option( 'date_format' ), (int) $l['expires'] ) ) ); ?></span><?php endif; ?>
			</div>
			<p class="lapub-platform__actions">
				<button type="button" class="button button-primary lapub-connect-cloud" data-provider="linkedin"><?php echo $a ? esc_html__( 'Reconnect / change author', 'linkauthority-publisher' ) : esc_html__( 'Connect LinkedIn', 'linkauthority-publisher' ); ?></button>
				<?php if ( $l ) : ?><button type="button" class="button lapub-disconnect" data-provider="linkedin"><?php esc_html_e( 'Disconnect', 'linkauthority-publisher' ); ?></button><?php endif; ?>
			</p>
			<details class="lapub-details lapub-details--own"><summary><?php esc_html_e( 'Advanced: use my own LinkedIn app instead', 'linkauthority-publisher' ); ?></summary>
				<table class="form-table lapub-compact" role="presentation">
					<tr><th><label for="lapub-li-id"><?php esc_html_e( 'Client ID', 'linkauthority-publisher' ); ?></label></th><td><input type="text" id="lapub-li-id" name="lapub[linkedin_client_id]" class="regular-text" value="<?php echo esc_attr( $o['linkedin_client_id'] ); ?>" /></td></tr>
					<tr><th><label for="lapub-li-secret"><?php esc_html_e( 'Client Secret', 'linkauthority-publisher' ); ?></label></th><td><input type="password" id="lapub-li-secret" name="lapub[linkedin_client_secret]" class="regular-text" autocomplete="new-password" value="<?php echo esc_attr( $o['linkedin_client_secret'] ); ?>" /></td></tr>
					<tr><th><?php esc_html_e( 'Company Pages', 'linkauthority-publisher' ); ?></th><td><label><input type="checkbox" name="lapub[linkedin_org_scopes]" value="1" <?php checked( $o['linkedin_org_scopes'] ); ?> /> <?php esc_html_e( 'Also request Company Page permissions (needs the Community Management API product approved)', 'linkauthority-publisher' ); ?></label></td></tr>
					<tr><th><label for="lapub-li-ver"><?php esc_html_e( 'API version', 'linkauthority-publisher' ); ?></label></th><td><input type="text" id="lapub-li-ver" name="lapub[linkedin_api_version]" class="small-text" value="<?php echo esc_attr( $o['linkedin_api_version'] ); ?>" /> <span class="description"><?php esc_html_e( 'YYYYMM "LinkedIn-Version" header; enter a newer month if posts fail with a version error.', 'linkauthority-publisher' ); ?></span></td></tr>
				</table>
				<ol class="lapub-steps">
					<li><?php printf( wp_kses_post( __( 'Go to <a href="%s" target="_blank" rel="noopener">linkedin.com/developers/apps</a> → Create app (a LinkedIn Page must own the app).', 'linkauthority-publisher' ) ), 'https://www.linkedin.com/developers/apps' ); ?></li>
					<li><?php esc_html_e( 'Products: add "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect" (both instant).', 'linkauthority-publisher' ); ?></li>
					<li><?php esc_html_e( 'Auth tab: paste the redirect URL shown above under "Authorized redirect URLs", copy Client ID and Client Secret here.', 'linkauthority-publisher' ); ?></li>
				</ol>
				<p><button type="button" class="button lapub-connect" data-provider="linkedin"><?php esc_html_e( 'Connect with my own app', 'linkauthority-publisher' ); ?></button></p>
			</details>
		</div>
		<?php
	}

	private static function via_badge( $acct ) {
		if ( ! empty( $acct['via'] ) && 'cloud' === $acct['via'] ) {
			echo '<span class="lapub-badge lapub-badge--cloud">' . esc_html__( 'via LinkAuthority', 'linkauthority-publisher' ) . '</span>';
		} elseif ( ! empty( $acct ) ) {
			echo '<span class="lapub-badge">' . esc_html__( 'own app', 'linkauthority-publisher' ) . '</span>';
		}
	}

	/* ------------------------------------------------------------------ */
	/* Save                                                                */
	/* ------------------------------------------------------------------ */

	public static function sanitize( array $in, array $old ) {
		$new = array();
		$txt = function ( $k ) use ( $in ) {
			return isset( $in[ $k ] ) ? sanitize_text_field( $in[ $k ] ) : '';
		};
		$new['auto_share']   = empty( $in['auto_share'] ) ? 0 : 1;
		$new['make_enabled'] = empty( $in['make_enabled'] ) ? 0 : 1;
		foreach ( array_keys( LAPUB_Social_Accounts::platforms() ) as $p ) {
			$new[ 'share_' . $p ] = empty( $in[ 'share_' . $p ] ) ? 0 : 1;
		}
		$new['make_webhook_url'] = esc_url_raw( $txt( 'make_webhook_url' ) );
		$new['cloud_license']    = $txt( 'cloud_license' );
		$cloud                   = esc_url_raw( $txt( 'cloud_url' ) );
		$new['cloud_url']        = $cloud ? untrailingslashit( $cloud ) : $old['cloud_url'];
		foreach ( array( 'meta_app_id', 'meta_app_secret', 'meta_config_id', 'pinterest_app_id', 'pinterest_app_secret', 'linkedin_client_id', 'linkedin_client_secret' ) as $k ) {
			$new[ $k ] = $txt( $k );
		}
		$new['linkedin_org_scopes']  = empty( $in['linkedin_org_scopes'] ) ? 0 : 1;
		$ver                         = preg_replace( '/[^0-9]/', '', $txt( 'linkedin_api_version' ) );
		$new['linkedin_api_version'] = strlen( $ver ) === 6 ? $ver : $old['linkedin_api_version'];
		return $new;
	}

	/* ------------------------------------------------------------------ */
	/* "Social Posts" page                                                 */
	/* ------------------------------------------------------------------ */

	public static function render_posts_page() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}
		$paged = isset( $_GET['paged'] ) ? max( 1, (int) $_GET['paged'] ) : 1; // phpcs:ignore
		$q     = new WP_Query(
			array(
				'post_type'      => 'post',
				'post_status'    => array( 'publish', 'draft', 'pending', 'future' ),
				'posts_per_page' => 25,
				'paged'          => $paged,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'meta_query'     => array( // phpcs:ignore
					'relation' => 'OR',
					array( 'key' => '_lapub_generated', 'compare' => 'EXISTS' ),
					array( 'key' => LAPUB_Distributor::RESULTS, 'compare' => 'EXISTS' ),
				),
			)
		);
		$platforms = LAPUB_Social_Accounts::platforms();
		$fmt       = get_option( 'date_format' );
		?>
		<div class="wrap lapub-wrap">
			<div class="lapub-header">
				<div>
					<h1><span class="dashicons dashicons-share"></span> <?php esc_html_e( 'Social Posts', 'linkauthority-publisher' ); ?></h1>
					<p class="lapub-tagline"><?php esc_html_e( 'Every generated article and where it has been shared. Click a link to open the social post; use the post edit screen to share or retry.', 'linkauthority-publisher' ); ?></p>
				</div>
				<div class="lapub-header__actions">
					<a class="button button-hero" href="<?php echo esc_url( admin_url( 'admin.php?page=linkauthority-publisher&tab=social' ) ); ?>"><?php esc_html_e( 'Sharing settings', 'linkauthority-publisher' ); ?></a>
				</div>
			</div>

			<?php
			$connected = 0;
			foreach ( array_keys( $platforms ) as $p ) {
				if ( LAPUB_Social_Accounts::is_connected( $p ) ) {
					$connected++;
				}
			}
			if ( ! $connected && ! LAPUB_Options::get( 'make_enabled' ) ) :
				?>
				<div class="notice notice-info inline"><p><?php esc_html_e( 'No social accounts are connected and the Make.com webhook is off - nothing will be shared yet. Open Sharing settings to set it up.', 'linkauthority-publisher' ); ?></p></div>
			<?php endif; ?>

			<table class="widefat striped lapub-social-table">
				<thead>
					<tr>
						<th style="width:110px"><?php esc_html_e( 'Date', 'linkauthority-publisher' ); ?></th>
						<th><?php esc_html_e( 'Post', 'linkauthority-publisher' ); ?></th>
						<?php foreach ( $platforms as $label ) : ?><th style="width:110px"><?php echo esc_html( $label ); ?></th><?php endforeach; ?>
						<th style="width:90px">Make.com</th>
					</tr>
				</thead>
				<tbody>
				<?php if ( ! $q->have_posts() ) : ?>
					<tr><td colspan="7"><?php esc_html_e( 'No generated posts yet.', 'linkauthority-publisher' ); ?></td></tr>
				<?php endif; ?>
				<?php
				while ( $q->have_posts() ) :
					$q->the_post();
					$id      = get_the_ID();
					$results = get_post_meta( $id, LAPUB_Distributor::RESULTS, true );
					$results = is_array( $results ) ? $results : array();
					$status  = get_post_status( $id );
					?>
					<tr>
						<td><?php echo esc_html( get_the_date( $fmt ) ); ?><?php if ( 'publish' !== $status ) : ?><br /><span class="lapub-level"><?php echo esc_html( $status ); ?></span><?php endif; ?></td>
						<td>
							<strong><a href="<?php echo esc_url( get_edit_post_link( $id ) ); ?>"><?php echo esc_html( get_the_title() ); ?></a></strong><br />
							<a href="<?php echo esc_url( get_permalink( $id ) ); ?>" target="_blank" rel="noopener" class="description"><?php echo esc_html( get_permalink( $id ) ); ?></a>
							<?php $wc = (int) get_post_meta( $id, '_lapub_word_count', true ); ?>
							<?php if ( $wc ) : ?><span class="description"> &middot; <?php echo (int) $wc; ?> <?php esc_html_e( 'words', 'linkauthority-publisher' ); ?></span><?php endif; ?>
						</td>
						<?php foreach ( array_keys( $platforms ) as $p ) : ?>
							<td><?php self::result_cell( isset( $results[ $p ] ) ? $results[ $p ] : null ); ?></td>
						<?php endforeach; ?>
						<td><?php self::result_cell( isset( $results['make'] ) ? $results['make'] : null, true ); ?></td>
					</tr>
				<?php endwhile; wp_reset_postdata(); ?>
				</tbody>
			</table>

			<?php
			$pages = (int) $q->max_num_pages;
			if ( $pages > 1 ) {
				echo '<div class="tablenav"><div class="tablenav-pages">' . wp_kses_post( paginate_links( array(
					'base'    => add_query_arg( 'paged', '%#%' ),
					'format'  => '',
					'current' => $paged,
					'total'   => $pages,
				) ) ) . '</div></div>';
			}
			?>
		</div>
		<?php
	}

	private static function result_cell( $r, $no_link = false ) {
		if ( ! $r ) {
			echo '<span class="lapub-dash">&mdash;</span>';
			return;
		}
		if ( 'success' === $r['status'] ) {
			if ( $no_link || empty( $r['url'] ) ) {
				echo '<span class="lapub-level lapub-level--success">' . esc_html__( 'sent', 'linkauthority-publisher' ) . '</span>';
			} else {
				echo '<a class="lapub-level lapub-level--success" href="' . esc_url( $r['url'] ) . '" target="_blank" rel="noopener">' . esc_html__( 'view', 'linkauthority-publisher' ) . ' &nearr;</a>';
			}
			echo '<br /><span class="description">' . esc_html( wp_date( 'M j, H:i', (int) $r['time'] ) ) . '</span>';
		} else {
			echo '<span class="lapub-level lapub-level--error" title="' . esc_attr( $r['error'] ) . '">' . esc_html__( 'failed', 'linkauthority-publisher' ) . '</span><br /><span class="description lapub-err-text">' . esc_html( mb_substr( $r['error'], 0, 80 ) ) . '</span>';
		}
	}
}
