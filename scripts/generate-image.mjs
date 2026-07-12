import OpenAI from "openai";
import { SITE_CONTEXT, IMAGE_MODEL, IMAGE_SIZE } from "./config.mjs";

export async function generateEyecatchImage({ title, keyword, apiKey }) {
  const client = new OpenAI({ apiKey });

  const prompt = `ビジネス経済メディアのアイキャッチ画像（日経ビジネスやNewsPicksのような硬派な経済メディアのサムネイル品質）。横長構図。
テーマ: 「${title}」（キーワード: ${keyword}）
${SITE_CONTEXT.business}

スタイル:
- 洗練された編集デザイン。無料素材やクリップアート感のある安っぽい構図・配色は絶対に避ける
- 木材・自然素材を連想させる落ち着いた配色（木目・アースカラー、ネイビーやチャコールのアクセント）
- 明確なレイアウト：左右または上下でテキストエリアとビジュアルエリアを分けるなど、情報整理された構成にする
- キャラクター的・ゆるいイラスト演出は避け、抽象的な図形やシルエット、洗練されたグラフィック要素を使う
- 画像内に記事タイトル「${title}」を、太字の日本語見出し用書体で大きく高コントラストに配置し、遠目でも一瞬で読める視認性にする
- タイトル以外の余計な文字・ロゴ・透かしは入れない`;

  const response = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: IMAGE_SIZE,
    n: 1,
  });

  const b64 = response.data[0].b64_json;
  return Buffer.from(b64, "base64");
}
