// 実家じまいメディア用の記事自動生成。使い方:
//   node --env-file=.env scripts/jikka/run.mjs                 次の「未着手」を1本、下書きで投稿
//   node --env-file=.env scripts/jikka/run.mjs --slug jikka-jimai --dry   投稿せず out/ に保存だけ
//   オプション: --status draft|publish  --row 3  --slug xxx  --dry  --image(dryでも画像を作る)
//              --update 投稿ID  既存の下書きを作り直した内容で更新（画像は作り直さない）
import fs from "node:fs/promises";
import path from "node:path";
import { pickNextRow, markRow, readAffiliates, writeNote } from "./sheets.mjs";
import { researchKeyword, verifySources } from "./research.mjs";
import { buildOutline } from "./outline.mjs";
import { writeArticle } from "./write.mjs";
import { buildCtas, rebuildTemplateCtas } from "./cta.mjs";
import { assemble, sanitizeLinks, lint } from "./assemble.mjs";
import { generateEyecatch } from "./image.mjs";
import { uploadImage, createPost } from "./publish.mjs";
import { categoryIdsFor } from "./config.mjs";
import { internalCandidates } from "./internal.mjs";
import { polishBody, findBanned } from "./polish.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function need(name) {
  if (!process.env[name]) throw new Error(`環境変数 ${name} が設定されていません`);
  return process.env[name];
}

const todayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "/");
let stage = "開始";
const log = (m) => {
  if (m.startsWith("1/6") || m.startsWith("2/6") || m.startsWith("3/6") || m.startsWith("4/6") || m.startsWith("5/6") || m.startsWith("6/6")) stage = m;
  console.log(`[jikka] ${m}`);
};
const errText = (e) => [e.message, e.status && `status=${e.status}`, e.code && `code=${e.code}`, e.error && e.error.message].filter(Boolean).join(" | ");

async function main() {
  const apiKey = need("OPENAI_API_KEY");
  const dry = flag("dry");
  const status = opt("status") || "draft";
  if (!dry) {
    need("WP_URL");
    need("WP_USERNAME");
    need("WP_APP_PASSWORD");
  }

  const row = await pickNextRow({ slug: opt("slug"), rowNumber: opt("row") });
  if (!row) throw new Error("対象の行が見つかりません（「未着手」の記事が無い、または指定のスラッグ/行が無い）");
  log(`対象: 行${row.rowNumber} / ${row.keyword} / ${row.slug} / 分類=${row.group}`);

  const outDir = path.join("out", row.slug);
  await fs.mkdir(outDir, { recursive: true });
  const save = (name, data) => fs.writeFile(path.join(outDir, name), typeof data === "string" ? data : JSON.stringify(data, null, 2));

  // 更新モード（--update）のときは、すでに公開済みの行の状態・完了日を変えない
  if (!dry && !opt("update")) await markRow(row.rowNumber, "執筆中", "");

  try {
    const readJson = async (n) => JSON.parse(await fs.readFile(path.join(outDir, n), "utf8"));
    let sources, outline, body, ctas, internal = [];
    if (flag("reuse") || flag("redo-cta") || flag("cta-only")) {
      log("--reuse: 保存済みのリサーチ・本文・CVコピーを使い、HTMLだけ組み直します（AI生成なし）");
      ({ sources } = await readJson("research.json"));
      outline = await readJson("outline.json");
      body = await readJson("body.json");
      ctas = await readJson("ctas.json");
      internal = await readJson("internal.json").catch(() => []);
      if (flag("redo-cta") || flag("cta-only")) {
        log("--redo-cta / --cta-only: 本文はそのまま、CVコピーだけやり直します");
        if (flag("redo-cta")) {
          body = await polishBody({ body, apiKey, log });
          await save("body.json", body);
        }
        const affiliates = await readAffiliates();
        // 運営者の型を使った保存済みCTAは、AIを使わず（費用ゼロで）組み直す
        const rebuilt = flag("cta-only") && !flag("reselect") ? rebuildTemplateCtas(ctas, row.keyword, affiliates) : null;
        if (rebuilt) {
          ctas = rebuilt;
          log(`  運営者のCTA案をAIなしで組み直しました → ${ctas.slots.intro.headline}`);
        } else {
          ctas = await buildCtas({ keyword: row.keyword, outline, body, affiliates, apiKey, log });
        }
        await save("ctas.json", ctas);
      }
    } else {
      log("1/6 競合・共起語・参照元をリサーチ（Web検索）");
      let research;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          ({ data: research } = await researchKeyword({ keyword: row.keyword, group: row.group, apiKey }));
          break;
        } catch (e) {
          log(`  リサーチに失敗（${attempt}/3回目）: ${errText(e)}`);
          if (attempt === 3) throw e;
          await new Promise((r) => setTimeout(r, 15000));
        }
      }
      sources = await verifySources(research.authoritativeSources);
      log(`  競合${research.competitors.length}件 / 参照元 ${sources.length}/${research.authoritativeSources.length}件が実在確認OK`);
      await save("research.json", { research, sources });

      log("2/6 見出し構成を作成");
      outline = await buildOutline({ keyword: row.keyword, group: row.group, research, sources, apiKey });
      await save("outline.json", outline);
      log(`  タイトル: ${outline.title}`);
      log(`  H2: ${outline.sections.map((s) => s.h2).join(" / ")}`);

      internal = await internalCandidates({ keyword: row.keyword, group: row.group, outline, excludeSlug: row.slug });
      log(`  内部リンク候補: ${internal.length}件`);
      await save("internal.json", internal);

      log("3/6 本文を作成");
      body = await writeArticle({ keyword: row.keyword, outline, sources, internal, apiKey });
      log("  AIっぽい表現・造語・比喩を校正");
      body = await polishBody({ body, apiKey, log });
      const left = findBanned(body);
      if (left.length) log(`  要確認語が残っています: ${left.join("、")}`);
      await save("body.json", body);

      log("4/6 CVコピーを作成（A8リンクシートを参照）");
      const affiliates = await readAffiliates();
      log(`  A8リンク: ${affiliates.length}件`);
      ctas = await buildCtas({ keyword: row.keyword, outline, body, affiliates, apiKey, log });
      log(`  採用案件: ${ctas.affiliate ? ctas.affiliate.name : "なし（お問い合わせへの導線）"}`);
      await save("ctas.json", ctas);
    }

    log("5/6 記事を組み立て・リンクを検証");
    const html0 = assemble({ body, ctas });
    const allowed = [...sources.map((s) => s.url), ...internal.map((p) => p.url), ...(ctas.affiliate ? [ctas.affiliate.url] : [])];
    const { html, removed } = sanitizeLinks(html0, allowed);
    if (removed.length) log(`  未確認のURLのリンクを外しました: ${removed.join(", ")}`);
    const report = lint(html);
    log(`  文字数=${report.chars} 表=${report.tables} リスト=${report.lists} 囲み枠=${report.boxes} マーカー=${report.marks} 「！」=${report.bangs} 外部リンク=${report.externalLinks} 要確認語=${report.banned.join("、") || "なし"}`);
    await save("article.html", html);
    await save("meta.json", { title: outline.title, metaDescription: outline.metaDescription, slug: row.slug, report, removedLinks: removed });

    let mediaId;
    const updateId = opt("update");
    if ((!dry || flag("image")) && !updateId && !flag("reuse") && !flag("redo-cta") && !flag("cta-only")) {
      log("6/6 アイキャッチ画像を作成");
      const img = await generateEyecatch({ title: outline.title, keyword: row.keyword, apiKey });
      await fs.writeFile(path.join(outDir, "eyecatch.png"), img);
      if (!dry) mediaId = (await uploadImage({ buffer: img, slug: row.slug })).id;
    }

    if (dry) {
      log(`dry-run完了。確認用: ${path.join(outDir, "article.html")}`);
      return;
    }

    const post = await createPost({
      title: outline.title,
      contentHtml: html,
      metaDescription: outline.metaDescription,
      slug: row.slug,
      categoryIds: categoryIdsFor(row.group, row.slug),
      mediaId,
      status,
      postId: updateId,
    });
    log(`WordPressに${status === "publish" ? "公開" : "下書き保存"}しました: ${post.link}`);
    if (!opt("update")) await markRow(row.rowNumber, status === "publish" ? "公開済" : "下書き確認待ち", todayJst());
    log("シートのステータスを更新しました");
  } catch (e) {
    console.error(`[jikka] 失敗した工程: ${stage}
${e.stack || e.message}`);
    if (!dry) {
      const jst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
      await writeNote(row.rowNumber, `${jst} [${stage}] ${errText(e)}`).catch(() => {});
    }
    if (!dry && !opt("update")) await markRow(row.rowNumber, "未着手", "").catch(() => {});
    throw e;
  }
}

main().catch((e) => {
  console.error("[jikka] エラー:", e.message);
  process.exit(1);
});
