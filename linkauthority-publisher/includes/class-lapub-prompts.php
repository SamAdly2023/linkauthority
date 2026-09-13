<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds the prompts and JSON schemas sent to Manus.
 */
class LAPUB_Prompts {

	/**
	 * Business context block shared by every prompt.
	 */
	public static function business_context() {
		$o = LAPUB_Options::all();

		$site_name = $o['site_name'] ? $o['site_name'] : get_bloginfo( 'name' );
		$site_url  = $o['site_url'] ? $o['site_url'] : home_url( '/' );

		$lines   = array();
		$lines[] = 'BUSINESS / WEBSITE PROFILE';
		$lines[] = 'Name: ' . $site_name;
		$lines[] = 'Website: ' . $site_url;
		if ( $o['business_description'] ) {
			$lines[] = 'Description: ' . trim( $o['business_description'] );
		}
		if ( $o['target_audience'] ) {
			$lines[] = 'Target audience: ' . trim( $o['target_audience'] );
		}
		if ( $o['focus_keywords'] ) {
			$lines[] = 'Priority topics / keywords to rank for: ' . trim( $o['focus_keywords'] );
		}
		$socials = LAPUB_Options::social_links();
		if ( $socials ) {
			$parts = array();
			foreach ( $socials as $s ) {
				$parts[] = $s['label'] . ': ' . $s['url'];
			}
			$lines[] = 'Social media: ' . implode( ' | ', $parts );
		}
		$tones   = LAPUB_Options::tones();
		$lines[] = 'Brand voice: ' . ( isset( $tones[ $o['tone'] ] ) ? $tones[ $o['tone'] ] : $o['tone'] );
		if ( $o['custom_instructions'] ) {
			$lines[] = 'Extra instructions from the site owner: ' . trim( $o['custom_instructions'] );
		}
		return implode( "\n", $lines );
	}

	/**
	 * Titles of recent auto-generated + regular posts so Manus never repeats a topic.
	 */
	public static function recent_titles( $limit = 40 ) {
		$posts = get_posts(
			array(
				'post_type'      => 'post',
				'post_status'    => array( 'publish', 'draft', 'future', 'pending' ),
				'posts_per_page' => $limit,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'fields'         => 'ids',
			)
		);
		$titles = array();
		foreach ( $posts as $id ) {
			$t = get_the_title( $id );
			if ( $t ) {
				$titles[] = $t;
			}
		}
		return $titles;
	}

	/**
	 * Full prompt for the blog-post task.
	 */
	public static function content_prompt( $topic = '' ) {
		$o         = LAPUB_Options::all();
		$topic     = trim( (string) $topic );
		$min       = max( 800, (int) $o['min_words'] );
		$max       = max( $min + 200, (int) $o['max_words'] );
		$site_url  = $o['site_url'] ? $o['site_url'] : home_url( '/' );
		$titles    = self::recent_titles();
		$today     = wp_date( 'F j, Y' );
		$use_video = ! empty( $o['use_pexels_videos'] ) && ! empty( $o['pexels_api_key'] );
		$use_photo = ! empty( $o['use_pexels_photos'] ) && ! empty( $o['pexels_api_key'] );

		$media_types = array( 'none' );
		if ( $use_photo ) {
			$media_types[] = 'photo';
		}
		if ( $use_video ) {
			$media_types[] = 'video';
		}

		$p   = array();
		$p[] = 'You are a senior SEO content strategist and long-form writer working for the business below. Today is ' . $today . '.';
		$p[] = '';
		$p[] = self::business_context();
		$p[] = '';
		$p[] = 'YOUR JOB';
		if ( $topic ) {
			$p[] = '1. The site owner has requested this specific topic: "' . str_replace( '"', "'", $topic ) . '". Research it online (browse the web) so the article is accurate, current and more useful than what already ranks on Google for it.';
			$p[] = '2. Do not duplicate these existing posts on the site - if the requested topic overlaps, take a clearly different angle:';
		} else {
			$p[] = '1. Research (browse the web) what this business\'s target audience is searching for right now: trending questions, "how to" queries, comparisons, seasonal angles and pain points that are closely related to the business and its priority keywords. Prefer topics with clear search intent where a detailed, genuinely helpful article can rank on Google and bring qualified visitors/customers to the business.';
			$p[] = '2. Pick ONE specific, high-value topic that is NOT already covered by these existing posts on the site (avoid duplicates and near-duplicates):';
		}
		$p[] = $titles ? '   - ' . implode( "\n   - ", array_map( 'wp_strip_all_tags', $titles ) ) : '   (no existing posts yet)';
		$p[] = '3. Write a complete, original, people-first blog post of ' . $min . ' to ' . $max . ' words (count only the body text in intro_html, sections[].html, faq answers and conclusion_html). This length is a hard requirement - do not stop early. Aim for roughly ' . round( ( $min + $max ) / 2 ) . ' words.';
		$p[] = '';
		$p[] = 'CONTENT REQUIREMENTS';
		$p[] = '- A click-worthy but honest title (55-65 characters) that contains the focus keyword near the start.';
		$p[] = '- A compelling meta description (140-155 characters) with the focus keyword.';
		$p[] = '- 7 to 10 main sections (H2 level), each with 250-400 words of substantive, specific, actionable content. Use H3 sub-headings inside sections where helpful.';
		$p[] = '- Use real facts, statistics, examples, step-by-step instructions, comparisons and expert tips gathered from your research. Mention sources naturally in the text (e.g. "according to a 2025 report by ...") and add a real outbound link (<a href="..." target="_blank" rel="noopener">) to 2-4 authoritative sources.';
		$p[] = '- Naturally weave in the focus keyword and 5-8 semantically related keywords. Never keyword-stuff.';
		$p[] = '- Reference the business where it is genuinely relevant (how its products/services solve the reader\'s problem) and link to ' . $site_url . ' at least twice with descriptive anchor text.';
		$p[] = '- Include 5 to 7 FAQ items that match "People also ask" style questions, each answered in 60-120 words.';
		$p[] = '- End with a strong conclusion (150-250 words) and a call-to-action that points readers to the business website and social channels.';
		$p[] = '- Write in the brand voice described above; short paragraphs (2-4 sentences), active voice, no fluff, no filler phrases like "In today\'s fast-paced world".';
		$p[] = '';
		$p[] = 'HTML RULES (very important)';
		$p[] = '- All *_html fields must be clean, valid HTML fragments using ONLY these tags: <p>, <h3>, <h4>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <br>. No <h1>, no <h2> (section headings are supplied separately), no <img>, no <script>, no <style>, no inline style attributes, no markdown.';
		$p[] = '- Each section should include at least one list, table, blockquote or bold key phrase so the layout looks visually rich.';
		$p[] = '';
		$p[] = 'MEDIA PLANNING';
		$p[] = '- For each section provide media_query: a short (2-4 words) English stock-photo search phrase that visually represents the section (concrete nouns: e.g. "barista pouring latte", "modern office desk"). Avoid abstract words and brand names.';
		$p[] = '- media_type must be one of: ' . implode( ', ', $media_types ) . '. ' . ( $use_video ? 'Use "video" for at most 2 sections where motion adds value; use "photo" for most others; use "none" for 1-2 short sections.' : 'Use "photo" for most sections and "none" for 1-2 short sections.' );
		$p[] = '- featured_image_prompt: a vivid, detailed description (40-80 words) of an ideal hero image for this article: subject, setting, lighting, mood, colour palette, composition. Photorealistic, no text or logos in the image.';
		$p[] = '';
		$p[] = 'SOCIAL MEDIA COPY';
		$p[] = '- facebook_post: 80-150 words, conversational hook + 2-3 key points + invitation to read, end with 3-5 hashtags. Do NOT include the URL (it is appended automatically).';
		$p[] = '- instagram_caption: 100-180 words, scroll-stopping first line, line breaks between short paragraphs, 1-3 emojis where natural, ends with 15-20 relevant hashtags. Do NOT include a URL (say "link in bio" or similar).';
		$p[] = '- pinterest_title: max 90 characters, keyword-rich. pinterest_description: 150-400 characters with 2-4 hashtags.';
		$p[] = '- linkedin_post: 120-220 words, professional insight-led tone, short paragraphs, a question or takeaway, 3-5 hashtags, no URL.';
		$p[] = '';
		$p[] = 'Return ONLY the final result as structured output matching the provided JSON schema. Do not ask questions - make sensible assumptions and finish the task autonomously.';

		return implode( "\n", $p );
	}

	/**
	 * JSON schema for structured output of the blog-post task.
	 */
	public static function content_schema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			// Manus requires every property to be listed in "required" and additionalProperties=false on every object.
			'required'             => array( 'title', 'slug', 'meta_description', 'excerpt', 'focus_keyword', 'secondary_keywords', 'tags', 'category', 'featured_image_prompt', 'intro_html', 'key_takeaways', 'sections', 'faq', 'conclusion_html', 'cta', 'social' ),
			'properties'           => array(
				'title'                 => array( 'type' => 'string', 'description' => 'SEO post title, 55-65 characters.' ),
				'slug'                  => array( 'type' => 'string', 'description' => 'URL slug, lowercase words separated by hyphens.' ),
				'meta_description'      => array( 'type' => 'string', 'description' => '140-155 character meta description.' ),
				'excerpt'               => array( 'type' => 'string', 'description' => '1-2 sentence teaser (plain text).' ),
				'focus_keyword'         => array( 'type' => 'string' ),
				'secondary_keywords'    => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
				'tags'                  => array( 'type' => 'array', 'items' => array( 'type' => 'string' ), 'description' => '4-8 short tags.' ),
				'category'              => array( 'type' => 'string', 'description' => 'Single best category name.' ),
				'featured_image_prompt' => array( 'type' => 'string' ),
				'intro_html'            => array( 'type' => 'string', 'description' => 'Opening 150-250 words as HTML paragraphs.' ),
				'key_takeaways'         => array( 'type' => 'array', 'items' => array( 'type' => 'string' ), 'description' => '4-6 one-sentence takeaways (plain text).' ),
				'sections'              => array(
					'type'  => 'array',
					'items' => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'required'             => array( 'heading', 'html', 'media_query', 'media_type', 'callout', 'stat_value', 'stat_label' ),
						'properties'           => array(
							'heading'     => array( 'type' => 'string', 'description' => 'H2 heading text.' ),
							'html'        => array( 'type' => 'string', 'description' => '250-400 words of HTML.' ),
							'media_query' => array( 'type' => 'string' ),
							'media_type'  => array( 'type' => 'string', 'enum' => array( 'photo', 'video', 'none' ) ),
							'callout'     => array( 'type' => 'string', 'description' => 'Optional 1-2 sentence pro tip / highlight for this section (plain text). Empty string if none.' ),
							'stat_value'  => array( 'type' => 'string', 'description' => 'Optional eye-catching statistic e.g. "73%". Empty string if none.' ),
							'stat_label'  => array( 'type' => 'string', 'description' => 'Label for the statistic. Empty string if none.' ),
						),
					),
				),
				'faq'                   => array(
					'type'  => 'array',
					'items' => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'required'             => array( 'question', 'answer_html' ),
						'properties'           => array(
							'question'    => array( 'type' => 'string' ),
							'answer_html' => array( 'type' => 'string' ),
						),
					),
				),
				'conclusion_html'       => array( 'type' => 'string' ),
				'social'                => array(
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => array( 'facebook_post', 'instagram_caption', 'pinterest_title', 'pinterest_description', 'linkedin_post' ),
					'properties'           => array(
						'facebook_post'         => array( 'type' => 'string' ),
						'instagram_caption'     => array( 'type' => 'string' ),
						'pinterest_title'       => array( 'type' => 'string' ),
						'pinterest_description' => array( 'type' => 'string' ),
						'linkedin_post'         => array( 'type' => 'string' ),
					),
				),
				'cta'                   => array(
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => array( 'heading', 'text', 'button_label', 'button_url' ),
					'properties'           => array(
						'heading'      => array( 'type' => 'string' ),
						'text'         => array( 'type' => 'string' ),
						'button_label' => array( 'type' => 'string' ),
						'button_url'   => array( 'type' => 'string' ),
					),
				),
			),
		);
	}

	/**
	 * Prompt for the featured-image task.
	 */
	public static function image_prompt( array $post ) {
		$title = isset( $post['title'] ) ? $post['title'] : '';
		$desc  = isset( $post['featured_image_prompt'] ) ? $post['featured_image_prompt'] : '';
		$o     = LAPUB_Options::all();

		$p   = array();
		$p[] = 'Generate ONE high-quality featured image for a blog post and return it as an image file attachment (PNG or JPG).';
		$p[] = '';
		$p[] = 'Blog post title: ' . $title;
		$p[] = 'Image brief: ' . $desc;
		$p[] = '';
		$p[] = 'Requirements:';
		$p[] = '- Landscape orientation, 16:9 aspect ratio, at least 1536x864 pixels.';
		$p[] = '- Photorealistic or premium editorial illustration style; magazine-cover quality; strong focal point; cinematic lighting; rich but tasteful colours' . ( $o['accent_color'] ? ' (complementary to the brand accent colour ' . $o['accent_color'] . ')' : '' ) . '.';
		$p[] = '- Absolutely NO text, letters, numbers, captions, watermarks or logos anywhere in the image.';
		$p[] = '- Do not depict real, identifiable people or copyrighted characters.';
		$p[] = '';
		$p[] = 'Use your image generation tool. Do not ask questions; produce the final image and attach the file to your final message.';

		return implode( "\n", $p );
	}
}
