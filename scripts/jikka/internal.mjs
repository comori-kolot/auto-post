// 既存の公開記事から、今回の記事に関連するものを選び、本文中で紹介できるようにする
import { SITE } from "./config.mjs";

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

export async function fetchPublishedPosts() {
  const base = (process.env.WP_URL || SITE.url).replace(/\/$/, "");
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish&_fields=id,title,link,excerpt,slug`);
    if (!res.ok) break;
    const rows = await res.json();
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: decodeEntities(p.title.rendered),
    url: p.link,
    excerpt: decodeEntities(p.excerpt.rendered.replace(/<[^>]+>/g, "")).slice(0, 90),
  }));
}

const grams = (s, n = 2) => {
  const t = s.normalize("NFKC").replace(/[\s　・、。！？「」『』（）()\-｜|]/g, "");
  const out = new Set();
  for (let i = 0; i <= t.length - n; i++) out.add(t.slice(i, i + n));
  return out;
};

// このメディアの話題の言葉。タイトルにこれらを含む記事だけを候補にする（木材業界の集客などの古い記事は除く）
const TOPIC_TERMS = ["相続", "山林", "農地", "空き家", "空家", "実家", "登記", "売却", "解体", "固定資産税", "放棄", "国庫", "遺品", "片付け", "墓", "土地", "測量", "境界", "共有", "名義", "遺産", "遺言"];

// タイトルの話題の言葉と、記事のキーワード・見出しの言葉の重なりで、関連しそうな記事を絞る（最終判断は本文を書くAIに任せる）
export async function internalCandidates({ keyword, group, outline, excludeSlug, limit = 18 }) {
  const posts = await fetchPublishedPosts();
  const queryText = [keyword, group, outline.title, ...outline.sections.map((s) => s.h2)].join(" ").normalize("NFKC");
  const scored = posts
    .filter((p) => p.slug !== excludeSlug)
    .map((p) => {
      const title = p.title.normalize("NFKC");
      const topicHits = TOPIC_TERMS.filter((t) => title.includes(t));
      const shared = topicHits.filter((t) => queryText.includes(t)).length;
      return { ...p, score: topicHits.length ? shared * 3 + topicHits.length : 0 };
    })
    .filter((p) => p.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}
