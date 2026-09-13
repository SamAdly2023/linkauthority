/* global LAPUB, jQuery */
( function ( $ ) {
	'use strict';

	var pollTimer = null;

	function ajax( action, data ) {
		return $.post( LAPUB.ajax, $.extend( { action: 'lapub_' + action, nonce: LAPUB.nonce }, data || {} ) );
	}

	function applyStatus( status ) {
		if ( ! status ) {
			return;
		}
		$( '#lapub-status' ).html( status.html );
		$( '#lapub-log' ).html( status.log );
		if ( status.running ) {
			startPolling();
		} else {
			stopPolling();
		}
	}

	function startPolling() {
		if ( pollTimer ) {
			return;
		}
		pollTimer = setInterval( function () {
			ajax( 'poll_now' ).done( function ( res ) {
				if ( res && res.success ) {
					applyStatus( res.data.status );
				}
			} );
		}, 45000 );
	}

	function stopPolling() {
		if ( pollTimer ) {
			clearInterval( pollTimer );
			pollTimer = null;
		}
	}

	function notice( type, text ) {
		var $n = $( '<div class="notice is-dismissible lapub-notice notice-' + type + '"><p></p></div>' );
		$n.find( 'p' ).text( text );
		$( '.lapub-header' ).after( $n );
		setTimeout( function () {
			$n.fadeOut( 300, function () {
				$( this ).remove();
			} );
		}, 8000 );
	}

	$( function () {
		/* Tabs */
		$( '.lapub-tabs .nav-tab' ).on( 'click', function ( e ) {
			e.preventDefault();
			var tab = $( this ).data( 'tab' );
			$( '.lapub-tabs .nav-tab' ).removeClass( 'nav-tab-active' );
			$( this ).addClass( 'nav-tab-active' );
			$( '.lapub-tab' ).removeClass( 'is-active' );
			$( '.lapub-tab[data-tab="' + tab + '"]' ).addClass( 'is-active' );
			$( '#lapub-current-tab' ).val( tab );
			if ( window.history && window.history.replaceState ) {
				var url = new URL( window.location.href );
				url.searchParams.set( 'tab', tab );
				url.searchParams.delete( 'saved' );
				window.history.replaceState( null, '', url.toString() );
			}
		} );

		/* Colour pickers */
		if ( $.fn.wpColorPicker ) {
			$( '.lapub-color' ).wpColorPicker();
		}

		/* Show / hide key */
		$( document ).on( 'click', '.lapub-toggle-key', function () {
			var $input = $( '#' + $( this ).data( 'target' ) );
			$input.attr( 'type', 'password' === $input.attr( 'type' ) ? 'text' : 'password' );
		} );

		/* Test keys */
		$( document ).on( 'click', '.lapub-test-key', function () {
			var $btn    = $( this );
			var service = $btn.data( 'service' );
			var key     = $( '#' + $btn.data( 'input' ) ).val();
			var $out    = $btn.siblings( '.lapub-test-result' );
			$btn.prop( 'disabled', true );
			$out.removeClass( 'is-ok is-err' ).text( LAPUB.i18n.testing );
			ajax( 'test_' + service, { key: key } )
				.done( function ( res ) {
					if ( res.success ) {
						$out.addClass( 'is-ok' ).text( res.data.message );
					} else {
						$out.addClass( 'is-err' ).text( res.data && res.data.message ? res.data.message : 'Error' );
					}
				} )
				.fail( function () {
					$out.addClass( 'is-err' ).text( 'Request failed' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		/* Generate now */
		$( document ).on( 'click', '#lapub-generate-now', function () {
			var $btn = $( this );
			$btn.prop( 'disabled', true ).addClass( 'is-busy' );
			ajax( 'generate_now', { topic: $( '#lapub-topic' ).val() } )
				.done( function ( res ) {
					if ( res.success ) {
						$( '#lapub-topic' ).val( '' );
						notice( 'success', LAPUB.i18n.generated );
					} else {
						notice( 'error', res.data && res.data.message ? res.data.message : 'Error' );
					}
					applyStatus( res.data.status );
				} )
				.fail( function () {
					notice( 'error', 'Request failed' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false ).removeClass( 'is-busy' );
				} );
		} );

		/* Check now */
		$( document ).on( 'click', '#lapub-poll-now', function () {
			var $btn = $( this ).prop( 'disabled', true ).text( LAPUB.i18n.working );
			ajax( 'poll_now' ).done( function ( res ) {
				if ( res.success ) {
					applyStatus( res.data.status );
				}
			} ).always( function () {
				$btn.prop( 'disabled', false );
			} );
		} );

		/* Cancel job */
		$( document ).on( 'click', '#lapub-cancel-job', function () {
			if ( ! window.confirm( LAPUB.i18n.confirm ) ) {
				return;
			}
			ajax( 'cancel_job' ).done( function ( res ) {
				if ( res.success ) {
					applyStatus( res.data.status );
				}
			} );
		} );

		/* Clear log */
		$( '#lapub-clear-log' ).on( 'click', function () {
			if ( ! window.confirm( LAPUB.i18n.clearlog ) ) {
				return;
			}
			ajax( 'clear_log' ).done( function () {
				$( '#lapub-log' ).html( '<p class="description">Log cleared.</p>' );
			} );
		} );

		/* Reloads once the OAuth popup closes. The popup cannot always reach this
	   page itself: any cross-origin page it passes through that sends a
	   Cross-Origin-Opener-Policy header severs window.opener, and the connect
	   relay did exactly that. popup.closed stays readable regardless. */
	function reloadWhenClosed( popup ) {
		if ( ! popup ) {
			return;
		}
		var timer = setInterval( function () {
			if ( popup.closed ) {
				clearInterval( timer );
				window.location.reload();
			}
		}, 500 );
	}

	/* Social: connect via OAuth popup */
		$( document ).on( 'click', '.lapub-connect', function () {
			var $btn     = $( this ).prop( 'disabled', true );
			var provider = $btn.data( 'provider' );
			var popup    = window.open( 'about:blank', 'lapub_oauth', 'width=640,height=760,menubar=no,toolbar=no' );
			ajax( 'oauth_start', { provider: provider } )
				.done( function ( res ) {
					if ( res.success && popup ) {
						popup.location.href = res.data.url;
						reloadWhenClosed( popup );
					} else {
						if ( popup ) {
							popup.close();
						}
						notice( 'error', res.data && res.data.message ? res.data.message : LAPUB.i18n.popup );
					}
				} )
				.fail( function () {
					if ( popup ) {
						popup.close();
					}
					notice( 'error', 'Request failed' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		/* Social: connect through the LinkAuthority relay */
		$( document ).on( 'click', '.lapub-connect-cloud', function () {
			var $btn     = $( this ).prop( 'disabled', true );
			var provider = $btn.data( 'provider' );
			var popup    = window.open( 'about:blank', 'lapub_oauth', 'width=640,height=760,menubar=no,toolbar=no' );
			ajax( 'cloud_start', { provider: provider } )
				.done( function ( res ) {
					if ( res.success && popup ) {
						popup.location.href = res.data.url;
						reloadWhenClosed( popup );
					} else {
						if ( popup ) {
							popup.close();
						}
						notice( 'error', res.data && res.data.message ? res.data.message : LAPUB.i18n.popup );
					}
				} )
				.fail( function () {
					if ( popup ) {
						popup.close();
					}
					notice( 'error', 'Request failed' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		$( document ).on( 'click', '#lapub-cloud-verify', function () {
			var $btn = $( this ).prop( 'disabled', true );
			var $out = $btn.siblings( '.lapub-test-result' ).removeClass( 'is-ok is-err' ).text( LAPUB.i18n.testing );
			ajax( 'cloud_verify', { license: $( '#lapub-cloud-license' ).val() } )
				.done( function ( res ) {
					$out.addClass( res.success ? 'is-ok' : 'is-err' ).text( res.data && res.data.message ? res.data.message : ( res.success ? 'OK' : 'Error' ) );
				} )
				.fail( function () {
					$out.addClass( 'is-err' ).text( 'Request failed' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		$( document ).on( 'click', '.lapub-disconnect', function () {
			if ( ! window.confirm( LAPUB.i18n.disconnect ) ) {
				return;
			}
			var provider = $( this ).data( 'provider' );
			ajax( 'oauth_disconnect', { provider: provider } ).done( function () {
				window.location.reload();
			} );
		} );

		/* Social: webhook test */
		$( document ).on( 'click', '#lapub-webhook-test', function () {
			var $btn = $( this ).prop( 'disabled', true );
			var $out = $btn.siblings( '.lapub-test-result' ).removeClass( 'is-ok is-err' ).text( LAPUB.i18n.testing );
			ajax( 'webhook_test', { url: $( '#lapub-make-url' ).val() } )
				.done( function ( res ) {
					$out.addClass( res.success ? 'is-ok' : 'is-err' ).text( res.data && res.data.message ? res.data.message : ( res.success ? 'OK' : 'Error' ) );
				} )
				.fail( function () {
					$out.addClass( 'is-err' ).text( 'Request failed' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		/* Copy helper */
		$( document ).on( 'click', '.lapub-copy', function () {
			var $b = $( this );
			var text = $b.data( 'copy' );
			if ( navigator.clipboard ) {
				navigator.clipboard.writeText( text ).then( function () {
					var old = $b.text();
					$b.text( LAPUB.i18n.copied );
					setTimeout( function () { $b.text( old ); }, 1500 );
				} );
			}
		} );

		/* Auto-poll while a job is running */
		if ( $( '.lapub-stat-card.is-running' ).length ) {
			startPolling();
		}
	} );
} )( jQuery );
