// 公開済みの記事に、「最終確認日」と「よくある質問」を後付けする（1回限りの作業用）
//   node --env-file=.env scripts/jikka/retrofit.mjs [--dry]
import OpenAI from "openai";
import { faqHtml, confirmDateHtml } from "./assemble.mjs";
import { MODELS } from "./config.mjs";

const dry = process.argv.includes("--dry");
const base = process.env.WP_URL;
const auth = "Basic " + Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const wp = async (m, p, b) => {
  const r = await fetch(`${base}/wp-json${p}`, { method: m, headers: { Authorization: auth, "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text();
  if (t.includes("SiteGuard")) throw new Error("WAF " + p);
  const j = JSON.parse(t);
  if (!r.ok) throw new Error(r.status + " " + t.slice(0, 200));
  return j;
};
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCHEMA = {
  name: "faq",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["faq"],
    properties: {
      faq: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["q", "a"], properties: { q: { type: "string" }, a: { type: "string" } } },
      },
    },
  },
};

const slugs = await (async () => {
  const out = [];
  for (let p = 1; p <= 3; p++) {
    const rows = await wp("GET", `/wp/v2/posts?per_page=100&page=${p}&status=publish&_fields=id,slug,date`);
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out.filter((r) => /^(jikka|ie-jimai|oya-jimai|kaeru)/.test(r.slug));
})();
console.log("対象:", slugs.length, "本", dry ? "(dry)" : "");

for (const s of slugs) {
  const post = await wp("GET", `/wp/v2/posts/${s.id}?context=edit&_fields=content,title`);
  let html = post.content.raw;
  const has = { date: html.includes("最終確認日"), faq: html.includes("data-gb-faq") };
  if (has.date && has.faq) { console.log("skip", s.slug); continue; }
  if (!has.faq) {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 9000);
    const r = await client.chat.completions.create({
      model: MODELS.article,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: "記事の内容から「よくある質問」を3〜5問作る。Qは読者が検索しそうな自然な疑問文。Aは2〜3文で、記事の本文に書かれている内容だけで答える（書かれていない事実・数字は足さない）。比喩・造語は使わない。" },
        { role: "user", content: `タイトル: ${post.title.raw}\n\n本文:\n${text}` },
      ],
      response_format: { type: "json_schema", json_schema: SCHEMA },
    });
    const faq = JSON.parse(r.choices[0].message.content).faq;
    const block = faqHtml(faq);
    const i = html.lastIndexOf('<div class="gb-cta-box"');
    html = i >= 0 ? html.slice(0, i) + block + "\n\n" + html.slice(i) : html + "\n\n" + block;
    console.log(s.slug, "FAQ", faq.length, "問:", faq.map((f) => f.q).slice(0, 2).join(" / "));
  }
  if (!has.date) {
    const d = new Date(s.date);
    html = confirmDateHtml(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`) + "\n\n" + html;
  }
  if (!dry) await wp("POST", `/wp/v2/posts/${s.id}`, { content: html });
}
console.log("完了");
