import OpenAI from "openai";
import { SITE_CONTEXT, IMAGE_MODEL, IMAGE_SIZE } from "./config.mjs";

export async function generateEyecatchImage({ title, keyword, apiKey }) {
  const client = new OpenAI({ apiKey });

  const prompt = `ブログ記事のアイキャッチ画像。テーマ: 「${title}」（キーワード: ${keyword}）。
${SITE_CONTEXT.business}
木材・製材工場を連想させる落ち着いた木目調の配色。文字は入れない。写実的またはフラットイラスト調。横長構図。`;

  const response = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: IMAGE_SIZE,
    n: 1,
  });

  const b64 = response.data[0].b64_json;
  return Buffer.from(b64, "base64");
}
