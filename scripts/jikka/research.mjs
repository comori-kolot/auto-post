import OpenAI from "openai";
import { MODELS } from "./config.mjs";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["searchIntent", "competitors", "cooccurrence", "authoritativeSources", "gaps"],
  properties: {
    searchIntent: { type: "string", description: "このキーワードで検索する人が知りたいこと（1〜2文）" },
    competitors: {
      type: "array",
      description: "検索上位の競合ページ（最大6件）",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "headings"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          headings: { type: "array", items: { type: "string" }, description: "そのページのH2見出し" },
        },
      },
    },
    cooccurrence: {
      type: "array",
      items: { type: "string" },
      description: "上位ページの見出し・タイトルに頻出する共起語（例：とは、注意点、費用、比較、手順、期限）",
    },
    authoritativeSources: {
      type: "array",
      description: "記事の根拠として引用できる公的・専門家サイト（最大8件）。検索結果で実在を確認できたURLのみ",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "publisher", "kind", "usedFor"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          publisher: { type: "string" },
          kind: { type: "string", enum: ["government", "law_office", "administrative_scrivener", "tax_accountant", "other"] },
          usedFor: { type: "string", description: "記事のどの説明の根拠にできるか" },
        },
      },
    },
    gaps: { type: "array", items: { type: "string" }, description: "上位ページで説明が薄い・足りない点（独自性を出せる切り口）" },
  },
};

export async function researchKeyword({ keyword, group, apiKey }) {
  const client = new OpenAI({ apiKey });
  const resp = await client.responses.create({
    model: MODELS.research,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content:
          "あなたは日本語SEOのリサーチャーです。必ずWeb検索を使い、日本のGoogle検索で上位に出るページを実際に確認してから回答します。見ていないページや、検索結果に出ていないURLを書いてはいけません。URLは検索結果に出たものを一字一句そのまま使います。",
      },
      {
        role: "user",
        content: `キーワード「${keyword}」（分類: ${group || "実家じまい"}）を調べてください。
1. 検索上位ページ（最大6件）のタイトル・URL・H2見出し
2. 見出し・タイトルに頻出する共起語（とは／注意点／費用／比較／手順／期限など）
3. 記事の根拠として引用できる公的・専門家のページ（最大8件）。優先順位は、官公庁・自治体・公的機関（法務省、国税庁、国土交通省、林野庁、農林水産省、裁判所、法務局、日本司法書士会連合会など）→ 法律事務所・行政書士事務所・税理士事務所の解説ページ（補足）。民間の不動産会社や一括査定サイトは含めない。
4. 上位ページで説明が薄い点（独自性を出せる切り口）
法律・税金・制度に関するキーワードは、必ず官公庁の一次情報を含めてください。`,
      },
    ],
    text: { format: { type: "json_schema", name: "keyword_research", strict: true, schema: SCHEMA } },
  });

  const text = resp.output_text;
  const data = JSON.parse(text);

  // 検索で実際に参照されたURL（引用）
  const cited = new Set();
  for (const item of resp.output || []) {
    if (item.type !== "message") continue;
    for (const c of item.content || []) {
      for (const a of c.annotations || []) {
        if (a.type === "url_citation" && a.url) cited.add(a.url.split("#")[0].replace(/\?utm_[^#]*$/, ""));
      }
    }
  }
  return { data, cited: [...cited] };
}

// URLが実際に開けるか確認する（官公庁はHEADを拒否することがあるのでGETで確認）
export async function verifyUrl(url) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; greeen-biz-linkcheck)" } });
    clearTimeout(timer);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

export async function verifySources(sources) {
  const clean = (u) => u.replace(/[?&](kktid_[^&#]*|utm_[^&#]*)/g, "").replace(/\?$/, "");
  const checked = await Promise.all(sources.map(async (s) => ({ ...s, url: clean(s.url), ok: await verifyUrl(clean(s.url)) })));
  return checked.filter((s) => s.ok);
}
