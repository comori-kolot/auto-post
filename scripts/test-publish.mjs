import { generateArticle } from "./generate-article.mjs";
import { generateEyecatchImage } from "./generate-image.mjs";
import { publishToWordPress } from "./publish-to-wp.mjs";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

async function main() {
  const prefix = process.argv[2];
  const keyword = process.argv[3];
  if (!prefix || !keyword) {
    throw new Error("使い方: node scripts/test-publish.mjs <ENV_PREFIX> <キーワード>\n例: node scripts/test-publish.mjs AIZEN 業務効率化");
  }

  const apiKey = requireEnv("OPENAI_API_KEY");
  const wpUrl = requireEnv(`${prefix}_WP_URL`).replace(/\/$/, "");
  const wpUsername = requireEnv(`${prefix}_WP_USERNAME`);
  const wpAppPassword = requireEnv(`${prefix}_WP_APP_PASSWORD`);

  console.log(`[test-publish] [${prefix}] キーワード「${keyword}」で検証記事を生成します（下書き投稿・非公開）`);

  const article = await generateArticle({ keyword, apiKey });
  console.log(`[test-publish] 記事生成完了: ${article.title}`);

  const imageBuffer = await generateEyecatchImage({ title: article.title, keyword, apiKey });
  console.log(`[test-publish] アイキャッチ画像生成完了`);

  const post = await publishToWordPress({
    wpUrl,
    wpUsername,
    wpAppPassword,
    title: article.title,
    contentHtml: article.contentHtml,
    metaDescription: article.metaDescription,
    slug: article.slug,
    imageBuffer,
    status: "draft",
  });

  console.log(`[test-publish] 下書き投稿完了（非公開）: ${post.link}`);
  console.log(`[test-publish] 編集画面: ${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`);
}

main().catch((err) => {
  console.error("[test-publish] エラー:", err.message);
  process.exit(1);
});
