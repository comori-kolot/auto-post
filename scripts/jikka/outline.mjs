import OpenAI from "openai";
import { MODELS, SITE } from "./config.mjs";

const SCHEMA = {
  name: "article_outline",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "metaDescription", "introPoints", "sections", "closingPoint"],
    properties: {
      title: {
        type: "string",
        description:
          "記事タイトル。助詞を省略せず自然な日本語にする。比喩や煽りは使わない。「とは」を使う場合は『（テーマ）とは？（記事内で扱う具体的トピックA）や（トピックB）についても解説！』の形式にする。使わない場合は「費用」「注意点」「手順」「比較」「期限」などの共起語を自然に入れ、32文字前後にする。",
      },
      metaDescription: { type: "string", description: "meta description。120文字以内。読者の悩みと、読めば分かることを書く" },
      introPoints: {
        type: "array",
        items: { type: "string" },
        description: "導入文で触れる要点（読者の状況への共感1点＋この記事で分かること2〜3点）",
      },
      sections: {
        type: "array",
        description: "H2見出しは3〜5個。シンプルな見出しにする（例：〇〇とは、費用の目安、手順、注意点、比較）。「まとめ」は作らない",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["h2", "points", "format", "referenceUrls"],
          properties: {
            h2: { type: "string" },
            points: { type: "array", items: { type: "string" }, description: "このセクションで必ず書く内容（数字・条件・手順など具体的に）" },
            format: { type: "string", enum: ["table", "list", "steps", "text"], description: "主に使う表現。比較・費用・条件は table、手順は steps、チェック項目は list" },
            referenceUrls: { type: "array", items: { type: "string" }, description: "このセクションの根拠として引用する参照URL（提供されたものだけ。無ければ空配列）" },
          },
        },
      },
      closingPoint: { type: "string", description: "記事の締めの一言（次に取るべき行動を1つ）" },
    },
  },
};

export async function buildOutline({ keyword, group, research, sources, apiKey }) {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: MODELS.article,
    messages: [
      {
        role: "system",
        content: `あなたは${SITE.name}の編集者です。読者は「${SITE.reader}」。検索意図に過不足なく答える、シンプルな記事構成を作ります。
ルール:
- 見出しはH2のみ3〜5個。上位ページに共通して出る見出しを必ず押さえたうえで、上位ページで説明が薄い点（gaps）を1つ以上入れて独自性を出す
- 見出し文言は共起語（とは・費用・注意点・手順・比較・期限・メリット・デメリット）を自然に使った、短く分かりやすい形にする
- 比喩・造語・煽りは使わない。「出口」「入口」「地図」「ゴール」「落とし穴」「壁」「鍵」などの言い換えは禁止。見出しは、何が書いてあるかが一目で分かる平易な言葉にする（例：「売却・解体・賃貸の比較」）
- 形式的な見出し（「まとめ」「はじめに」）は作らない
- 法律・税金・制度に関するセクションには、必ず提供された公的機関のURLを割り当てる。提供されたURL以外は絶対に使わない`,
      },
      {
        role: "user",
        content: `キーワード: ${keyword}
分類: ${group}
検索意図: ${research.searchIntent}
上位ページの見出し:
${research.competitors.map((c) => `- ${c.title}\n  ${c.headings.join(" / ")}`).join("\n")}
共起語: ${research.cooccurrence.join("、")}
上位ページで薄い点: ${research.gaps.join(" / ")}
引用できる参照URL:
${sources.map((s) => `- [${s.kind}] ${s.publisher}「${s.title}」 ${s.url}（${s.usedFor}）`).join("\n")}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: SCHEMA },
  });
  return JSON.parse(completion.choices[0].message.content);
}
