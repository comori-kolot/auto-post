// 公開済みの記事どうしを、「あわせて読みたい」ブロックで相互にリンクする（AIは使わない・費用ゼロ）
//   node --env-file=.env scripts/jikka/related.mjs          計画だけ表示（記事は変更しない）
//   node --env-file=.env scripts/jikka/related.mjs --apply  公開済み記事に反映
// 記事の公開後に run.mjs からも呼ばれる。新しい記事への内部リンクが、古い記事から自動で張られる。
import { pathToFileURL } from "node:url";

const SITE = "https://greeen-biz.com/";
const MARK = 'data-gb-related="1"';
const BLOCK_RE = /<div data-gb-related="1"[\s\S]*?<\/ul>\s*<\/div>/;
const MAX_PER_POST = 4;
const MIN_INBOUND = 5; // 被リンクがこの数に届かない記事を優先して紹介する
// 内部リンクを集約したい記事（実家じまい系のすべての記事の「あわせて読みたい」で、最初に紹介する）
const PINNED = ["jikka-jimai-shippai"];

const TOPIC = ["相続", "山林", "農地", "空き家", "空家", "実家", "登記", "売却", "解体", "固定資産税", "放棄", "国庫", "遺品", "片付け", "墓", "土地", "測量", "境界", "共有", "名義", "遺産", "遺言"];
const SPECIFIC = ["費用", "相場", "手順", "補助金", "業者", "失敗", "トラブル", "兄弟", "寂しい", "処分", "後悔", "税金", "期限", "お金がない", "うんざり", "仏壇", "買取", "無料", "0円", "譲渡", "放置", "管理", "測量", "境界", "売れない"];

function clusterOf(slug) {
  if (/^(jikka|isan-|kaeru|oya-|ie-jimai|akiya|souzoku|shokibo|inaka|kanri-fuzen)/.test(slug)) return "jikka";
  if (/forest|mountain|farmland|agricultural|land|sanrin|kokko|urbanization|inheritance/.test(slug)) return "sanrin";
  return "other";
}

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const nfkc = (s) => s.normalize("NFKC");
const grams = (s) => {
  const t = nfkc(s).replace(/[\s　・、。！？「」『』（）()\-｜|【】]/g, "");
  const o = new Set();
  for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2));
  return o;
};

function score(a, b) {
  const ta = nfkc(a.title), tb = nfkc(b.title);
  const topic = TOPIC.filter((t) => ta.includes(t) && tb.includes(t)).length;
  const spec = SPECIFIC.filter((t) => ta.includes(t) && tb.includes(t)).length;
  const ga = grams(a.title), gb = grams(b.title);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const sim = inter / Math.max(1, Math.min(ga.size, gb.size));
  // 系統が違う記事（実家じまい⇔山林）は、共通の話題の言葉が2つ以上あるときだけ候補にする
  if (clusterOf(a.slug) !== clusterOf(b.slug) && topic < 2) return 0;
  if (topic === 0) return 0;
  return topic * 3 + spec * 2 + Math.round(sim * 6);
}

const auth = () => "Basic " + Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const base = () => (process.env.WP_URL || SITE).replace(/\/$/, "");
async function wp(path, init = {}) {
  const r = await fetch(`${base()}/wp-json${path}`, { ...init, headers: { Authorization: auth(), "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`WordPress ${path} が失敗しました: ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

async function fetchPosts() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    let rows;
    try { rows = await wp(`/wp/v2/posts?per_page=100&page=${page}&status=publish&context=edit&_fields=id,slug,link,title,content`); } catch { break; }
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out.map((p) => ({ id: p.id, slug: p.slug, url: p.link.replace(/\/?$/, "/"), title: decode(p.title.raw ?? p.title.rendered), raw: p.content.raw }));
}

export function relatedHtml(items) {
  const lis = items.map((p) => `<li style="padding:4px 0;line-height:1.7;"><a href="${p.url}">${p.title}</a></li>`).join("");
  return `<div ${MARK} style="border:1px solid #cfd9d3;border-radius:6px;padding:16px 20px;margin:28px 0;background:#f7faf8;"><p style="margin:0 0 8px;font-weight:700;color:#1f4d36;">あわせて読みたい</p><ul style="margin:0;padding-left:1.2em;">${lis}</ul></div>`;
}

function insertBlock(raw, html) {
  const clean = raw.replace(BLOCK_RE, "").replace(/\n{3,}/g, "\n\n");
  const faq = clean.search(/<div[^>]*data-gb-faq/);
  if (faq >= 0) return clean.slice(0, faq) + html + "\n\n" + clean.slice(faq);
  const cta = clean.lastIndexOf('<div class="gb-cta-box"');
  if (cta >= 0) return clean.slice(0, cta) + html + "\n\n" + clean.slice(cta);
  return clean + "\n\n" + html;
}

// 計画: 各記事に「あわせて読みたい」で紹介する記事を決める
export function plan(posts) {
  const pool = posts.filter((p) => clusterOf(p.slug) !== "other");
  const bodyOf = (p) => p.raw.replace(BLOCK_RE, "");
  const linkedInBody = (src, tgt) => bodyOf(src).includes(tgt.url) || bodyOf(src).includes(tgt.url.replace(/\/$/, ""));
  const inbound = new Map(pool.map((p) => [p.id, pool.filter((s) => s.id !== p.id && linkedInBody(s, p)).length]));
  const picks = new Map(pool.map((p) => [p.id, []]));
  const ok = (s, t) => s.id !== t.id && !linkedInBody(s, t) && !picks.get(s.id).some((x) => x.id === t.id) && picks.get(s.id).length < MAX_PER_POST && score(s, t) >= 4;

  // 0) 集約したい記事は、実家じまい系のすべての記事から、先頭で紹介する
  for (const slug of PINNED) {
    const t = pool.find((p) => p.slug === slug);
    if (!t) continue;
    for (const src of pool) {
      if (src.id === t.id || clusterOf(src.slug) !== "jikka" || linkedInBody(src, t) || picks.get(src.id).length >= MAX_PER_POST) continue;
      picks.get(src.id).push(t);
      inbound.set(t.id, inbound.get(t.id) + 1);
    }
  }
  // 1) 被リンクが少ない記事に、関連の強い記事から1〜3本ずつ張る
  const needy = [...pool].filter((p) => inbound.get(p.id) < MIN_INBOUND).sort((a, b) => inbound.get(a.id) - inbound.get(b.id));
  for (const t of needy) {
    const srcs = pool.filter((s) => ok(s, t)).sort((a, b) => score(b, t) - score(a, t));
    const want = Math.min(3, MIN_INBOUND - inbound.get(t.id));
    for (const s of srcs.slice(0, want)) { picks.get(s.id).push(t); inbound.set(t.id, inbound.get(t.id) + 1); }
  }
  // 2) 空いている枠を、関連の強い順に埋める
  for (const s of pool) {
    const cands = pool.filter((t) => ok(s, t)).sort((a, b) => score(s, b) - score(s, a) || inbound.get(a.id) - inbound.get(b.id));
    for (const t of cands) { if (picks.get(s.id).length >= 3) break; picks.get(s.id).push(t); inbound.set(t.id, inbound.get(t.id) + 1); }
  }
  return { pool, picks, inbound };
}

export async function refreshRelated({ apply = false, log = console.log } = {}) {
  const posts = await fetchPosts();
  const { pool, picks, inbound } = plan(posts);
  let changed = 0;
  for (const s of pool) {
    const items = picks.get(s.id);
    if (!items.length) continue;
    const next = insertBlock(s.raw, relatedHtml(items));
    if (next === s.raw) continue;
    changed++;
    log(`${s.slug} ← ${items.map((t) => t.slug).join(", ")}`);
    if (apply) await wp(`/wp/v2/posts/${s.id}`, { method: "POST", body: JSON.stringify({ content: next }) });
  }
  const low = pool.filter((p) => inbound.get(p.id) < 3).map((p) => `${p.slug}(${inbound.get(p.id)})`);
  log(`対象${pool.length}記事のうち${changed}記事に「あわせて読みたい」を${apply ? "反映" : "追加予定"}。被リンクが3本未満: ${low.join(", ") || "なし"}`);
  return { changed };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshRelated({ apply: process.argv.includes("--apply") }).catch((e) => { console.error(e.message); process.exit(1); });
}
