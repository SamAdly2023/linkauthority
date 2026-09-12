<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Cron scheduling + the asynchronous job state machine.
 *
 * Flow:
 *   mab_generate_post (recurring)  -> start_job()        creates the Manus article task
 *   mab_poll_job      (every 60s)  -> poll_job()         waits for the article, then creates the image task,
 *                                                        waits for the image, then builds the WordPress post.
 */
class MAB_Scheduler {

	const HOOK_GENERATE = 'mab_generate_post';
	const HOOK_POLL     = 'mab_poll_job';
	const JOB_OPTION    = 'mab_job';
	const LAST_RUN      = 'mab_last_run';

	const CONTENT_TIMEOUT = 75 * MINUTE_IN_SECONDS;
	const IMAGE_TIMEOUT   = 30 * MINUTE_IN_SECONDS;

	/** @var MAB_Scheduler */
	private static $instance;

	public static function instance() {
		if ( ! self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( self::HOOK_GENERATE, array( $this, 'start_job' ) );
		add_action( self::HOOK_POLL, array( $this, 'poll_job' ) );
		add_action( 'admin_init', array( $this, 'ensure_poll_scheduled' ) );
	}

	/* ------------------------------------------------------------------ */
	/* Activation / scheduling                                             */
	/* ------------------------------------------------------------------ */

	public static function activate() {
		self::reschedule();
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( self::HOOK_GENERATE );
		wp_clear_scheduled_hook( self::HOOK_POLL );
		wp_unschedule_hook( 'mab_distribute_post' );
	}

	/**
	 * (Re)create the recurring generation event based on the saved settings.
	 */
	public static function reschedule() {
		wp_clear_scheduled_hook( self::HOOK_GENERATE );

		$o = MAB_Options::all();
		if ( empty( $o['enabled'] ) ) {
			return;
		}

		$frequency = array_key_exists( $o['frequency'], MAB_Options::frequencies() ) ? $o['frequency'] : 'daily';
		$first     = self::next_run_timestamp( (int) $o['run_hour'] );

		wp_schedule_event( $first, $frequency, self::HOOK_GENERATE );
		MAB_Logger::info(
			sprintf(
				'Schedule updated: %s, next run %s.',
				MAB_Options::frequencies()[ $frequency ],
				wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $first )
			)
		);
	}

	/**
	 * Next occurrence of HH:00 in the site's timezone (UTC timestamp).
	 */
	public static function next_run_timestamp( $hour ) {
		$hour = max( 0, min( 23, (int) $hour ) );
		$tz   = wp_timezone();
		$now  = new DateTime( 'now', $tz );
		$run  = new DateTime( 'today', $tz );
		$run->setTime( $hour, 0, 0 );
		if ( $run <= $now ) {
			$run->modify( '+1 day' );
		}
		return $run->getTimestamp();
	}

	public static function next_scheduled() {
		return wp_next_scheduled( self::HOOK_GENERATE );
	}

	/**
	 * Make sure a running job always has a poll event queued (cron events can get lost).
	 */
	public function ensure_poll_scheduled() {
		$job = self::get_job();
		if ( $job && ! wp_next_scheduled( self::HOOK_POLL ) ) {
			$this->schedule_poll( 30 );
		}
	}

	private function schedule_poll( $delay = 60 ) {
		if ( ! wp_next_scheduled( self::HOOK_POLL ) ) {
			wp_schedule_single_event( time() + $delay, self::HOOK_POLL );
		}
	}

	/* ------------------------------------------------------------------ */
	/* Job storage                                                         */
	/* ------------------------------------------------------------------ */

	public static function get_job() {
		$job = get_option( self::JOB_OPTION, null );
		return is_array( $job ) && ! empty( $job['stage'] ) ? $job : null;
	}

	private static function save_job( array $job ) {
		$job['updated'] = time();
		update_option( self::JOB_OPTION, $job, false );
	}

	public static function clear_job() {
		delete_option( self::JOB_OPTION );
		wp_clear_scheduled_hook( self::HOOK_POLL );
	}

	private static function set_last_run( $status, $message, $post_id = 0 ) {
		update_option(
			self::LAST_RUN,
			array(
				'time'    => time(),
				'status'  => $status,
				'message' => $message,
				'post_id' => (int) $post_id,
			),
			false
		);
	}

	public static function last_run() {
		$r = get_option( self::LAST_RUN, null );
		return is_array( $r ) ? $r : null;
	}

	/* ------------------------------------------------------------------ */
	/* Stage 1: start                                                      */
	/* ------------------------------------------------------------------ */

	/**
	 * Kick off a new generation job.
	 *
	 * @param string $trigger 'schedule' or 'manual'.
	 * @param string $topic   Optional topic requested by the user (manual runs only).
	 * @return true|WP_Error
	 */
	public function start_job( $trigger = 'schedule', $topic = '' ) {
		if ( ! is_string( $trigger ) ) {
			$trigger = 'schedule';
		}
		$topic = is_string( $topic ) ? trim( $topic ) : '';

		$existing = self::get_job();
		if ( $existing ) {
			$age = time() - (int) $existing['started'];
			if ( $age < self::CONTENT_TIMEOUT + self::IMAGE_TIMEOUT ) {
				$msg = __( 'A generation job is already in progress. Wait for it to finish (or cancel it) before starting another.', 'manus-auto-blogger' );
				MAB_Logger::warning( $msg );
				return new WP_Error( 'mab_job_running', $msg );
			}
			MAB_Logger::warning( 'A stale job was found and discarded.' );
			self::clear_job();
		}

		$manus = new MAB_Manus_Client();
		if ( ! $manus->has_key() ) {
			$msg = __( 'Cannot generate: Manus API key is missing.', 'manus-auto-blogger' );
			MAB_Logger::error( $msg );
			self::set_last_run( 'error', $msg );
			return new WP_Error( 'mab_no_key', $msg );
		}

		$prompt = MAB_Prompts::content_prompt( $topic );
		$result = $manus->create_task(
			$prompt,
			array(
				'title'                    => 'Blog post for ' . ( MAB_Options::get( 'site_name' ) ? MAB_Options::get( 'site_name' ) : get_bloginfo( 'name' ) ) . ' - ' . wp_date( 'Y-m-d' ),
				'structured_output_schema' => MAB_Prompts::content_schema(),
				'hide_in_task_list'        => false,
			)
		);

		if ( is_wp_error( $result ) ) {
			$msg = 'Manus task creation failed: ' . $result->get_error_message();
			MAB_Logger::error( $msg, array( 'code' => $result->get_error_code() ) );
			self::set_last_run( 'error', $msg );
			return $result;
		}

		$job = array(
			'id'               => uniqid( 'mab_', true ),
			'trigger'          => $trigger,
			'topic'            => $topic,
			'stage'            => 'content',
			'content_task_id'  => $result['task_id'],
			'content_task_url' => $result['task_url'],
			'image_task_id'    => '',
			'image_task_url'   => '',
			'article'          => null,
			'image_url'        => '',
			'started'          => time(),
			'stage_started'    => time(),
			'polls'            => 0,
			'nudges'           => 0,
			'after_ts'         => 0,
		);
		self::save_job( $job );
		$this->schedule_poll( 90 );

		MAB_Logger::info( $topic ? 'Manus article task created for topic "' . $topic . '". Waiting for the agent to research and write.' : 'Manus article task created. Waiting for the agent to finish researching and writing.', array( 'task_id' => $result['task_id'], 'task_url' => $result['task_url'] ) );
		return true;
	}

	/* ------------------------------------------------------------------ */
	/* Stage 2/3: poll                                                     */
	/* ------------------------------------------------------------------ */

	/**
	 * Poll the active Manus task and advance the job.
	 *
	 * @return array|null Current job (or null when finished).
	 */
	public function poll_job() {
		$job = self::get_job();
		if ( ! $job ) {
			return null;
		}

		// Simple lock so overlapping cron runs do not double-process.
		if ( get_transient( 'mab_poll_lock' ) ) {
			$this->schedule_poll( 60 );
			return $job;
		}
		set_transient( 'mab_poll_lock', 1, 4 * MINUTE_IN_SECONDS );

		try {
			$job['polls'] = (int) $job['polls'] + 1;
			$manus        = new MAB_Manus_Client();

			if ( 'content' === $job['stage'] ) {
				$this->poll_content_stage( $job, $manus );
			} elseif ( 'image' === $job['stage'] ) {
				$this->poll_image_stage( $job, $manus );
			} elseif ( 'finalize' === $job['stage'] ) {
				$this->finalize( $job );
			}
		} finally {
			delete_transient( 'mab_poll_lock' );
		}

		return self::get_job();
	}

	private function poll_content_stage( array $job, MAB_Manus_Client $manus ) {
		$res = $manus->poll( $job['content_task_id'] );

		if ( is_wp_error( $res ) ) {
			MAB_Logger::warning( 'Polling article task failed (will retry): ' . $res->get_error_message() );
			self::save_job( $job );
			$this->schedule_poll( 90 );
			return;
		}

		// After a follow-up message the old "stopped" status is still the newest event for a moment.
		if ( ! empty( $job['after_ts'] ) && $res['status_ts'] && $res['status_ts'] < (int) $job['after_ts'] ) {
			$res['status'] = 'running';
		}

		switch ( $res['status'] ) {
			case 'stopped':
				$article = $res['structured'];
				if ( ! is_array( $article ) || empty( $article['title'] ) ) {
					$article = $this->extract_json( $res['content'] );
				}
				if ( ! is_array( $article ) || empty( $article['title'] ) || empty( $article['sections'] ) ) {
					$this->fail( $job, 'Manus finished but did not return a usable article (no structured output). Check the task in Manus: ' . $job['content_task_url'] );
					return;
				}
				$job['article']       = $article;
				$builder              = new MAB_Post_Builder( $article );
				$words                = $builder->word_count();
				$min                  = (int) MAB_Options::get( 'min_words' );
				MAB_Logger::success( sprintf( 'Article received: "%s" (%d words, %d sections).', $article['title'], $words, count( $article['sections'] ) ), array( 'task_id' => $job['content_task_id'] ) );

				if ( $words < $min * 0.8 && (int) $job['nudges'] < 1 ) {
					// One attempt to lengthen a short article.
					$job['nudges'] = (int) $job['nudges'] + 1;
					$manus->send_message(
						$job['content_task_id'],
						sprintf( 'The article is only about %d words. Expand every section with more specific, useful detail (examples, steps, data) so the total is between %d and %d words, keep the same structure, and return the complete result again as structured output.', $words, $min, (int) MAB_Options::get( 'max_words' ) )
					);
					$job['stage_started'] = time();
					$job['after_ts']      = (int) ( microtime( true ) * 1000 );
					self::save_job( $job );
					MAB_Logger::warning( sprintf( 'Article shorter than the %d-word minimum. Asked Manus to expand it.', $min ) );
					$this->schedule_poll( 90 );
					return;
				}
				if ( $words < $min ) {
					MAB_Logger::warning( sprintf( 'Article is %d words (minimum %d). Proceeding anyway.', $words, $min ) );
				}

				$this->begin_image_stage( $job, $manus );
				return;

			case 'error':
				$this->fail( $job, 'Manus article task failed: ' . ( $res['error'] ? $res['error'] : 'unknown error' ) );
				return;

			case 'waiting':
				$this->nudge( $job, $manus, $job['content_task_id'], $res['waiting'] );
				return;

			default: // running / unknown
				if ( time() - (int) $job['stage_started'] > self::CONTENT_TIMEOUT ) {
					if ( ! empty( $job['article'] ) ) {
						// The expansion follow-up never finished; use the article we already have.
						MAB_Logger::warning( 'Manus did not finish expanding the article in time - using the original version.' );
						$this->begin_image_stage( $job, $manus );
						return;
					}
					$this->fail( $job, 'Timed out waiting for Manus to write the article.' );
					return;
				}
				self::save_job( $job );
				$this->schedule_poll( 60 );
		}
	}

	private function begin_image_stage( array $job, MAB_Manus_Client $manus ) {
		if ( empty( MAB_Options::get( 'generate_featured' ) ) ) {
			$job['stage'] = 'finalize';
			self::save_job( $job );
			$this->finalize( $job );
			return;
		}

		$result = $manus->create_task(
			MAB_Prompts::image_prompt( $job['article'] ),
			array(
				'title'             => 'Featured image: ' . mb_substr( $job['article']['title'], 0, 80 ),
				'hide_in_task_list' => false,
			)
		);

		if ( is_wp_error( $result ) ) {
			MAB_Logger::warning( 'Could not create the featured-image task, continuing without it: ' . $result->get_error_message() );
			$job['stage'] = 'finalize';
			self::save_job( $job );
			$this->finalize( $job );
			return;
		}

		$job['stage']          = 'image';
		$job['image_task_id']  = $result['task_id'];
		$job['image_task_url'] = $result['task_url'];
		$job['stage_started']  = time();
		$job['nudges']         = 0;
		$job['after_ts']       = 0;
		self::save_job( $job );
		MAB_Logger::info( 'Featured-image task created. Waiting for Manus to generate the image.', array( 'task_id' => $result['task_id'] ) );
		$this->schedule_poll( 60 );
	}

	private function poll_image_stage( array $job, MAB_Manus_Client $manus ) {
		$res = $manus->poll( $job['image_task_id'] );

		if ( is_wp_error( $res ) ) {
			MAB_Logger::warning( 'Polling image task failed (will retry): ' . $res->get_error_message() );
			self::save_job( $job );
			$this->schedule_poll( 90 );
			return;
		}

		if ( ! empty( $job['after_ts'] ) && $res['status_ts'] && $res['status_ts'] < (int) $job['after_ts'] ) {
			$res['status'] = 'running';
		}

		switch ( $res['status'] ) {
			case 'stopped':
				$url = $this->pick_image_attachment( $res['attachments'] );
				if ( $url ) {
					$job['image_url'] = $url;
					MAB_Logger::success( 'Featured image generated by Manus.' );
				} else {
					MAB_Logger::warning( 'Manus finished the image task but no image attachment was found. A Pexels photo will be used instead.' );
				}
				$job['stage'] = 'finalize';
				self::save_job( $job );
				$this->finalize( $job );
				return;

			case 'error':
				MAB_Logger::warning( 'Manus image task failed: ' . $res['error'] . ' - falling back to Pexels.' );
				$job['stage'] = 'finalize';
				self::save_job( $job );
				$this->finalize( $job );
				return;

			case 'waiting':
				$this->nudge( $job, $manus, $job['image_task_id'], $res['waiting'] );
				return;

			default:
				if ( time() - (int) $job['stage_started'] > self::IMAGE_TIMEOUT ) {
					MAB_Logger::warning( 'Timed out waiting for the featured image - falling back to Pexels.' );
					$job['stage'] = 'finalize';
					self::save_job( $job );
					$this->finalize( $job );
					return;
				}
				self::save_job( $job );
				$this->schedule_poll( 60 );
		}
	}

	/* ------------------------------------------------------------------ */
	/* Stage 4: finalize                                                   */
	/* ------------------------------------------------------------------ */

	private function finalize( array $job ) {
		if ( empty( $job['article'] ) ) {
			$this->fail( $job, 'Internal error: no article data to publish.' );
			return;
		}

		$builder = new MAB_Post_Builder( $job['article'] );
		$post_id = $builder->create_post(
			$job['image_url'],
			array(
				'manus_task_id'       => $job['content_task_id'],
				'manus_task_url'      => $job['content_task_url'],
				'manus_image_task_id' => $job['image_task_id'],
			)
		);

		if ( is_wp_error( $post_id ) ) {
			$this->fail( $job, 'Creating the WordPress post failed: ' . $post_id->get_error_message() );
			return;
		}

		$status = get_post_status( $post_id );
		$msg    = sprintf( 'Post #%d "%s" created (%s).', $post_id, get_the_title( $post_id ), $status );
		MAB_Logger::success( $msg, array( 'post_id' => $post_id, 'url' => get_permalink( $post_id ) ) );
		self::set_last_run( 'success', $msg, $post_id );
		self::clear_job();

		do_action( 'mab_post_generated', $post_id, $job );
	}

	/* ------------------------------------------------------------------ */
	/* Helpers                                                             */
	/* ------------------------------------------------------------------ */

	private function nudge( array $job, MAB_Manus_Client $manus, $task_id, $waiting_desc ) {
		if ( (int) $job['nudges'] >= 3 ) {
			$this->fail( $job, 'Manus keeps waiting for input: ' . $waiting_desc );
			return;
		}
		$job['nudges']   = (int) $job['nudges'] + 1;
		$job['after_ts'] = (int) ( microtime( true ) * 1000 );
		$manus->send_message( $task_id, 'Do not ask questions or wait for confirmation. Proceed autonomously using your best judgement and complete the task fully.' );
		MAB_Logger::info( 'Manus asked for input ("' . $waiting_desc . '"). Told it to continue autonomously.' );
		self::save_job( $job );
		$this->schedule_poll( 60 );
	}

	private function fail( array $job, $message ) {
		MAB_Logger::error( $message, array( 'job' => $job['id'] ) );
		self::set_last_run( 'error', $message );
		self::clear_job();
	}

	/**
	 * Pull a JSON object out of free-form assistant text (fenced or bare).
	 */
	private function extract_json( $text ) {
		if ( ! $text ) {
			return null;
		}
		if ( preg_match( '/```(?:json)?\s*(\{.*\})\s*```/is', $text, $m ) ) {
			$decoded = json_decode( $m[1], true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}
		$start = strpos( $text, '{' );
		$end   = strrpos( $text, '}' );
		if ( false !== $start && false !== $end && $end > $start ) {
			$decoded = json_decode( substr( $text, $start, $end - $start + 1 ), true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}
		return null;
	}

	private function pick_image_attachment( array $attachments ) {
		foreach ( $attachments as $att ) {
			$type  = isset( $att['type'] ) ? $att['type'] : '';
			$ctype = isset( $att['content_type'] ) ? $att['content_type'] : '';
			$name  = isset( $att['filename'] ) ? $att['filename'] : '';
			if ( 'image' === $type || 0 === strpos( $ctype, 'image/' ) || preg_match( '/\.(jpe?g|png|webp)$/i', $name ) ) {
				return $att['url'];
			}
		}
		return '';
	}
}
