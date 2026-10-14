<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter( 'theme_page_templates', 'gb_register_template' );

function gb_register_template( $templates ) {
	$templates['gb-page.php'] = 'グリビズ共通レイアウト';
	return $templates;
}

add_filter( 'template_include', 'gb_load_template' );

function gb_load_template( $template ) {
	if ( is_singular( 'page' ) && get_page_template_slug( get_queried_object_id() ) === 'gb-page.php' ) {
		$file = GB_DIR . 'templates/gb-page.php';
		if ( file_exists( $file ) ) {
			return $file;
		}
	}
	return $template;
}
