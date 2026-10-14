<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function gb_f( $type, $name, $label, $path, $extra = array() ) {
	return array_merge(
		array(
			'key'   => 'field_gb_' . $path . '_' . $name,
			'label' => $label,
			'name'  => $name,
			'type'  => $type,
		),
		$extra
	);
}

function gb_build( $path, $specs ) {
	$out = array();
	foreach ( $specs as $s ) {
		if ( $s[0] === 'nested' ) {
			$out[] = gb_f(
				'group',
				$s[1],
				$s[2],
				$path,
				array(
					'layout'     => 'block',
					'sub_fields' => gb_build( $path . '_' . $s[1], $s[3] ),
				)
			);
		} else {
			$out[] = gb_f( $s[0], $s[1], $s[2], $path, $s[3] );
		}
	}
	return $out;
}

function gb_section( $name, $label, $specs ) {
	return array(
		gb_f( 'tab', 'tab_' . $name, $label, 'root', array( 'placement' => 'top' ) ),
		gb_f(
			'group',
			$name,
			$label,
			'root',
			array(
				'layout'     => 'block',
				'sub_fields' => gb_build( $name, $specs ),
			)
		),
	);
}

function gb_s_show() {
	return array(
		'true_false',
		'show',
		'このブロックを表示する',
		array(
			'ui'            => 1,
			'ui_on_text'    => '表示',
			'ui_off_text'   => '非表示',
			'default_value' => 1,
		),
	);
}

function gb_s_text( $name, $label, $ins = '' ) {
	return array( 'text', $name, $label, array( 'instructions' => $ins ) );
}

function gb_s_area( $name, $label, $ins = '', $rows = 4 ) {
	return array(
		'textarea',
		$name,
		$label,
		array(
			'instructions' => $ins,
			'rows'         => $rows,
			'new_lines'    => '',
		),
	);
}

function gb_s_flag( $name, $label ) {
	return array(
		'true_false',
		$name,
		$label,
		array(
			'ui'            => 1,
			'ui_on_text'    => 'はい',
			'ui_off_text'   => 'いいえ',
			'default_value' => 0,
		),
	);
}

function gb_s_items( $prefix, $count, $label, $specs ) {
	$out = array();
	for ( $i = 1; $i <= $count; $i++ ) {
		$out[] = array( 'nested', $prefix . $i, $label . $i, $specs );
	}
	return $out;
}

add_action( 'acf/init', 'gb_register_fields' );

function gb_register_fields() {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	$url_ins = 'https://… で始まるURL、または /contact/ のようなサイト内パス。電話は tel:0368216546 の形式。';

	$fields = array();

	$fields = array_merge(
		$fields,
		gb_section(
			'hero',
			'ヒーロー（最上部）',
			array(
				gb_s_show(),
				gb_s_text( 'eyebrow', '小見出し（英字など）', '例：GREEEN BIZ — HANNO, SAITAMA' ),
				gb_s_area( 'title', 'メインの見出し', '改行するとそのまま改行されます。', 3 ),
				gb_s_text( 'accent', '強調する言葉', '見出しの中にある言葉をそのまま入力すると、色と下線で強調されます。' ),
				gb_s_area( 'lead', 'リード文', '', 4 ),
				gb_s_text( 'btn1_label', 'ボタン1の文字', '例：無料で相談する' ),
				gb_s_text( 'btn1_url', 'ボタン1のリンク先', $url_ins ),
				gb_s_text( 'btn2_label', 'ボタン2の文字', '例：03-6821-6546' ),
				gb_s_text( 'btn2_url', 'ボタン2のリンク先', $url_ins ),
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'photo',
			'写真（全幅）',
			array(
				gb_s_show(),
				array(
					'image',
					'image',
					'写真',
					array(
						'instructions'  => '横長（横1600px以上）の写真がおすすめです。未設定ならこのブロックは表示されません。',
						'return_format' => 'array',
						'preview_size'  => 'medium',
						'library'       => 'all',
					),
				),
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'message',
			'メッセージ',
			array(
				gb_s_show(),
				gb_s_text( 'eyebrow', '小見出し（英字など）', '例：MESSAGE' ),
				gb_s_text( 'title', '見出し（任意）' ),
				gb_s_area( 'body', '本文', '1行空けると段落が分かれます。', 12 ),
				gb_s_text( 'signature', '署名', '例：合同会社COMステーション　平井 康介' ),
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'stages',
			'段階・ステップ（カード）',
			array_merge(
				array(
					gb_s_show(),
					gb_s_text( 'eyebrow', '小見出し（英字など）' ),
					gb_s_text( 'title', '見出し' ),
					gb_s_area( 'lead', '説明文', '', 3 ),
				),
				gb_s_items(
					'item_',
					6,
					'カード',
					array(
						gb_s_show(),
						gb_s_text( 'no', '番号・ラベル', '例：第一段' ),
						gb_s_text( 'title', 'タイトル' ),
						gb_s_text( 'tag', 'タグ（任意）' ),
						gb_s_area( 'text', '説明', '', 4 ),
						gb_s_text( 'url', 'リンク先（任意）', $url_ins ),
					)
				),
				array( gb_s_area( 'note', '補足文（任意）', '', 2 ) )
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'features',
			'強み・ポイント',
			array_merge(
				array(
					gb_s_show(),
					gb_s_text( 'eyebrow', '小見出し（英字など）' ),
					gb_s_text( 'title', '見出し' ),
				),
				gb_s_items(
					'item_',
					4,
					'項目',
					array(
						gb_s_show(),
						gb_s_text( 'title', 'タイトル' ),
						gb_s_area( 'text', '説明', '', 4 ),
					)
				),
				array( gb_s_area( 'closing', '締めの一文（任意）', '', 2 ) )
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'cards',
			'リンク付き一覧（サービス・事例など）',
			array_merge(
				array(
					gb_s_show(),
					gb_s_text( 'eyebrow', '小見出し（英字など）' ),
					gb_s_text( 'title', '見出し' ),
					gb_s_area( 'lead', '説明文', '', 3 ),
				),
				gb_s_items(
					'item_',
					6,
					'項目',
					array(
						gb_s_show(),
						gb_s_text( 'title', 'タイトル' ),
						gb_s_area( 'text', '説明', '', 3 ),
						gb_s_text( 'url', 'リンク先（任意）', $url_ins ),
					)
				)
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'pricing',
			'料金プラン',
			array_merge(
				array(
					gb_s_show(),
					gb_s_text( 'eyebrow', '小見出し（英字など）' ),
					gb_s_text( 'title', '見出し' ),
					gb_s_area( 'lead', '説明文', '', 3 ),
				),
				gb_s_items(
					'plan_',
					3,
					'プラン',
					array(
						gb_s_show(),
						gb_s_flag( 'recommended', 'おすすめ表示にする' ),
						gb_s_text( 'name', 'プラン名' ),
						gb_s_text( 'price', '料金', '例：15万円〜' ),
						gb_s_text( 'target', '向いている方' ),
						gb_s_area( 'features', '内容', '1行に1項目で入力します。', 8 ),
						gb_s_text( 'btn_label', 'ボタンの文字' ),
						gb_s_text( 'btn_url', 'ボタンのリンク先', $url_ins ),
					)
				),
				array( gb_s_area( 'note', '注記（任意）', '', 2 ) )
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'flow',
			'流れ（ステップ）',
			array_merge(
				array(
					gb_s_show(),
					gb_s_text( 'eyebrow', '小見出し（英字など）' ),
					gb_s_text( 'title', '見出し' ),
					gb_s_area( 'lead', '説明文', '', 3 ),
				),
				gb_s_items(
					'item_',
					8,
					'ステップ',
					array(
						gb_s_show(),
						gb_s_text( 'title', 'タイトル' ),
						gb_s_area( 'text', '説明', '', 3 ),
					)
				)
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'faq',
			'よくある質問',
			array_merge(
				array(
					gb_s_show(),
					gb_s_text( 'eyebrow', '小見出し（英字など）' ),
					gb_s_text( 'title', '見出し' ),
				),
				gb_s_items(
					'item_',
					10,
					'質問',
					array(
						gb_s_show(),
						gb_s_text( 'q', '質問' ),
						gb_s_area( 'a', '回答', '', 3 ),
					)
				)
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'body',
			'自由入力（本文エディタ）',
			array(
				gb_s_show(),
				gb_s_text( 'eyebrow', '小見出し（英字など）' ),
				gb_s_text( 'title', '見出し' ),
			)
		)
	);

	$fields = array_merge(
		$fields,
		gb_section(
			'cta',
			'相談ボタン（最下部）',
			array(
				gb_s_show(),
				gb_s_text( 'title', '見出し' ),
				gb_s_area( 'lead', '説明文', '', 3 ),
				gb_s_text( 'btn_label', 'ボタンの文字' ),
				gb_s_text( 'btn_url', 'ボタンのリンク先', $url_ins ),
				gb_s_text( 'tel_label', '電話番号の表示', '例：03-6821-6546' ),
				gb_s_text( 'tel_url', '電話のリンク', '例：tel:0368216546' ),
				gb_s_text( 'note', '注記（任意）' ),
			)
		)
	);

	acf_add_local_field_group(
		array(
			'key'                   => 'group_gb_page',
			'title'                 => 'グリビズ共通レイアウト：ページ内容',
			'fields'                => $fields,
			'location'              => array(
				array(
					array(
						'param'    => 'page_template',
						'operator' => '==',
						'value'    => 'gb-page.php',
					),
				),
			),
			'menu_order'            => 0,
			'position'              => 'normal',
			'style'                 => 'default',
			'label_placement'       => 'top',
			'instruction_placement' => 'label',
			'show_in_rest'          => true,
			'active'                => true,
		)
	);
}
