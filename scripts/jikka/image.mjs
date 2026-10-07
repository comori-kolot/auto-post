import OpenAI from "openai";
import { MODELS } from "./config.mjs";

export async function generateEyecatch({ title, keyword, apiKey }) {
  const client = new OpenAI({ apiKey });
  const prompt = `暮らしと相続の実務を解説するメディアのアイキャッチ画像。横長構図。
テーマ: 「${title}」（キーワード: ${keyword}）

スタイル:
- フラットな2Dの背景イラスト。落ち着いた自然の風景（里山、古い日本家屋のシルエット、田畑、森）を、深い緑・生成り・墨色を基調に、控えめに描く
- 洗練された編集デザイン。無料素材やクリップアート風の安っぽい構図、キャラクター、ゆるいイラストは避ける
- 左右または上下でテキストエリアとビジュアルエリアを分け、情報が整理された構成にする
- 画像内に記事タイトル「${title}」を、太字の日本語見出し用書体で大きく、背景と高いコントラストで配置する。遠目でも一瞬で読める視認性
- タイトル以外の余計な文字・ロゴ・透かし・不自然な日本語は入れない`;
  const response = await client.images.generate({ model: MODELS.image, prompt, size: MODELS.imageSize, n: 1 });
  return Buffer.from(response.data[0].b64_json, "base64");
}
