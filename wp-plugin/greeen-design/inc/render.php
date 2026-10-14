<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function gb_render_page() {
	if ( ! function_exists( 'get_field' ) ) {
		if ( current_user_can( 'edit_pages' ) ) {
			echo '<div class="gb-notice">ACF（Advanced Custom Fields）が有効化されていません。プラグイン画面で有効化してください。</div>';
		}
		echo '<section class="gb-sec"><div class="gb-inner gb-prose">';
		the_content();
		echo '</div></section>';
		return;
	}

	$has_hero = gb_on( get_field( 'hero' ) );
	if ( ! $has_hero ) {
		echo '<h1 class="gb-sr">' . esc_html( get_the_title() ) . '</h1>';
	}

	$order = array( 'hero', 'photo', 'message', 'stages', 'features', 'cards', 'pricing', 'flow', 'faq', 'body', 'cta' );
	foreach ( $order as $name ) {
		$data = get_field( $name );
		if ( ! gb_on( $data ) ) {
			continue;
		}
		$fn = 'gb_render_' . $name;
		if ( function_exists( $fn ) ) {
			$fn( $data );
		}
	}
}

function gb_sec_head( $d, $tag = 'h2' ) {
	$out = gb_eyebrow( gb_val( $d, 'eyebrow' ) );
	$t   = gb_val( $d, 'title' );
	if ( $t !== '' ) {
		$out .= '<' . $tag . ' class="gb-h2">' . gb_text( $t ) . '</' . $tag . '>';
	}
	return $out === '' ? '' : '<div class="gb-head">' . $out . '</div>';
}

function gb_render_photo( $d ) {
	$img = gb_val( $d, 'image' );
	if ( ! $img ) {
		return;
	}
	$id = is_array( $img ) ? (int) gb_val( $img, 'ID', 0 ) : (int) $img;
	if ( $id <= 0 ) {
		return;
	}
	echo '<div class="gb-photo">' . wp_get_attachment_image( $id, 'full', false, array( 'class' => 'gb-photo__img', 'loading' => 'lazy' ) ) . '</div>';
}

function gb_render_hero( $d ) {
	$title = gb_val( $d, 'title' );
	if ( $title === '' ) {
		return;
	}
	echo '<section class="gb-sec gb-hero"><div class="gb-inner">';
	echo gb_eyebrow( gb_val( $d, 'eyebrow' ) );
	echo '<h1 class="gb-h1">' . gb_title_html( $title, gb_val( $d, 'accent' ) ) . '</h1>';
	$lead = gb_val( $d, 'lead' );
	if ( $lead !== '' ) {
		echo '<p class="gb-lead">' . gb_text( $lead ) . '</p>';
	}
	$b1 = gb_btn( gb_val( $d, 'btn1_label' ), gb_val( $d, 'btn1_url' ), 'gb-btn' );
	$b2 = gb_btn( gb_val( $d, 'btn2_label' ), gb_val( $d, 'btn2_url' ), 'gb-btn gb-btn--ghost' );
	if ( $b1 . $b2 !== '' ) {
		echo '<div class="gb-actions">' . $b1 . $b2 . '</div>';
	}
	echo '</div></section>';
}

function gb_render_message( $d ) {
	$body = gb_val( $d, 'body' );
	if ( $body === '' ) {
		return;
	}
	echo '<section class="gb-sec gb-sec--tone"><div class="gb-inner">';
	echo gb_sec_head( $d );
	echo '<div class="gb-prose">' . gb_paragraphs( $body ) . '</div>';
	$sig = gb_val( $d, 'signature' );
	if ( $sig !== '' ) {
		echo '<p class="gb-sign">' . esc_html( $sig ) . '</p>';
	}
	echo '</div></section>';
}

function gb_render_stages( $d ) {
	$cards = '';
	foreach ( gb_items( $d, 'item_', 6 ) as $it ) {
		if ( ! gb_on( $it ) || gb_val( $it, 'title' ) === '' ) {
			continue;
		}
		$inner  = '';
		$inner .= gb_val( $it, 'no' ) !== '' ? '<span class="gb-card__no">' . esc_html( gb_val( $it, 'no' ) ) . '</span>' : '';
		$inner .= '<h3 class="gb-card__title">' . gb_text( gb_val( $it, 'title' ) ) . '</h3>';
		$inner .= gb_val( $it, 'tag' ) !== '' ? '<span class="gb-card__tag">' . esc_html( gb_val( $it, 'tag' ) ) . '</span>' : '';
		$inner .= gb_val( $it, 'text' ) !== '' ? '<p class="gb-card__text">' . gb_text( gb_val( $it, 'text' ) ) . '</p>' : '';
		$url    = gb_val( $it, 'url' );
		if ( $url !== '' ) {
			$cards .= '<a class="gb-card gb-card--link" href="' . esc_url( $url ) . '">' . $inner . '<span class="gb-card__more">詳しく見る</span></a>';
		} else {
			$cards .= '<div class="gb-card">' . $inner . '</div>';
		}
	}
	if ( $cards === '' ) {
		return;
	}
	echo '<section class="gb-sec"><div class="gb-inner">';
	echo gb_sec_head( $d );
	$lead = gb_val( $d, 'lead' );
	if ( $lead !== '' ) {
		echo '<p class="gb-lead">' . gb_text( $lead ) . '</p>';
	}
	echo '<div class="gb-grid gb-grid--4">' . $cards . '</div>';
	$note = gb_val( $d, 'note' );
	if ( $note !== '' ) {
		echo '<p class="gb-note">' . gb_text( $note ) . '</p>';
	}
	echo '</div></section>';
}

function gb_render_features( $d ) {
	$cols = '';
	foreach ( gb_items( $d, 'item_', 4 ) as $it ) {
		if ( ! gb_on( $it ) || gb_val( $it, 'title' ) === '' ) {
			continue;
		}
		$cols .= '<div class="gb-feature"><h3 class="gb-feature__title">' . gb_text( gb_val( $it, 'title' ) ) . '</h3>';
		if ( gb_val( $it, 'text' ) !== '' ) {
			$cols .= '<p>' . gb_text( gb_val( $it, 'text' ) ) . '</p>';
		}
		$cols .= '</div>';
	}
	if ( $cols === '' ) {
		return;
	}
	echo '<section class="gb-sec"><div class="gb-inner">';
	echo gb_sec_head( $d );
	echo '<div class="gb-grid gb-grid--2">' . $cols . '</div>';
	$closing = gb_val( $d, 'closing' );
	if ( $closing !== '' ) {
		echo '<p class="gb-closing">' . gb_text( $closing ) . '</p>';
	}
	echo '</div></section>';
}

function gb_render_cards( $d ) {
	$rows = '';
	foreach ( gb_items( $d, 'item_', 6 ) as $it ) {
		if ( ! gb_on( $it ) || gb_val( $it, 'title' ) === '' ) {
			continue;
		}
		$inner  = '<span class="gb-row__main"><strong>' . gb_text( gb_val( $it, 'title' ) ) . '</strong>';
		$inner .= gb_val( $it, 'text' ) !== '' ? '<span>' . gb_text( gb_val( $it, 'text' ) ) . '</span>' : '';
		$inner .= '</span>';
		$url    = gb_val( $it, 'url' );
		if ( $url !== '' ) {
			$rows .= '<a class="gb-row" href="' . esc_url( $url ) . '">' . $inner . '<span class="gb-row__arrow" aria-hidden="true">→</span></a>';
		} else {
			$rows .= '<div class="gb-row">' . $inner . '</div>';
		}
	}
	if ( $rows === '' ) {
		return;
	}
	echo '<section class="gb-sec"><div class="gb-inner">';
	echo gb_sec_head( $d );
	$lead = gb_val( $d, 'lead' );
	if ( $lead !== '' ) {
		echo '<p class="gb-lead">' . gb_text( $lead ) . '</p>';
	}
	echo '<div class="gb-rows">' . $rows . '</div>';
	echo '</div></section>';
}

function gb_render_pricing( $d ) {
	$plans = '';
	foreach ( gb_items( $d, 'plan_', 3 ) as $it ) {
		if ( ! gb_on( $it ) || gb_val( $it, 'name' ) === '' ) {
			continue;
		}
		$rec    = ! empty( $it['recommended'] );
		$plans .= '<div class="gb-plan' . ( $rec ? ' gb-plan--rec' : '' ) . '">';
		if ( $rec ) {
			$plans .= '<span class="gb-plan__badge">おすすめ</span>';
		}
		$plans .= '<h3 class="gb-plan__name">' . esc_html( gb_val( $it, 'name' ) ) . '</h3>';
		if ( gb_val( $it, 'price' ) !== '' ) {
			$plans .= '<p class="gb-plan__price">' . esc_html( gb_val( $it, 'price' ) ) . '</p>';
		}
		if ( gb_val( $it, 'target' ) !== '' ) {
			$plans .= '<p class="gb-plan__target">' . esc_html( gb_val( $it, 'target' ) ) . '</p>';
		}
		$lines = preg_split( '/\r\n|\r|\n/', trim( (string) gb_val( $it, 'features' ) ) );
		$li    = '';
		foreach ( $lines as $line ) {
			$line = trim( $line );
			if ( $line !== '' ) {
				$li .= '<li>' . esc_html( $line ) . '</li>';
			}
		}
		if ( $li !== '' ) {
			$plans .= '<ul class="gb-plan__list">' . $li . '</ul>';
		}
		$plans .= gb_btn( gb_val( $it, 'btn_label' ), gb_val( $it, 'btn_url' ), $rec ? 'gb-btn gb-btn--rec' : 'gb-btn' );
		$plans .= '</div>';
	}
	if ( $plans === '' ) {
		return;
	}
	echo '<section class="gb-sec gb-sec--tone"><div class="gb-inner">';
	echo gb_sec_head( $d );
	$lead = gb_val( $d, 'lead' );
	if ( $lead !== '' ) {
		echo '<p class="gb-lead">' . gb_text( $lead ) . '</p>';
	}
	echo '<div class="gb-grid gb-grid--3">' . $plans . '</div>';
	$note = gb_val( $d, 'note' );
	if ( $note !== '' ) {
		echo '<p class="gb-note">' . gb_text( $note ) . '</p>';
	}
	echo '</div></section>';
}

function gb_render_flow( $d ) {
	$steps = '';
	$n     = 0;
	foreach ( gb_items( $d, 'item_', 8 ) as $it ) {
		if ( ! gb_on( $it ) || gb_val( $it, 'title' ) === '' ) {
			continue;
		}
		$n++;
		$steps .= '<li class="gb-step"><span class="gb-step__no">' . esc_html( sprintf( '%02d', $n ) ) . '</span><div><h3 class="gb-step__title">' . gb_text( gb_val( $it, 'title' ) ) . '</h3>';
		if ( gb_val( $it, 'text' ) !== '' ) {
			$steps .= '<p>' . gb_text( gb_val( $it, 'text' ) ) . '</p>';
		}
		$steps .= '</div></li>';
	}
	if ( $steps === '' ) {
		return;
	}
	echo '<section class="gb-sec"><div class="gb-inner">';
	echo gb_sec_head( $d );
	$lead = gb_val( $d, 'lead' );
	if ( $lead !== '' ) {
		echo '<p class="gb-lead">' . gb_text( $lead ) . '</p>';
	}
	echo '<ol class="gb-steps">' . $steps . '</ol>';
	echo '</div></section>';
}

function gb_render_faq( $d ) {
	$list = '';
	foreach ( gb_items( $d, 'item_', 10 ) as $it ) {
		if ( ! gb_on( $it ) || gb_val( $it, 'q' ) === '' ) {
			continue;
		}
		$list .= '<details class="gb-faq"><summary>' . esc_html( gb_val( $it, 'q' ) ) . '</summary><div class="gb-faq__a">' . gb_text( gb_val( $it, 'a' ) ) . '</div></details>';
	}
	if ( $list === '' ) {
		return;
	}
	echo '<section class="gb-sec gb-sec--tone"><div class="gb-inner">';
	echo gb_sec_head( $d );
	echo $list;
	echo '</div></section>';
}

function gb_render_body( $d ) {
	ob_start();
	the_content();
	$content = trim( ob_get_clean() );
	if ( $content === '' ) {
		return;
	}
	echo '<section class="gb-sec"><div class="gb-inner">';
	echo gb_sec_head( $d );
	echo '<div class="gb-prose gb-body">' . $content . '</div></div></section>';
}

function gb_render_cta( $d ) {
	$title = gb_val( $d, 'title' );
	if ( $title === '' ) {
		return;
	}
	echo '<section class="gb-sec gb-cta"><div class="gb-inner">';
	echo '<h2 class="gb-h2">' . gb_text( $title ) . '</h2>';
	$lead = gb_val( $d, 'lead' );
	if ( $lead !== '' ) {
		echo '<p class="gb-lead">' . gb_text( $lead ) . '</p>';
	}
	$b1  = gb_btn( gb_val( $d, 'btn_label' ), gb_val( $d, 'btn_url' ), 'gb-btn' );
	$tel = gb_btn( gb_val( $d, 'tel_label' ), gb_val( $d, 'tel_url' ), 'gb-btn gb-btn--ghost' );
	if ( $b1 . $tel !== '' ) {
		echo '<div class="gb-actions gb-actions--center">' . $b1 . $tel . '</div>';
	}
	$note = gb_val( $d, 'note' );
	if ( $note !== '' ) {
		echo '<p class="gb-note">' . gb_text( $note ) . '</p>';
	}
	echo '</div></section>';
}
