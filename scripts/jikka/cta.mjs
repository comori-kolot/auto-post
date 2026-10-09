import OpenAI from "openai";
import { MODELS, SITE } from "./config.mjs";
import { researchLanding, actionsFromReward } from "./landing.mjs";

// ============ CTAのHTML（ボタン型） ============
const C = { green: "#1f4d36", btn: "#c2571a", btnShadow: "#8f3f12" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function ctaHtml({ headline, sub, bullets = [], button, buttonNote = "", micro, url, sponsored }) {
  const rel = sponsored ? "nofollow sponsored noopener" : "noopener";
  const target = sponsored ? ' target="_blank"' : "";
  const list = bullets.length
    ? `<ul style="margin:0 0 18px;padding:0;list-style:none;">${bullets
        .map((b) => `<li style="padding:3px 0 3px 1.7em;position:relative;line-height:1.7;"><span style="position:absolute;left:0;color:${C.green};font-weight:700;">✔</span>${esc(b)}</li>`)
        .join("")}</ul>`
    : "";
  const microHtml = micro ? `<p style="margin:10px 0 0;text-align:center;font-size:12px;color:#5a5a56;">${esc(micro)}</p>` : "";
  return (
    `<div class="gb-cta-box" style="border:2px solid ${C.green};border-radius:6px;padding:22px 22px 20px;margin:40px 0;background:#f6faf7;">` +
    `<p style="margin:0 0 8px;font-size:1.2em;font-weight:700;line-height:1.6;color:#1a1a1a;">${esc(headline)}</p>` +
    (sub ? `<p style="margin:0 0 14px;line-height:1.8;">${esc(sub)}</p>` : "") +
    list +
    `<p style="margin:0;text-align:center;"><a href="${esc(url)}"${target} rel="${rel}" style="display:block;max-width:440px;margin:0 auto;background:${C.btn};color:#fff;padding:16px 20px;border-radius:4px;font-weight:700;font-size:1.05em;text-decoration:none;box-shadow:0 3px 0 ${C.btnShadow};">${esc(button)}${buttonNote ? `<span style="font-size:0.8em;font-weight:400;"> ${esc(buttonNote)}</span>` : ""}　＞</a></p>` +
    microHtml +
    `</div>`
  );
}

// 案件が無い・合わない・審査を通らない場合の、お問い合わせへの導線（誇張は書かない）
const FALLBACK = {
  intro: { headline: "実家や土地の手続きで、何から始めるか迷っていませんか？", sub: "この記事の内容が自分のケースに当てはまるか迷ったら、先に状況を整理しませんか。", bullets: [], button: "状況を相談する" },
  mid: { headline: "ここまでの内容を、自分のケースに当てはめるには？", sub: "個別の事情を踏まえて、何から手をつけるかを一緒に整理します。", bullets: [], button: "お問い合わせフォームへ" },
  end: { headline: "手続きの順番で迷ったら、まず状況の整理から", sub: "実家じまいは、順番を間違えると手戻りが出やすい分野です。", bullets: [], button: "相談する" },
};

export function fallbackCtas() {
  return { affiliate: null, slots: Object.fromEntries(Object.entries(FALLBACK).map(([k, v]) => [k, { ...v, url: SITE.contactUrl, sponsored: false }])) };
}

// ============ 事実ガード（機械チェック） ============
const norm = (s) => String(s).normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const CLAIM_WORDS = ["無料", "最短", "即日", "24時間", "オンライン", "満足度", "全国", "顧問"];
const ALWAYS_BAN = ["no.1", "ナンバーワン", "圧倒的", "業界最大", "業界初", "日本一", "唯一"]; // 優良誤認になりやすい最上級表現
// 古い調査時点・実績の数字（注記が必要で、逆効果になる）は使わない
const BAN_PATTERN = /20\d\d年|\d{1,2}月時点|時点|自社調べ|当社調べ|調査/;

const METAPHOR = ["出口", "入口", "道筋", "道しるべ", "地図", "ゴール", "羅針盤", "落とし穴", "土台", "橋渡し", "一歩踏み出"];

export function factViolation(text, sourceText, headline = "") {
  const t = norm(text);
  const s = norm(sourceText);
  if (headline && headline.length > 46) return `見出しが長すぎる（${headline.length}文字）`;
  if (headline && headline.length < 20) return `見出しが短い断片になっている（${headline.length}文字。文として言い切る）`;
  for (const w of METAPHOR) if (String(text).includes(w)) return `比喩・抽象語「${w}」は使わない`;
  for (const w of ALWAYS_BAN) if (t.includes(w)) return `最上級表現「${w}」は使わない`;
  const m = String(text).normalize("NFKC").match(BAN_PATTERN);
  if (m) return `実績・調査時点の表現「${m[0]}」は使わない`;
  for (const n of t.match(/\d[\d,.]*/g) || []) if (!s.includes(n)) return `数字「${n}」が広告主情報に無い`;
  for (const w of CLAIM_WORDS) if (t.includes(w) && !s.includes(w)) return `語「${w}」が広告主情報に無い`;
  return null;
}

const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function ask(client, schema, system, user, effort = "low") {
  const req = {
    model: MODELS.article,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_schema", json_schema: schema },
  };
  let r;
  try {
    // 費用を抑えるため推論は軽くする（CTAの文面は運営者の型をそのまま使うので、重い推論は不要）
    r = await client.chat.completions.create({ ...req, reasoning_effort: effort });
  } catch (e) {
    if (!/reasoning_effort|unsupported|unknown/i.test(String(e.message))) throw e;
    r = await client.chat.completions.create(req);
  }
  return JSON.parse(r.choices[0].message.content);
}

const SLOT_ROLE = {
  intro:
    "導入文の直後。読者はまだ読み始めたばかり。見出しは必ず疑問形の呼びかけにする：「（読者の状況）でお困りの方へ、（得られる結果）しませんか？」。例：「実家じまいで相続手続きにお困りの方へ、プロにまとめて相談しませんか？」。負担の小さい最初の一歩を示す",
  mid: "3つ目の見出しの終わり。ここまで読んで「全部自分でやるのは大変そうだ」と感じたタイミング。手間・時間・ミスの不安を、案件でどう減らせるかを示す",
  end: "記事の末尾。読み終えて迷いが残る読者の背中を押す。次にやることを1つに絞り、安心できる根拠（遷移先で確認できる事実）を添える",
};

const slotSchema = (extra = {}) => ({
  type: "object",
  additionalProperties: false,
  required: ["headline", "sub", "bullets", "button", "micro"],
  properties: {
    headline: { type: "string", description: "見出し。全角36文字以内を目安。読者の状況と、得られる結果が一文で伝わる自然な日本語" },
    sub: { type: "string", description: "補足。40〜80文字。headlineの理由・根拠を、事実で" },
    bullets: { type: "array", items: { type: "string" }, description: "利点2〜3個。各12〜30文字。読者が得るもの、または安心して頼める根拠のみ" },
    button: { type: "string", description: "ボタン文言。8〜16文字。遷移先で実際にできる行動の言葉を使う（例：資料をもらう／電話で相談する）" },
    micro: { type: "string", description: "ボタン下の小さな補足。8〜24文字。事実のみ。無ければ空文字" },
    ...extra,
  },
});

const CHOICE_SCHEMA = {
  name: "cta_strategy",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["affiliateIndex", "why", "mainBenefit", "slots"],
    properties: {
      affiliateIndex: { type: "integer", description: "使う案件の番号（1始まり）。読者に合う案件が無ければ0" },
      why: { type: "string" },
      mainBenefit: { type: "string", description: "この案件を使った読者が得る結果を、読者の言葉で1文（例：「面倒な相続手続きを、まとめてプロに任せられる」）。選ばない場合は空文字" },
      slots: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slot", "readerSituation", "angle", "headlineIdea"],
          properties: {
            slot: { type: "string", enum: ["intro", "mid", "end"] },
            readerSituation: { type: "string" },
            angle: { type: "string", description: "このスロットで訴える切り口（3つで被らせない）" },
            headlineIdea: { type: "string", description: "mainBenefitを、このスロットの読者の状況に合わせて言い換えた見出しの方向性" },
          },
        },
      },
    },
  },
};

const CAND_SCHEMA = (n) => ({
  name: "cta_candidates",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["slots"],
    properties: {
      slots: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slot", "candidates"],
          properties: {
            slot: { type: "string", enum: ["intro", "mid", "end"] },
            candidates: { type: "array", description: `${n}案`, items: slotSchema() },
          },
        },
      },
    },
  },
});

const JUDGE_SCHEMA = {
  name: "cta_judge",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["slots"],
    properties: {
      slots: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slot", "ranking", "problems", "improved"],
          properties: {
            slot: { type: "string", enum: ["intro", "mid", "end"] },
            ranking: { type: "array", items: { type: "integer" }, description: "候補の番号（0始まり）を、良い順に全て並べる" },
            problems: { type: "string" },
            improved: slotSchema(),
          },
        },
      },
    },
  },
};

const CONSISTENCY_SCHEMA = {
  name: "cta_consistency",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["consistent", "issues"],
    properties: {
      consistent: { type: "boolean" },
      issues: { type: "array", items: { type: "string" }, description: "遷移前後で食い違う点・誤解を生む点。無ければ空" },
    },
  },
};

const COPY_RULES = `コピーの作り方:
- 目的は「読者が思わずクリックする」こと。読者が得る結果（ベネフィット）を、見出しの先頭に近い位置で言い切る。ベネフィットとは「手間が減る」「ミスや不安が減る」「まとめて任せられる」「迷わず進められる」など、読者の生活がどうラクになるか
- 一文で「誰の・どんな悩みが・これを使うとどうなるか」が伝わる、自然な話し言葉に近い日本語にする。声に出して読んで違和感があれば不可。AIっぽい言い回し・回りくどい言い回しは不可
- ボタンの行動は、遷移先で実際にできる行動（成果条件）に必ず合わせる。例：資料請求が成果なら「資料をもらう」、電話が成果なら「電話で相談する」。遷移先でできない行動（予約・来所・オンライン面談など）をボタンや見出しで約束しない
- 見出し・補足・利点・小さな補足で、同じ内容を繰り返さない
- 運営者が作ったCTAの型は、土台として積極的に使う（introはほぼそのまま）。ただし最優先は記事テーマとの適合。テーマに合わない部分だけ直す
- 利点（✔）は、この記事のテーマ・読者の悩みから逆算して選び、記事ごとに切り口を変える。どの記事にも使える定型の利点を使い回さない
- 利点は「読者が得るもの」か「安心して頼める根拠」だけにする。調査時点（○年○月時点）と「自社調べ」は書かない。実績の数字は、運営者のCTA案に書かれているものだけ使ってよい。読者に関係の薄い豆知識も書かない
- 3つのCTAで、同じ事実を毎回繰り返さない。スロットごとに使う事実を分ける
- 「無料」は、遷移先で無料と明記されている範囲（広告主・遷移先の確認結果に書かれたもの）だけ。料金や費用の総額を誤認させる書き方は不可
- 事実は広告主の公式情報・遷移先の確認結果にあるものだけ。数字・期間は、そこに書かれているときだけ使う
- 誇張・煽り・不安をあおる表現、比喩、最上級表現（No.1など）は使わない
- 見出しは全角20〜36文字の、主語と述語がそろった一文にする（体言止めの断片は不可）。「！」は1つのCTAに1回まで
- 比喩・抽象語（道筋・出口・入口・土台など）は使わない。利点・補足は、広告主の公式情報・遷移先の確認結果に書かれた事実の言い換えだけにし、書かれていない効果を足さない`;

// 遷移前後の一貫性チェック（LLM）
async function checkConsistency(client, { cta, aff, landing, primary, killer = "" }) {
  return ask(
    client,
    CONSISTENCY_SCHEMA,
    `あなたは広告審査の担当者です。アフィリエイト広告の文面（遷移前）と、リンク先のページ（遷移後）で、読者へのコミュニケーションが一貫しているかを審査します。
以下のどれかに当てはまれば consistent=false にし、具体的な理由を issues に書く:
- ボタン・見出し・補足が約束する行動が、遷移先の主な行動（成果条件）と違う（例：成果が「資料請求」「電話」なのに、「来所予約」「オンライン面談」を主役にしている）
- 遷移先で確認できないこと・無料と書かれていないことを「無料」と言っている
- 費用や総額を誤認させる
- 日本語として不自然で意味が通らない、または体言止めの断片で文になっていない
- 利点・補足に、遷移先の確認結果で裏付けられない効果・状況が足されている（例：「家族で読める」「すぐ解決する」「不安が消える」）。利点は、確認結果に書かれた事実の言い換えに限る
- 実績の数字・調査時点・最上級表現が入っている`,
    `【広告文面】
見出し: ${cta.headline}
補足: ${cta.sub}
利点: ${cta.bullets.join(" / ")}
ボタン: ${cta.button}
小さな補足: ${cta.micro || "なし"}

【運営者が確認済みの訴求文（この文に書かれた事実は認める。遷移先と明確に矛盾する場合のみ指摘する）】
${killer || "なし"}

【遷移先の確認結果】
案件: ${aff.name}（${landing.officialUrl || "公式URL不明"}）
成果条件（遷移先で最終的にしてほしい行動）: ${primary.join("、") || "不明"}
遷移先でできること: ${landing.actions.map((a) => a.action).join(" / ")}
無料と明記されているもの: ${landing.freeItems.join(" / ") || "なし"}
注意点: ${landing.cautions.join(" / ") || "なし"}`
  );
}

// シートの「CTA案」を分解する。1行目=見出し、✔で始まる行=利点、「CTAリンク：」の行=ボタン文言（末尾の（）はボタン内の補足）
export function parseTemplate(killer) {
  const lines = String(killer || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const headline = lines[0];
  const bullets = lines.filter((l) => /^[✔✓☑]/.test(l)).map((l) => l.replace(/^[✔✓☑]\s*/, ""));
  const btnLine = lines.find((l) => /^CTAリンク[：:]/.test(l));
  if (!btnLine) return null;
  const label = btnLine.replace(/^CTAリンク[：:]\s*/, "");
  const m = label.match(/^(.*?)\s*([（(].*[）)])\s*$/);
  return { headline, bullets, button: m ? m[1] : label, buttonNote: m ? m[2] : "" };
}

// $記事テーマ$ に入れるテーマ名。AIは使わず、キーワードから「費用・手順・方法」などの言葉を外すだけ。
// 例：実家じまい費用→実家じまい／実家の片付け業者→実家の片付け／山林相続→山林／空き家 相続→空き家
const THEME_SUFFIXES = [
  "とは", "費用", "相場", "手順", "方法", "やり方", "流れ", "期限", "注意点", "補助金", "税金", "必要書類", "書類",
  "使えない", "できない", "売れない", "自分で", "ブログ", "業者", "違い", "チェックリスト", "失敗", "お金がない", "うんざり", "売れるもの",
  "やってはいけない", "の", "を", "は", "が", "に", "で",
];
const THEME_PREFIXES = ["やってはいけない", "田舎", "田舎の"];

export function themeFromKeyword(keyword) {
  let t = String(keyword).normalize("NFKC").replace(/\s+/g, "");
  for (let i = 0; i < 6; i++) {
    const before = t;
    for (const s of THEME_SUFFIXES) if (t.endsWith(s) && t.length > s.length + 1) t = t.slice(0, -s.length);
    for (const p of THEME_PREFIXES) if (t.startsWith(p) && t.length > p.length + 1) t = t.slice(p.length);
    if (t === before) break;
  }
  // 「山林相続」「空き家相続」のように末尾が相続なら、テンプレの「相続手続き」と重なるので外す
  if (t.endsWith("相続") && t.length > 3) t = t.slice(0, -2);
  if (t.endsWith("の") && t.length > 2) t = t.slice(0, -1);
  return t || keyword;
}

// 保存済みのCTA（運営者の型を使ったもの）を、AIなしで、いまの型・テーマ名の作り方で組み直す
export function rebuildTemplateCtas(ctas, keyword, affiliates = []) {
  const saved = ctas && ctas.affiliate;
  // シートの最新の内容（型・リンク）があれば、それを使う
  const aff = saved && (affiliates.find((a) => a.name === saved.name) || saved);
  const tpl = aff && parseTemplate(aff.killer);
  if (!tpl) return null;
  const theme = tpl.headline.includes("$記事テーマ$") ? themeFromKeyword(keyword) : "";
  const one = () => ({ headline: tpl.headline.split("$記事テーマ$").join(theme), sub: "", bullets: [...tpl.bullets], button: tpl.button, buttonNote: tpl.buttonNote, micro: "", url: aff.url, sponsored: true });
  return { ...ctas, slots: { intro: one(), mid: one(), end: one() }, template: true, theme };
}

export async function buildCtas({ keyword, outline, body, affiliates, apiKey, log = () => {} }) {
  if (!affiliates.length) return fallbackCtas();
  const client = new OpenAI({ apiKey });
  const third = body.sections[2] || body.sections[body.sections.length - 1];

  const articleCtx = `キーワード: ${keyword}
記事タイトル: ${outline.title}
導入文: ${strip(body.intro).slice(0, 350)}
3つ目のセクション「${third.h2}」の終わり: ${strip(third.html).slice(-350)}
記事の締め: ${strip(body.closing).slice(0, 250)}`;

  const affList = affiliates
    .map(
      (a, i) =>
        `${i + 1}. ${a.name}\n   広告主の公式情報: ${a.benefits.slice(0, 2000) || "記載なし"}\n   成果条件・報酬（社内情報）: ${a.reward || "不明"}\n   運営者メモ（社内情報・コピーに書かない）: ${a.notes || "なし"}${a.killer ? `\n   運営者が考えたキラーフレーズ（参考）: ${a.killer}` : ""}`
    )
    .join("\n\n");

  // 1) 案件の選定と、3か所の戦略
  const strategy = await ask(
    client,
    CHOICE_SCHEMA,
    `あなたはアフィリエイトの戦略担当です。記事の読者に本当に合う案件を1つ選び、記事内の3か所（intro/mid/end）で何をどう訴えるかを決めます。
- 「運営者メモ」の条件（対象エリア・物件の条件・利用できない状況）に当てはまらない記事では、その案件を選ばない。合う案件が無ければ0
- エリア・物件・読者の条件が限定された案件（案件名や公式情報に「東京23区限定」「首都圏限定」「都市部のみ」などがある、または運営者メモに「限定」「要注意」「ダメ」がある案件）は、記事がその条件（地域・物件の種類・状況）を明確に対象にしているときだけ選ぶ。全国の読者向けの一般的な記事では選ばない。迷ったら、全国対応で対象が広い案件を選ぶ
- 相続手続き全般・実家じまい全般の記事は、全国対応の相続手続きサービスが基本の選択肢
- 読者との適合が同程度なら、成果報酬が高い案件を優先する
- まず mainBenefit（読者が得る結果）を決める。「相談できる」「確認できる」は結果ではない。「まとめて任せられる」「手間が減る」「迷わず進められる」のような、読者の生活がどうラクになるか
- 3か所の切り口は被らせない。ただし3つとも mainBenefit を土台にする
${Object.entries(SLOT_ROLE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`,
    `${articleCtx}\n\n【案件一覧】\n${affList}`,
    "medium"
  );
  if (strategy.affiliateIndex < 1) {
    log(`  案件なし（${strategy.why}）`);
    return fallbackCtas();
  }
  const aff = affiliates[strategy.affiliateIndex - 1];
  log(`  採用案件: ${aff.name}`);

  // 運営者のCTA案があれば、AIで言い換えず、そのまま使う（3か所とも同じ）
  const tpl = parseTemplate(aff.killer);
  if (tpl) {
    const theme = tpl.headline.includes("$記事テーマ$") ? themeFromKeyword(keyword) : "";
    const one = () => ({
      headline: tpl.headline.split("$記事テーマ$").join(theme),
      sub: "",
      bullets: [...tpl.bullets],
      button: tpl.button,
      buttonNote: tpl.buttonNote,
      micro: "",
      url: aff.url,
      sponsored: true,
    });
    log(`  運営者のCTA案をそのまま使用 → ${one().headline}`);
    return { affiliate: aff, slots: { intro: one(), mid: one(), end: one() }, template: true, theme, strategy };
  }
  log(`  読者が得る結果: ${strategy.mainBenefit}`);

  // 2) 遷移先（広告主の公式ページ）を調べる
  log("  遷移先（公式ページ）をリサーチ");
  const landing = await researchLanding({ aff, apiKey, log });
  const primary = [...new Set([...(aff.actions ? [aff.actions] : []), ...actionsFromReward(aff.reward)])];
  log(`  遷移先でできること: ${landing.actions.map((a) => a.action).slice(0, 4).join(" / ")}`);
  log(`  成果条件から見た主な行動: ${primary.join("、") || "不明"}`);
  const sourceText = [aff.benefits, aff.killer || "", landing.summary, ...landing.freeItems, ...landing.actions.map((a) => `${a.action} ${a.evidence}`)].join("\n");
  const landingBrief = `遷移先（${landing.officialUrl || "公式サイト"}）の確認結果:
- 成果条件（読者にしてほしい行動）: ${primary.join("、") || "不明"}
- 遷移先でできること: ${landing.actions.map((a) => a.action).join(" / ")}
- 無料と明記されているもの: ${landing.freeItems.join(" / ") || "なし"}
- 注意点: ${landing.cautions.slice(0, 3).join(" / ")}`;

  const killer = (aff.killer || "").replace(/\$記事テーマ\$/g, keyword);
  const killerBrief = killer
    ? `\n\n【運営者が作ったCTAの型（見出し・✔の利点・ボタン文言。この型・トーン・事実を土台にする）】\n${killer}\n使い方: introの見出しは、この型の見出しをほぼそのまま使い、記事テーマに合わせて最小限だけ調整する。mid・endは、同じ型（【読者の状況の方へ】＋呼びかけ）を保ちつつ、切り口を変える。✔の利点は、型にある事実と、遷移先で確認できる事実から、この記事の読者の悩みに合うものを選び、記事ごとに変える。記事テーマとの適合を最優先する`
    : "";
  const actionPlan = planActions(primary);
  const actionBrief = `\n\nスロットごとの行動（ボタンはこの行動に合わせる。電話が苦手な読者もいるため、電話以外の行動も必ず入れる）:\n${["intro", "mid", "end"].map((k) => `- ${k}: ${actionPlan[k] || "（成果条件に合わせる）"}`).join("\n")}`;
  const usedBullets = await previousBullets();
  const varietyBrief = usedBullets.length ? `\n\n他の記事で使った利点（今回は別の切り口にする）: ${usedBullets.slice(0, 12).join(" / ")}` : "";

  const slotPlan = strategy.slots
    .map((s) => `■${s.slot}\n  位置: ${SLOT_ROLE[s.slot]}\n  読者の状況: ${s.readerSituation}\n  切り口: ${s.angle}\n  見出しの方向性: ${s.headlineIdea}`)
    .join("\n");
  const candSystem = `あなたは、読者が思わずクリックするCVコピーを書く、一流のコピーライターです。\n${COPY_RULES}\n3つのスロットで、見出しの書き出し・切り口が被らないようにする。introの見出しは必ず疑問形（？で終える）にする。`;
  const candUser = (feedback = "") =>
    `${articleCtx}\n\n案件: ${aff.name}\n広告主の公式情報:\n${aff.benefits.slice(0, 2000)}\n\n${landingBrief}\n\n戦略:\n${slotPlan}\n\n各スロットに5案ずつ作ってください。${killerBrief}${actionBrief}${varietyBrief}\n【重要】すべての案の見出しで、読者が得る結果「${strategy.mainBenefit}」を読者の言葉で言い切ること。ボタン文言は遷移先で実際にできる行動に合わせること。${feedback ? `\n【前回の指摘（必ず直す）】\n${feedback}` : ""}`;

  // 3) 候補 → 編集長の審査と書き直し
  const cands = await ask(client, CAND_SCHEMA(5), candSystem, candUser());
  const judge = await ask(
    client,
    JUDGE_SCHEMA,
    `あなたは厳しい編集長で、一流のコピーライターでもあります。CVコピーの候補を審査し、良い順に並べ、1位の案は自分の手で書き直して最終案（improved）にします。
審査基準:
1. 日本語として自然で意味がすぐ通るか（声に出して違和感のある案、AIっぽい案、回りくどい案は最下位）
2. 読者が「自分のことだ」と思いクリックしたくなるか。見出しの先頭付近に、読者が得るベネフィットがあるか
3. 遷移先と一貫しているか。ボタンの行動が、遷移先の成果条件に合っているか
4. 見出し・補足・利点・小さな補足が、同じ内容の繰り返しになっていないか
5. 公式情報・遷移先の確認結果にない事実、実績の数字、調査時点、最上級表現を書いていないか
6. 3スロットで見出しの型・書き出しが被っていないか。introの見出しは疑問形
書き直しは「より安全に」ではなく「より強く」する。ただし事実は足さない。`,
    `${articleCtx}\n\n${landingBrief}\n\n広告主の公式情報:\n${aff.benefits.slice(0, 2000)}\n\n候補:\n${cands.slots
      .map((s) => `■${s.slot}\n${s.candidates.map((c, i) => `  [${i}] 見出し:${c.headline} / 補足:${c.sub} / 利点:${c.bullets.join("・")} / ボタン:${c.button} / 小:${c.micro}`).join("\n")}`)
      .join("\n")}`
  );

  // 4) 機械の事実ガード → 遷移前後の一貫性チェックを通ったものだけ採用
  const accept = async (slot, c) => {
    const text = [c.headline, c.sub, ...c.bullets, c.button, c.micro].join(" ");
    const v = factViolation(text, sourceText, c.headline);
    if (v) return { ok: false, why: v };
    if (slot === "intro" && !/[？?]$/.test(c.headline.trim())) return { ok: false, why: "introの見出しが疑問形ではない" };
    const want = actionPlan[slot];
    if (want && ACTION_RE[want] && !ACTION_RE[want].test(c.button)) return { ok: false, why: `ボタン「${c.button}」が、指定の行動（${want}）と合っていない` };
    if (want && want !== "電話" && /電話|通話/.test(c.button)) return { ok: false, why: "電話以外の行動のスロットで、ボタンが電話になっている" };
    const k = await checkConsistency(client, { cta: c, aff, landing, primary, killer });
    return k.consistent ? { ok: true } : { ok: false, why: `一貫性: ${k.issues.join(" / ")}` };
  };

  const slots = {};
  for (const s of cands.slots) {
    const j = judge.slots.find((x) => x.slot === s.slot);
    const order = [...new Set([...(j ? j.ranking : []), ...s.candidates.map((_, i) => i)])].filter((i) => s.candidates[i]);
    const queue = [];
    if (j && j.improved && j.improved.headline) queue.push({ label: "編集長の最終案", c: j.improved });
    for (const idx of order.slice(0, 3)) queue.push({ label: `候補[${idx}]`, c: s.candidates[idx] });

    let chosen = null;
    const reasons = [];
    for (const q of queue) {
      const r = await accept(s.slot, q.c);
      if (r.ok) {
        chosen = q.c;
        log(`  ${s.slot}: ${q.label}を採用 → ${q.c.headline}`);
        break;
      }
      reasons.push(r.why);
      log(`  ${s.slot}: ${q.label}は不採用（${r.why}）`);
    }
    if (!chosen) {
      // 指摘を渡して、そのスロットだけ作り直す（1回）
      log(`  ${s.slot}: 指摘を踏まえて作り直し`);
      const retry = await ask(client, CAND_SCHEMA(4), candSystem, candUser(reasons.slice(0, 4).join("\n")));
      const rs = retry.slots.find((x) => x.slot === s.slot);
      for (const c of rs ? rs.candidates : []) {
        const r = await accept(s.slot, c);
        if (r.ok) {
          chosen = c;
          log(`  ${s.slot}: 作り直した案を採用 → ${c.headline}`);
          break;
        }
      }
    }
    slots[s.slot] = chosen ? { ...chosen, url: aff.url, sponsored: true } : { ...FALLBACK[s.slot], url: SITE.contactUrl, sponsored: false };
    if (!chosen) log(`  ${s.slot}: 審査を通る案が無く、お問い合わせ導線に切り替え`);
  }
  for (const k of ["intro", "mid", "end"]) if (!slots[k]) slots[k] = { ...FALLBACK[k], url: SITE.contactUrl, sponsored: false };
  return { affiliate: aff, slots, strategy, landing, primary };
}

// ---- 行動の割り振り（電話だけにしない）----
const ACTION_RE = { 資料請求: /資料|パンフ|ガイド/, 電話: /電話|通話|ダイヤル/, 査定: /査定/, 申込: /申|契約|登録|予約/ };

function planActions(primary) {
  const keys = primary.map((p) => (/資料/.test(p) ? "資料請求" : /電話/.test(p) ? "電話" : /査定/.test(p) ? "査定" : /申込|契約/.test(p) ? "申込" : null)).filter(Boolean);
  const phone = keys.find((k) => k === "電話");
  const other = keys.find((k) => k !== "電話");
  if (phone && other) return { intro: other, mid: phone, end: other };
  const only = keys[0];
  return only ? { intro: only, mid: only, end: only } : {};
}

// 同じ利点を使い回さないよう、これまでに作った記事の利点を読む（ローカル実行時）
async function previousBullets() {
  try {
    const fs = await import("node:fs/promises");
    const dirs = await fs.readdir("out", { withFileTypes: true });
    const used = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      try {
        const j = JSON.parse(await fs.readFile(`out/${d.name}/ctas.json`, "utf8"));
        for (const s of Object.values(j.slots || {})) used.push(...(s.bullets || []));
      } catch {}
    }
    return [...new Set(used)];
  } catch {
    return [];
  }
}

// 運営者のCTA案（シートの「CTA案」）の1行目が $記事テーマ$ を含む型なら、導入CTAの見出しをその型で固定する。
// テーマが自然に入る短いキーワード（「相続」を含まない）のときだけ適用し、それ以外はAIが型を記事に合わせて調整したものを使う。
export function applyTemplateHeadline(ctas, keyword) {
  const killer = ctas.affiliate && ctas.affiliate.killer;
  if (!killer || !killer.includes("$記事テーマ$") || !ctas.slots || !ctas.slots.intro) return ctas;
  if (keyword.includes("相続") || keyword.length > 10) return ctas;
  const line = killer.split(/\r?\n/).map((l) => l.trim()).find((l) => l.includes("$記事テーマ$"));
  if (!line) return ctas;
  ctas.slots.intro.headline = line.replace(/\$記事テーマ\$/g, keyword);
  return ctas;
}
