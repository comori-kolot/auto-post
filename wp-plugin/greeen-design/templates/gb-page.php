<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>
<div class="gb-content">
	<main id="main_content" class="gb">
		<?php
		while ( have_posts() ) {
			the_post();
			gb_render_page();
		}
		?>
	</main>
</div>
<?php
get_footer();
