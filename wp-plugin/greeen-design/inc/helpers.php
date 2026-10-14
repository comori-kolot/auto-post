<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function gb_val( $arr, $key, $default = '' ) {
	if ( is_array( $arr ) && isset( $arr[ $key ] ) && $arr[ $key ] !== '' && $arr[ $key ] !== null ) {
		return $arr[ $key ];
	}
	return $default;
}

function gb_on( $arr ) {
	return is_array( $arr ) && ! empty( $arr['show'] );
}

function gb_text( $s ) {
	return nl2br( esc_html( (string) $s ) );
}

function gb_paragraphs( $s ) {
	$s = trim( (string) $s );
	if ( $s === '' ) {
		return '';
	}
	$parts = preg_split( '/(?:\r\n|\r|\n){2,}/', $s );
	$out   = '';
	foreach ( $parts as $p ) {
		$p = trim( $p );
		if ( $p !== '' ) {
			$out .= '<p>' . nl2br( esc_html( $p ) ) . '</p>';
		}
	}
	return $out;
}

function gb_title_html( $title, $accent = '' ) {
	$t = esc_html( (string) $title );
	if ( $accent !== '' ) {
		$a = esc_html( (string) $accent );
		$t = str_replace( $a, '<em>' . $a . '</em>', $t );
	}
	return nl2br( $t );
}

function gb_btn( $label, $url, $class = 'gb-btn' ) {
	$label = (string) $label;
	$url   = (string) $url;
	if ( $label === '' || $url === '' ) {
		return '';
	}
	return '<a class="' . esc_attr( $class ) . '" href="' . esc_url( $url ) . '">' . esc_html( $label ) . '</a>';
}

function gb_eyebrow( $s ) {
	$s = (string) $s;
	return $s === '' ? '' : '<p class="gb-eyebrow">' . esc_html( $s ) . '</p>';
}

function gb_items( $d, $prefix, $count ) {
	$items = array();
	for ( $i = 1; $i <= $count; $i++ ) {
		$it = gb_val( $d, $prefix . $i, array() );
		if ( is_array( $it ) ) {
			$items[] = $it;
		}
	}
	return $items;
}
