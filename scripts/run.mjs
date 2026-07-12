import path from "node:path";
import { fileURLToPath } from "node:url";
import { readKeywords, writeKeywords } from "./csv.mjs";
import { generateArticle } from "./generate-article.mjs";
import { generateEyecatchImage } from "./generate-image.mjs";
import { publishToWordPress } from "./publish-to-wp.mjs";
import { CATEGORY_NAME } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYWORDS_PATH = path.join(__dirname, "..", "data", "keywords.csv");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

async function main() {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const wpUrl = requireEnv("WP_URL").replace(/\/$/, "");
  const wpUsername = requireEnv("WP_USERNAME");
  const wpAppPassword = requireEnv("WP_APP_PASSWORD");

  const { header, rows } = await readKeywords(KEYWORDS_PATH);
  const targetRow = rows.find((row) => row.status === "unused");

  if (!targetRow) {
    throw new Error("data/keywords.csv に未使用のキーワードがありません。新しいキーワードを追加してください。");
  }

  const keyword = targetRow.keyword;
  console.log(`[run] キーワード「${keyword}」で記事を生成します`);

  const article = await generateArticle({ keyword, apiKey });
  console.log(`[run] 記事生成完了: ${article.title}`);

  const imageBuffer = await generateEyecatchImage({ title: article.title, keyword, apiKey });
  console.log(`[run] アイキャッチ画像生成完了`);

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
  });
  console.log(`[run] WordPress投稿完了: ${post.link}`);

  targetRow.status = "used";
  targetRow.published_url = post.link;
  await writeKeywords(KEYWORDS_PATH, header, rows);
  console.log(`[run] data/keywords.csv を更新しました`);
}

main().catch((err) => {
  console.error("[run] エラー:", err.message);
  process.exit(1);
});
