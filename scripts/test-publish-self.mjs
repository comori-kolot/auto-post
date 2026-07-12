import { generateArticle } from "./generate-article.mjs";
import { generateEyecatchImage } from "./generate-image.mjs";
import { publishToWordPress } from "./publish-to-wp.mjs";
import { CATEGORY_NAME } from "./config.mjs";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    throw new Error("使い方: node scripts/test-publish-self.mjs <キーワード>");
  }

  const apiKey = requireEnv("OPENAI_API_KEY");
  const wpUrl = requireEnv("WP_URL").replace(/\/$/, "");
  const wpUsername = requireEnv("WP_USERNAME");
  const wpAppPassword = requireEnv("WP_APP_PASSWORD");

  console.log(`[test] キーワード「${keyword}」で検証記事を生成します（下書き投稿・非公開）`);

  const article = await generateArticle({ keyword, apiKey });
  console.log(`[test] 記事生成完了: ${article.title}`);

  const h2Count = (article.contentHtml.match(/<h2/g) || []).length;
  const markCount = (article.contentHtml.match(/<mark>/g) || []).length;
  const ctaCount = (article.contentHtml.match(/greeen-biz\.com\/contact\//g) || []).length;
  const paragraphs = article.contentHtml.match(/<p>[\s\S]*?<\/p>/g) || [];
  const overLongParagraphs = paragraphs.filter((p) => {
    const text = p.replace(/<[^>]+>/g, "");
    const sentenceCount = (text.match(/[。！？]/g) || []).length;
    return sentenceCount > 3;
  });

  console.log(`[test] H2数: ${h2Count}, mark数: ${markCount}, CTAリンク数: ${ctaCount}, 4文以上の段落数: ${overLongParagraphs.length}/${paragraphs.length}`);

  const imageBuffer = await generateEyecatchImage({ title: article.title, keyword, apiKey });
  console.log(`[test] アイキャッチ画像生成完了`);

  const post = await publishToWordPress({
    wpUrl,
    wpUsername,
    wpAppPassword,
    title: article.title,
    contentHtml: article.contentHtml,
    metaDescription: article.metaDescription,
    slug: article.slug,
    imageBuffer,
    categoryName: CATEGORY_NAME,
    status: "draft",
  });

  console.log(`[test] 下書き投稿完了（非公開）: ${post.link}`);
  console.log(`[test] 編集画面: ${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`);
}

main().catch((err) => {
  console.error("[test] エラー:", err.message);
  process.exit(1);
});
