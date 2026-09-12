/* global MAB, jQuery */
( function ( $ ) {
	'use strict';

	var pollTimer = null;

	function ajax( action, data ) {
		return $.post( MAB.ajax, $.extend( { action: 'mab_' + action, nonce: MAB.nonce }, data || {} ) );
	}

	function applyStatus( status ) {
		if ( ! status ) {
			return;
		}
		$( '#mab-status' ).html( status.html );
		$( '#mab-log' ).html( status.log );
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
		var $n = $( '<div class="notice is-dismissible mab-notice notice-' + type + '"><p></p></div>' );
		$n.find( 'p' ).text( text );
		$( '.mab-header' ).after( $n );
		setTimeout( function () {
			$n.fadeOut( 300, function () {
				$( this ).remove();
			} );
		}, 8000 );
	}

	$( function () {
		/* Tabs */
		$( '.mab-tabs .nav-tab' ).on( 'click', function ( e ) {
			e.preventDefault();
			var tab = $( this ).data( 'tab' );
			$( '.mab-tabs .nav-tab' ).removeClass( 'nav-tab-active' );
			$( this ).addClass( 'nav-tab-active' );
			$( '.mab-tab' ).removeClass( 'is-active' );
			$( '.mab-tab[data-tab="' + tab + '"]' ).addClass( 'is-active' );
			$( '#mab-current-tab' ).val( tab );
			if ( window.history && window.history.replaceState ) {
				var url = new URL( window.location.href );
				url.searchParams.set( 'tab', tab );
				url.searchParams.delete( 'saved' );
				window.history.replaceState( null, '', url.toString() );
			}
		} );

		/* Colour pickers */
		if ( $.fn.wpColorPicker ) {
			$( '.mab-color' ).wpColorPicker();
		}

		/* Show / hide key */
		$( document ).on( 'click', '.mab-toggle-key', function () {
			var $input = $( '#' + $( this ).data( 'target' ) );
			$input.attr( 'type', 'password' === $input.attr( 'type' ) ? 'text' : 'password' );
		} );

		/* Test keys */
		$( document ).on( 'click', '.mab-test-key', function () {
			var $btn    = $( this );
			var service = $btn.data( 'service' );
			var key     = $( '#' + $btn.data( 'input' ) ).val();
			var $out    = $btn.siblings( '.mab-test-result' );
			$btn.prop( 'disabled', true );
			$out.removeClass( 'is-ok is-err' ).text( MAB.i18n.testing );
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
		$( document ).on( 'click', '#mab-generate-now', function () {
			var $btn = $( this );
			$btn.prop( 'disabled', true ).addClass( 'is-busy' );
			ajax( 'generate_now', { topic: $( '#mab-topic' ).val() } )
				.done( function ( res ) {
					if ( res.success ) {
						$( '#mab-topic' ).val( '' );
						notice( 'success', MAB.i18n.generated );
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
		$( document ).on( 'click', '#mab-poll-now', function () {
			var $btn = $( this ).prop( 'disabled', true ).text( MAB.i18n.working );
			ajax( 'poll_now' ).done( function ( res ) {
				if ( res.success ) {
					applyStatus( res.data.status );
				}
			} ).always( function () {
				$btn.prop( 'disabled', false );
			} );
		} );

		/* Cancel job */
		$( document ).on( 'click', '#mab-cancel-job', function () {
			if ( ! window.confirm( MAB.i18n.confirm ) ) {
				return;
			}
			ajax( 'cancel_job' ).done( function ( res ) {
				if ( res.success ) {
					applyStatus( res.data.status );
				}
			} );
		} );

		/* Clear log */
		$( '#mab-clear-log' ).on( 'click', function () {
			if ( ! window.confirm( MAB.i18n.clearlog ) ) {
				return;
			}
			ajax( 'clear_log' ).done( function () {
				$( '#mab-log' ).html( '<p class="description">Log cleared.</p>' );
			} );
		} );

		/* Social: connect via OAuth popup */
		$( document ).on( 'click', '.mab-connect', function () {
			var $btn     = $( this ).prop( 'disabled', true );
			var provider = $btn.data( 'provider' );
			var popup    = window.open( 'about:blank', 'mab_oauth', 'width=640,height=760,menubar=no,toolbar=no' );
			ajax( 'oauth_start', { provider: provider } )
				.done( function ( res ) {
					if ( res.success && popup ) {
						popup.location.href = res.data.url;
					} else {
						if ( popup ) {
							popup.close();
						}
						notice( 'error', res.data && res.data.message ? res.data.message : MAB.i18n.popup );
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
		$( document ).on( 'click', '.mab-connect-cloud', function () {
			var $btn     = $( this ).prop( 'disabled', true );
			var provider = $btn.data( 'provider' );
			var popup    = window.open( 'about:blank', 'mab_oauth', 'width=640,height=760,menubar=no,toolbar=no' );
			ajax( 'cloud_start', { provider: provider } )
				.done( function ( res ) {
					if ( res.success && popup ) {
						popup.location.href = res.data.url;
					} else {
						if ( popup ) {
							popup.close();
						}
						notice( 'error', res.data && res.data.message ? res.data.message : MAB.i18n.popup );
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

		$( document ).on( 'click', '#mab-cloud-verify', function () {
			var $btn = $( this ).prop( 'disabled', true );
			var $out = $btn.siblings( '.mab-test-result' ).removeClass( 'is-ok is-err' ).text( MAB.i18n.testing );
			ajax( 'cloud_verify', { license: $( '#mab-cloud-license' ).val() } )
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

		$( document ).on( 'click', '.mab-disconnect', function () {
			if ( ! window.confirm( MAB.i18n.disconnect ) ) {
				return;
			}
			var provider = $( this ).data( 'provider' );
			ajax( 'oauth_disconnect', { provider: provider } ).done( function () {
				window.location.reload();
			} );
		} );

		/* Social: webhook test */
		$( document ).on( 'click', '#mab-webhook-test', function () {
			var $btn = $( this ).prop( 'disabled', true );
			var $out = $btn.siblings( '.mab-test-result' ).removeClass( 'is-ok is-err' ).text( MAB.i18n.testing );
			ajax( 'webhook_test', { url: $( '#mab-make-url' ).val() } )
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
		$( document ).on( 'click', '.mab-copy', function () {
			var $b = $( this );
			var text = $b.data( 'copy' );
			if ( navigator.clipboard ) {
				navigator.clipboard.writeText( text ).then( function () {
					var old = $b.text();
					$b.text( MAB.i18n.copied );
					setTimeout( function () { $b.text( old ); }, 1500 );
				} );
			}
		} );

		/* Auto-poll while a job is running */
		if ( $( '.mab-stat-card.is-running' ).length ) {
			startPolling();
		}
	} );
} )( jQuery );
