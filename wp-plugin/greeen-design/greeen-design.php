<?php
// Plugin Name: Greeen Design
// Description: グリビズ共通デザイン（ヘッダー・フッター・コラム装飾・固定ページ用テンプレート）。固定ページの入力欄はACF（無料版）で表示されます。
// Version: 0.2.0
// Author: Greeen Biz
// Requires PHP: 7.2

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GB_VER', '0.2.0' );
define( 'GB_DIR', plugin_dir_path( __FILE__ ) );
define( 'GB_URL', plugin_dir_url( __FILE__ ) );

require_once GB_DIR . 'inc/helpers.php';
require_once GB_DIR . 'inc/template.php';
require_once GB_DIR . 'inc/fields.php';
require_once GB_DIR . 'inc/render.php';
require_once GB_DIR . 'inc/faq-schema.php';

add_action( 'wp_enqueue_scripts', 'gb_enqueue_assets', 99 );

function gb_enqueue_assets() {
	wp_enqueue_style( 'gb-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500;600&display=swap', array(), null );
	$base = GB_DIR . 'assets/css/gb-base.css';
	wp_enqueue_style( 'gb-base', GB_URL . 'assets/css/gb-base.css', array(), file_exists( $base ) ? filemtime( $base ) : GB_VER );

	if ( is_page_template( 'gb-page.php' ) ) {
		$page = GB_DIR . 'assets/css/gb-page.css';
		wp_enqueue_style( 'gb-page', GB_URL . 'assets/css/gb-page.css', array( 'gb-base' ), file_exists( $page ) ? filemtime( $page ) : GB_VER );
	}
}

add_filter( 'body_class', 'gb_body_class' );

function gb_body_class( $classes ) {
	$classes[] = 'gb-site';
	if ( is_page_template( 'gb-page.php' ) ) {
		$classes[] = 'gb-page';
	}
	return $classes;
}
