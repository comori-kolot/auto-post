// 効果検証の自動集計。Search Console の数字を、スプレッドシートの「効果検証」系タブに書き込む（読み取りと書き込みだけ。AIは使わない・費用ゼロ）
//   node --env-file=.env scripts/jikka/track.mjs
// 毎週月曜に GitHub Actions から実行する（.github/workflows/jikka-track.yml）
import { google } from "googleapis";
import { SHEET_ID } from "./config.mjs";
import { readKeywordRows } from "./sheets.mjs";

const SITE = "https://greeen-biz.com/";
const TAB_SUMMARY = "効果検証シート";
const TAB_PAGES = "効果検証_記事別";
const TAB_KW = "効果検証_KW別";

function getAuth() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/webmasters.readonly"];
  if (process.env.GOOGLE_SA_KEY_B64) return new google.auth.GoogleAuth({ credentials: JSON.parse(Buffer.from(process.env.GOOGLE_SA_KEY_B64, "base64").toString("utf8")), scopes });
  if (process.env.GOOGLE_SA_KEY_JSON) return new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_SA_KEY_JSON), scopes });
  if (process.env.GOOGLE_SA_KEY_FILE) return new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_SA_KEY_FILE, scopes });
  throw new Error("GOOGLE_SA_KEY_FILE / GOOGLE_SA_KEY_JSON / GOOGLE_SA_KEY_B64 のいずれかが必要です");
}
const auth = getAuth();
const sheets = google.sheets({ version: "v4", auth });
const sc = google.searchconsole({ version: "v1", auth });

const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const jstToday = ymd(Date.now() + 9 * 3600 * 1000);
const dayBefore = (n) => ymd(Date.now() + 9 * 3600 * 1000 - n * 86400000);
const norm = (s) => String(s).normalize("NFKC").replace(/\s+/g, "");

// 系統の分け方（スラッグで判定）
export function clusterOf(slug) {
  if (/^(jikka|isan-|kaeru|oya-|ie-jimai|akiya|souzoku|shokibo|inaka|kanri-fuzen)/.test(slug)) return "実家じまい系";
  if (/forest|mountain|farmland|agricultural|land|sanrin|kokko|urbanization|inheritance/.test(slug)) return "山林・農地系";
  return "その他";
}

async function livePosts() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${SITE}wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish&_fields=id,slug,link,date,title`);
    if (!r.ok) break;
    const rows = await r.json();
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out.map((p) => ({ slug: p.slug, url: p.link, date: p.date.slice(0, 10), title: p.title.rendered.replace(/&#8211;|&amp;/g, "-") }));
}

const gsc = async (startDate, endDate, dimensions, rowLimit = 5000) =>
  (await sc.searchanalytics.query({ siteUrl: SITE, requestBody: { startDate, endDate, dimensions, rowLimit } })).data.rows || [];

const sum = (rows) => rows.reduce((a, r) => ({ imp: a.imp + r.impressions, clk: a.clk + r.clicks, pos: a.pos + r.position * r.impressions }), { imp: 0, clk: 0, pos: 0 });
const avgPos = (s) => (s.imp ? Math.round((s.pos / s.imp) * 10) / 10 : "");

async function ensureTab(title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets(properties(sheetId,title))" });
  if (!meta.data.sheets.some((s) => s.properties.title === title)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  }
}
const getVals = async (range) => (await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range, valueRenderOption: "UNFORMATTED_VALUE" })).data.values || [];
const putVals = (range, values) => sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range, valueInputOption: "RAW", requestBody: { values } });

async function main() {
  for (const t of [TAB_SUMMARY, TAB_PAGES, TAB_KW]) await ensureTab(t);

  const posts = await livePosts();
  const byUrl = new Map(posts.map((p) => [p.url.replace(/\/?$/, "/"), p]));
  const end = dayBefore(3); // Search Console は2〜3日遅れで確定する
  const w1 = [dayBefore(9), end]; // 直近7日
  const w0 = [dayBefore(16), dayBefore(10)]; // その前の7日
  const m1 = [dayBefore(30), end]; // 直近28日

  const [pg7, pg7prev, pg28, q7, q28, qpg28] = await Promise.all([
    gsc(...w1, ["page"]),
    gsc(...w0, ["page"]),
    gsc(...m1, ["page"]),
    gsc(...w1, ["query"]),
    gsc(...m1, ["query"]),
    gsc(...m1, ["page", "query"]),
  ]);

  const live = (rows) => rows.filter((r) => byUrl.has(r.keys[0].replace(/\/?$/, "/")));
  const inCluster = (rows, c) => rows.filter((r) => clusterOf(byUrl.get(r.keys[0].replace(/\/?$/, "/")).slug) === c);
  const L7 = live(pg7);

  // --- 週次サマリー（効果検証シート）---
  const row = [
    jstToday,
    `${w1[0]}〜${w1[1]}`,
    ...[sum(L7), sum(inCluster(L7, "実家じまい系")), sum(inCluster(L7, "山林・農地系")), sum(inCluster(L7, "その他"))].flatMap((s) => [s.imp, s.clk, avgPos(s)]),
    Math.round((sum(inCluster(L7, "実家じまい系")).imp / 7) * 10) / 10,
    posts.filter((p) => clusterOf(p.slug) === "実家じまい系").length,
    posts.length,
  ];
  const HEADER_ROW = 11;
  const header = [
    "集計日", "集計期間(7日)",
    "全体 表示", "全体 クリック", "全体 平均順位",
    "実家じまい系 表示", "実家じまい系 クリック", "実家じまい系 平均順位",
    "山林・農地系 表示", "山林・農地系 クリック", "山林・農地系 平均順位",
    "その他 表示", "その他 クリック", "その他 平均順位",
    "実家じまい系 1日平均表示", "実家じまい系 記事数", "全記事数",
  ];
  await putVals(`'${TAB_SUMMARY}'!A${HEADER_ROW}`, [header]);
  const existing = await getVals(`'${TAB_SUMMARY}'!A${HEADER_ROW + 1}:A200`);
  let next = HEADER_ROW + 1 + existing.filter((r) => r[0] !== undefined && r[0] !== "").length;
  if (existing.length && existing[existing.length - 1][0] === jstToday) next -= 1; // 同じ日に再実行したら上書き
  await putVals(`'${TAB_SUMMARY}'!A${next}`, [row]);

  // --- 記事別（毎回書き直し）---
  const prevMap = new Map(pg7prev.map((r) => [r.keys[0].replace(/\/?$/, "/"), r]));
  const m28 = new Map(pg28.map((r) => [r.keys[0].replace(/\/?$/, "/"), r]));
  const topQ = new Map();
  for (const r of qpg28.sort((a, b) => b.impressions - a.impressions)) {
    const k = r.keys[0].replace(/\/?$/, "/");
    topQ.set(k, [...(topQ.get(k) || []), `${r.keys[1]}(${r.position.toFixed(0)}位)`]);
  }
  const pageRows = posts
    .map((p) => {
      const k = p.url.replace(/\/?$/, "/");
      const a = pg7.find((r) => r.keys[0].replace(/\/?$/, "/") === k);
      const b = prevMap.get(k);
      const c = m28.get(k);
      return [
        p.title, p.url, clusterOf(p.slug), p.date,
        a ? a.impressions : 0, a ? a.clicks : 0, a ? Math.round(a.position * 10) / 10 : "",
        b ? b.impressions : 0,
        c ? c.impressions : 0, c ? c.clicks : 0, c ? Math.round(c.position * 10) / 10 : "",
        (topQ.get(k) || []).slice(0, 3).join(" / "),
      ];
    })
    .sort((a, b) => (a[2] === b[2] ? b[8] - a[8] : a[2] === "実家じまい系" ? -1 : b[2] === "実家じまい系" ? 1 : a[2] === "山林・農地系" ? -1 : 1));
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${TAB_PAGES}'!A1:Z400` });
  await putVals(`'${TAB_PAGES}'!A1`, [
    [`記事別の表示・クリック・順位（${jstToday} 集計。Search Console。毎週自動で書き直し）`],
    ["記事", "URL", "系統", "公開日", "直近7日 表示", "直近7日 クリック", "直近7日 平均順位", "その前7日 表示", "28日 表示", "28日 クリック", "28日 平均順位", "主な検索語(28日・順位)"],
    ...pageRows,
  ]);

  // --- KW別（毎週追記）---
  const kwRows = (await readKeywordRows()).filter((r) => r.status === "公開済");
  const watch = ["実家じまい", "実家じまい費用", "実家じまい手順", "実家の片付け", "実家 売却", "山林売却", "山林相続"];
  const kws = [...new Set([...kwRows.map((r) => r.keyword), ...watch])];
  const q7m = new Map(), q28m = new Map();
  const add = (m, rows) => rows.forEach((r) => { const k = norm(r.keys[0]); const o = m.get(k) || { imp: 0, clk: 0, pos: 0, best: 999 }; o.imp += r.impressions; o.clk += r.clicks; o.pos += r.position * r.impressions; o.best = Math.min(o.best, r.position); m.set(k, o); });
  add(q7m, q7); add(q28m, q28);
  const bestUrl = new Map();
  for (const r of qpg28.sort((a, b) => b.impressions - a.impressions)) { const k = norm(r.keys[1]); if (!bestUrl.has(k)) bestUrl.set(k, r.keys[0].replace(SITE, "/")); }
  const kwOut = kws.map((kw) => {
    const a = q7m.get(norm(kw)), b = q28m.get(norm(kw));
    return [jstToday, kw, a ? a.imp : 0, a ? a.clk : 0, a ? avgPos(a) : "", b ? b.imp : 0, b ? b.clk : 0, b ? avgPos(b) : "", b ? Math.round(b.best * 10) / 10 : "", bestUrl.get(norm(kw)) || ""];
  });
  const kwHead = [["集計日", "キーワード", "7日 表示", "7日 クリック", "7日 平均順位", "28日 表示", "28日 クリック", "28日 平均順位", "28日 最良順位", "主に表示されたページ"]];
  const kwExisting = await getVals(`'${TAB_KW}'!A1:A5000`);
  if (!kwExisting.length) await putVals(`'${TAB_KW}'!A1`, kwHead);
  const already = kwExisting.some((r) => r[0] === jstToday);
  if (!already) {
    const start = Math.max(kwExisting.length, 1) + 1;
    await putVals(`'${TAB_KW}'!A${start}`, kwOut);
  }

  // --- 目標（効果検証シート上部。毎回書き直し）---
  const costKw = q28m.get(norm("実家じまい費用"));
  const jikka7 = sum(inCluster(L7, "実家じまい系")).imp / 7;
  await putVals(`'${TAB_SUMMARY}'!A1`, [
    ["効果検証シート（Search Console の数字を毎週月曜に自動集計。AI・費用なし）"],
    [`最終更新: ${jstToday} / 集計期間: ${w1[0]}〜${w1[1]}（Search Console は2〜3日遅れで確定）`],
    [],
    ["目標", "基準", "期限", "現在値", "判定"],
    ["「実家じまい費用」の順位（28日間の平均順位。「実家じまい 費用」の表記ゆれを含む）", "10位以内（表示10回以上で判定）", "2026-11-15", costKw && costKw.imp ? `${avgPos(costKw)}位（表示${costKw.imp}回）` : "表示なし", costKw && costKw.imp >= 10 && avgPos(costKw) <= 10 ? "達成" : costKw && costKw.imp < 10 ? "未達（表示が少なく判定できない）" : "未達"],
    ["実家じまい系の1日あたり表示回数", "100回以上", "2026-12-15", Math.round(jikka7 * 10) / 10, jikka7 >= 100 ? "達成" : "未達"],
    [],
    ["見方: 下の表は週ごとに1行ずつ増えます。記事ごとの数字は「効果検証_記事別」、キーワードごとの順位は「効果検証_KW別」にあります。"],
  ]);
  console.log(`集計完了 ${jstToday}: 全体 表示${row[2]} / クリック${row[3]}、実家じまい系 表示${row[5]} 1日平均${row[14]}、記事${posts.length}本、KW${kws.length}語`);
}

main().catch((e) => {
  console.error("[track] エラー:", e.stack || e.message);
  process.exit(1);
});
