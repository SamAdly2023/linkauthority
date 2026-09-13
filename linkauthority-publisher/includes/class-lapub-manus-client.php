<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Thin client for the Manus API (v2).
 *
 * Docs: https://open.manus.ai/docs/v2/introduction
 *
 * Tasks run asynchronously: create a task, then poll task.listMessages until the
 * latest status_update reports agent_status = "stopped" (success) or "error".
 */
class LAPUB_Manus_Client {

	const BASE_URL = 'https://api.manus.ai';

	/** @var string */
	private $api_key;

	public function __construct( $api_key = null ) {
		$this->api_key = null === $api_key ? LAPUB_Options::get( 'manus_api_key' ) : $api_key;
	}

	public function has_key() {
		return ! empty( $this->api_key );
	}

	/**
	 * Create a task.
	 *
	 * @param string $prompt Prompt text.
	 * @param array  $args   Optional: structured_output_schema, agent_profile, title, locale, hide_in_task_list.
	 * @return array|WP_Error { task_id, task_title, task_url }
	 */
	public function create_task( $prompt, array $args = array() ) {
		$body = array(
			'message'           => array(
				'content' => (string) $prompt,
			),
			'agent_profile'     => ! empty( $args['agent_profile'] ) ? $args['agent_profile'] : LAPUB_Options::get( 'manus_agent_profile', 'standard' ),
			'interactive_mode'  => false,
			'hide_in_task_list' => isset( $args['hide_in_task_list'] ) ? (bool) $args['hide_in_task_list'] : false,
			'share_visibility'  => 'private',
		);

		if ( ! empty( $args['title'] ) ) {
			$body['title'] = mb_substr( (string) $args['title'], 0, 120 );
		}
		if ( ! empty( $args['structured_output_schema'] ) ) {
			$body['structured_output_schema'] = $args['structured_output_schema'];
		}
		$locale = ! empty( $args['locale'] ) ? $args['locale'] : LAPUB_Options::get( 'manus_locale' );
		if ( ! empty( $locale ) ) {
			$body['locale'] = $locale;
		}

		$response = $this->request( 'POST', '/v2/task.create', $body );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		if ( empty( $response['task_id'] ) ) {
			return new WP_Error( 'lapub_manus_no_task', __( 'Manus did not return a task id.', 'linkauthority-publisher' ), $response );
		}
		return array(
			'task_id'    => $response['task_id'],
			'task_title' => isset( $response['task_title'] ) ? $response['task_title'] : '',
			'task_url'   => isset( $response['task_url'] ) ? $response['task_url'] : '',
		);
	}

	/**
	 * Retrieve task metadata (status, credits, etc.).
	 */
	public function get_task( $task_id ) {
		$response = $this->request( 'GET', '/v2/task.detail', array( 'task_id' => $task_id ) );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		return isset( $response['task'] ) ? $response['task'] : $response;
	}

	/**
	 * List event messages for a task.
	 */
	public function list_messages( $task_id, $limit = 100, $order = 'desc', $cursor = '' ) {
		$query = array(
			'task_id' => $task_id,
			'order'   => $order,
			'limit'   => max( 1, min( 200, (int) $limit ) ),
		);
		if ( $cursor ) {
			$query['cursor'] = $cursor;
		}
		return $this->request( 'GET', '/v2/task.listMessages', $query );
	}

	/**
	 * Send a follow-up message to an existing task (multi-turn).
	 */
	public function send_message( $task_id, $content ) {
		return $this->request(
			'POST',
			'/v2/task.sendMessage',
			array(
				'task_id' => $task_id,
				'message' => array( 'content' => (string) $content ),
			)
		);
	}

	/**
	 * Poll a task and normalise everything we care about into one array.
	 *
	 * @return array|WP_Error {
	 *   status       : running|stopped|waiting|error|unknown
	 *   structured   : array|null   (structured_output_result.value)
	 *   content      : string       (latest assistant text)
	 *   attachments  : array        (all assistant attachments, newest first)
	 *   error        : string
	 *   waiting      : string       (description when agent is waiting)
	 *   status_ts    : int          (ms timestamp of the newest status_update event)
	 * }
	 */
	public function poll( $task_id ) {
		$result = array(
			'status'      => 'unknown',
			'structured'  => null,
			'content'     => '',
			'attachments' => array(),
			'error'       => '',
			'waiting'     => '',
			'status_ts'   => 0,
		);

		$detail = $this->get_task( $task_id );
		if ( ! is_wp_error( $detail ) && ! empty( $detail['status'] ) ) {
			$result['status'] = $detail['status'];
		}

		$messages = $this->list_messages( $task_id, 200, 'desc' );
		if ( is_wp_error( $messages ) ) {
			return $messages;
		}

		$list = isset( $messages['messages'] ) && is_array( $messages['messages'] ) ? $messages['messages'] : array();

		$status_from_msgs = null;
		foreach ( $list as $msg ) {
			$type = isset( $msg['type'] ) ? $msg['type'] : '';

			if ( 'status_update' === $type && null === $status_from_msgs && ! empty( $msg['status_update']['agent_status'] ) ) {
				$status_from_msgs    = $msg['status_update']['agent_status'];
				$result['status_ts'] = isset( $msg['timestamp'] ) ? (int) $msg['timestamp'] : 0;
				if ( $result['status_ts'] && $result['status_ts'] < 100000000000 ) {
					$result['status_ts'] *= 1000; // seconds -> milliseconds
				}
				if ( 'waiting' === $status_from_msgs ) {
					$result['waiting'] = isset( $msg['status_update']['status_detail']['waiting_description'] ) ? $msg['status_update']['status_detail']['waiting_description'] : ( isset( $msg['status_update']['brief'] ) ? $msg['status_update']['brief'] : '' );
				}
			}

			if ( 'structured_output_result' === $type && null === $result['structured'] ) {
				$sor = isset( $msg['structured_output_result'] ) ? $msg['structured_output_result'] : array();
				if ( ! empty( $sor['success'] ) && isset( $sor['value'] ) ) {
					$result['structured'] = $sor['value'];
				} elseif ( isset( $sor['value'] ) && is_array( $sor['value'] ) && ! empty( $sor['value'] ) ) {
					$result['structured'] = $sor['value'];
				}
			}

			if ( 'assistant_message' === $type ) {
				$am = isset( $msg['assistant_message'] ) ? $msg['assistant_message'] : array();
				if ( '' === $result['content'] && ! empty( $am['content'] ) ) {
					$result['content'] = (string) $am['content'];
				}
				if ( ! empty( $am['attachments'] ) && is_array( $am['attachments'] ) ) {
					foreach ( $am['attachments'] as $att ) {
						if ( ! empty( $att['url'] ) ) {
							$result['attachments'][] = $att;
						}
					}
				}
			}

			if ( 'error_message' === $type && '' === $result['error'] ) {
				$result['error'] = isset( $msg['error_message']['content'] ) ? $msg['error_message']['content'] : wp_json_encode( $msg );
			}
		}

		// Prefer the most recent status_update event; fall back to task.detail.
		if ( $status_from_msgs ) {
			$result['status'] = $status_from_msgs;
		}

		// Some responses expose structured output at the top level too.
		if ( null === $result['structured'] && ! empty( $messages['structured_output_result'] ) ) {
			$sor = $messages['structured_output_result'];
			$result['structured'] = isset( $sor['value'] ) ? $sor['value'] : $sor;
		}

		return $result;
	}

	/**
	 * Cheap key validation: an invalid key yields an auth error; a valid key yields not_found for a bogus id.
	 *
	 * @return true|WP_Error
	 */
	public function test_key() {
		if ( ! $this->has_key() ) {
			return new WP_Error( 'lapub_no_key', __( 'No Manus API key entered.', 'linkauthority-publisher' ) );
		}
		$response = $this->request( 'GET', '/v2/task.detail', array( 'task_id' => 'lapub-key-check-000000' ) );
		if ( is_wp_error( $response ) ) {
			$code = $response->get_error_code();
			if ( in_array( $code, array( 'not_found', 'invalid_argument', 'http_404', 'http_400' ), true ) ) {
				return true; // Authenticated, task simply does not exist.
			}
			return $response;
		}
		return true;
	}

	/**
	 * Low-level request helper.
	 *
	 * @return array|WP_Error Decoded JSON body.
	 */
	private function request( $method, $path, array $data = array() ) {
		if ( ! $this->has_key() ) {
			return new WP_Error( 'lapub_no_key', __( 'Manus API key is missing. Add it in LinkAuthority Publisher > Settings.', 'linkauthority-publisher' ) );
		}

		$url  = self::BASE_URL . $path;
		$args = array(
			'method'  => $method,
			'timeout' => 60,
			'headers' => array(
				'x-manus-api-key' => $this->api_key,
				'Accept'          => 'application/json',
			),
		);

		if ( 'GET' === $method ) {
			if ( $data ) {
				$url = add_query_arg( $data, $url );
			}
		} else {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body']                    = wp_json_encode( $data );
		}

		$response = wp_remote_request( $url, $args );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $body ) ) {
			return new WP_Error( 'http_' . $code, sprintf( __( 'Manus API returned a non-JSON response (HTTP %d).', 'linkauthority-publisher' ), $code ) );
		}

		if ( $code >= 400 || ( isset( $body['ok'] ) && false === $body['ok'] ) ) {
			$err_code = isset( $body['error']['code'] ) ? $body['error']['code'] : 'http_' . $code;
			$err_msg  = isset( $body['error']['message'] ) ? $body['error']['message'] : sprintf( __( 'Manus API error (HTTP %d).', 'linkauthority-publisher' ), $code );
			return new WP_Error( $err_code, $err_msg, $body );
		}

		return $body;
	}
}
