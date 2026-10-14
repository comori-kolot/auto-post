<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// 記事内の「よくある質問」（class="gb-faq-item"）から、FAQPageの構造化データ(JSON-LD)を作ってhead内に出力する。
// 記事の本文に<script>は保存できない（サーバーの防御機能が拒否する）ため、プラグイン側で作る。
add_action( 'wp_head', 'gb_faq_jsonld', 20 );

function gb_faq_jsonld() {
	if ( ! is_singular( 'post' ) ) {
		return;
	}
	$post = get_queried_object();
	if ( ! $post || false === strpos( $post->post_content, 'data-gb-faq' ) ) {
		return;
	}
	if ( ! preg_match_all( '/<div class="gb-faq-item"><h3>(.*?)<\/h3><p>(.*?)<\/p><\/div>/s', $post->post_content, $m, PREG_SET_ORDER ) ) {
		return;
	}
	$items = array();
	foreach ( $m as $row ) {
		$q = trim( wp_strip_all_tags( html_entity_decode( $row[1], ENT_QUOTES, 'UTF-8' ) ) );
		$a = trim( wp_strip_all_tags( html_entity_decode( $row[2], ENT_QUOTES, 'UTF-8' ) ) );
		if ( '' === $q || '' === $a ) {
			continue;
		}
		$items[] = array(
			'@type'          => 'Question',
			'name'           => $q,
			'acceptedAnswer' => array(
				'@type' => 'Answer',
				'text'  => $a,
			),
		);
	}
	if ( empty( $items ) ) {
		return;
	}
	$data = array(
		'@context'   => 'https://schema.org',
		'@type'      => 'FAQPage',
		'mainEntity' => $items,
	);
	echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput
}
