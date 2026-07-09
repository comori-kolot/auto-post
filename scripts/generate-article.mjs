import OpenAI from "openai";
import { SITE_CONTEXT, ARTICLE_MODEL } from "./config.mjs";

const ARTICLE_SCHEMA = {
  name: "seo_article",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "記事タイトル（32文字前後、キーワードを含む）" },
      metaDescription: { type: "string", description: "meta description（120文字以内）" },
      slug: { type: "string", description: "英数字とハイフンのみのURLスラッグ" },
      contentHtml: {
        type: "string",
        description:
          "WordPress投稿本文。<h2>/<h3>見出しと<p>段落を用いたHTML。1500文字以上、装飾的な前置きや結びの挨拶文は不要。",
      },
    },
    required: ["title", "metaDescription", "slug", "contentHtml"],
    additionalProperties: false,
  },
};

export async function generateArticle({ keyword, apiKey }) {
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: ARTICLE_MODEL,
    messages: [
      {
        role: "system",
        content: `あなたは${SITE_CONTEXT.siteName}のSEOコンテンツライターです。${SITE_CONTEXT.business} 文体: ${SITE_CONTEXT.tone}`,
      },
      {
        role: "user",
        content: `キーワード「${keyword}」で検索意図を満たすSEO記事を作成してください。読者が実務で使える具体例・チェックリスト・手順を含めてください。`,
      },
    ],
    response_format: { type: "json_schema", json_schema: ARTICLE_SCHEMA },
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  return parsed;
}
