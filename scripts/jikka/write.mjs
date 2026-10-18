import OpenAI from "openai";
import { MODELS, SITE } from "./config.mjs";

const SCHEMA = {
  name: "article_body",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intro", "summary", "sections", "faq", "closing"],
    properties: {
      intro: { type: "string", description: "導入文のHTML（<p>のみ、2〜3段落）。見出しは付けない。読者の悩みに共感する一文＋「！」で始め、読み進める理由を示す" },
      summary: { type: "array", items: { type: "string" }, description: "「この記事のポイント」。結論を3〜4個。各20〜40文字。「！」で終えてよい" },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["h2", "html"],
          properties: {
            h2: { type: "string", description: "構成案のH2をそのまま使う" },
            html: { type: "string", description: "セクション本文のHTML。<h2>は含めない。使用可: <p><table><thead><tbody><tr><th><td><ul><ol><li><strong><mark><a>、および囲み枠 <div data-box=\"point|caution|check\"><p>…</p></div>" },
          },
        },
      },
      faq: {
        type: "array",
        description: "「よくある質問」3〜5問。読者が検索しそうな疑問文（Q）と、本文の内容に基づく2〜3文の回答（A）。本文に書いていない事実は足さない。Aは<p>なしの文字だけ",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["q", "a"],
          properties: { q: { type: "string", description: "疑問文。例：実家じまいは何年かかりますか？" }, a: { type: "string" } },
        },
      },
      closing: { type: "string", description: "締めのHTML（<p>1〜2段落）。次に取るべき行動を1つ示し、個別の判断は専門家に確認するよう自然に1文入れる" },
    },
  },
};

const RULES = `文体・構成:
- です・ます調。一文は短く、結論を先に書く。1つの<p>は最大3文
- 読み手の負担を減らすため、<table>（比較・費用・条件・期限）、<ol>（手順）、<ul>（チェック項目）、<strong>（重要語）を積極的に使い、文章にリズムを作る。ただし表や箇条書きだけで済ませず、前後に1〜2文の説明を添える
- 費用・期間・税率・期限などの数字は、参照URLの内容で確認できるものだけ断定する。確認できない数字は「目安」「状況により異なる」と書き、数字を作らない
- 制度の施行日や改正がある話題は、いつからの制度かを明記する

読みやすさのための装飾（積極的に使う）:
- 「！」を、読者の背中を押す要所の文末に使い、テンポを作る（1セクションに2〜4回。ただし煽りや不安をあおる使い方はしない）
- <strong>（黒太字）は、1つの段落に1〜2か所。数字・期限・結論・注意点に付ける
- <mark>（マーカー）は、1つのセクションに1〜2か所。「これだけは覚えてほしい」最重要の短いフレーズだけに付ける
- 囲み枠を、1セクションに1つ前後入れる:
  <div data-box="point"><p>ここが大事！という要点を1〜2文</p></div>
  <div data-box="caution"><p>見落とすと損をする・やり直しになる点を1〜2文</p></div>
  <div data-box="check"><ul><li>確認項目</li><li>確認項目</li></ul></div>
  <div data-box="field"><p>実際の相談では〜</p></div>（運営者の相談現場メモが渡されたときだけ使う）
- 表は<thead><tr><th>…</th></tr></thead><tbody>…</tbody>の形で、見出し行をつける

禁止:
- 比喩・たとえ話・造語を使わない。「出口」「入口」「地図」「ゴール」「壁」「羅針盤」「航海」「落とし穴」「鍵」「道しるべ」「橋渡し」のような言い換え表現は禁止。例：「出口決定」ではなく「売る・貸す・解体するなど、実家の扱いを決めること」のように、一般の人にすぐ通じる言葉で書く
- 初めて読む人が意味を取れない言葉（業界用語・省略語・AIが作りがちな抽象語）を使わない。専門用語を使うときは、その場で短く説明する
- 冗長な前置き、同じ内容の言い換え、挨拶（「いかがでしたか」「ぜひ参考にしてください」など）、「〜と言えるでしょう」の連発
- 誇張・煽り・不安を過度にあおる表現
- 「まとめ」「はじめに」といった形式的な見出し

内部リンク（既存記事の紹介）:
- 渡された既存記事の一覧から、内容が関連するものを、本文の文脈の中で自然に紹介する。形式: <a href="URL">記事のタイトル、または内容を表す短い言葉</a>（target属性やrelは付けない）
- 例：「山林の相続登記の費用については、<a href="…">山林の相続登記にかかる費用はいくら？</a>で詳しく解説しています。」のように、読者が次に読みたくなる一文にする
- 同じ記事を2回紹介しない。一覧に無いURLは作らない

外部リンク:
- 参照URLとして渡されたものだけを、根拠となる文の中に自然に入れる。形式: <a href="URL" target="_blank" rel="noopener">リンク文言</a>
- 民間の法律事務所・行政書士事務所・税理士事務所のURLには rel="noopener nofollow" を付ける。官公庁・自治体は rel="noopener"
- 出典は文末に（出典：<a href="URL" target="_blank" rel="noopener">機関名「ページ名」</a>）の形で示す。「〜で確認できます」「根拠は〜」「詳しくは〜で」のような案内文は書かない
- 渡されていないURLは絶対に作らない
- CTA（申し込み・相談への誘導）は本文に書かない（別の工程で挿入する）`;

const EMOTION_RULES = `

【気持ちの記事（最優先ルール。上の装飾・表・「！」の指示と食い違うときはこちらを優先する）】
- 読者は、実家がなくなることに寂しさ・喪失感・罪悪感を抱いている。やさしく落ち着いた、押しつけない文体で書く。励ましの決まり文句や、気持ちを決めつける書き方（「〜と感じるはずです」）は避け、「〜と感じる人は少なくありません」のように寄り添う
- 導入文は、読者の気持ちを言葉にして受け止める共感から始める。「！」は使わない（記事全体でも使わない）。<mark>は記事全体で1〜2か所まで、<strong>は1段落に1か所まで
- 表（<table>）は使わない。箇条書き・番号リストは、気持ちを整理する具体的な行動（写真を残す、最後に家で過ごす時間をつくる、など）を示すときだけ使う
- 囲み枠は data-box="point" と "check" だけを使う（"caution" は使わない）。記事全体で2〜3個まで
- 体験談を創作しない。「私は〜」「Aさんは〜」のような具体的な人物・出来事・会話は書かない。渡された「相談現場メモ」の中に今回の記事に合うものが無ければ、現場の話は一切入れない。一般的に起こりやすい気持ちや場面は、「〜という人は多い」のように断定を避けて書く
- 数字（割合・人数など）は参照URLで確認できるものだけ。作らない
- 実務（売却・解体・手続き）は、最後のセクションで短く触れ、関連する既存記事へ案内する。ここで細かい費用・税金の説明はしない
- FAQは、気持ちに関する疑問（例：寂しいのは普通ですか？ 罪悪感はどう扱えばよいですか？）を中心にする
- 全体で2500文字以上。各セクションは400字以上`;

export async function writeArticle({ keyword, outline, sources, internal = [], fieldNotes = [], apiKey, style = "practical" }) {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: MODELS.article,
    messages: [
      {
        role: "system",
        content: `あなたは${SITE.name}のライターです。読者は「${SITE.reader}」。構成案に沿って記事本文を書きます。\n\n${RULES}${style === "emotion" ? EMOTION_RULES : ""}`,
      },
      {
        role: "user",
        content: `キーワード: ${keyword}
タイトル: ${outline.title}

導入文で触れる要点:
${outline.introPoints.map((p) => `- ${p}`).join("\n")}

構成案:
${outline.sections
  .map(
    (s, i) => `[${i + 1}] H2: ${s.h2}
  表現: ${s.format}
  書く内容: ${s.points.join(" / ")}
  参照URL: ${s.referenceUrls.length ? s.referenceUrls.join(" , ") : "なし"}`
  )
  .join("\n")}

締めの要点: ${outline.closingPoint}

参照URLの一覧（この中のものだけ使う）:
${sources.map((s) => `- [${s.kind}] ${s.publisher}「${s.title}」 ${s.url}`).join("\n")}

${fieldNotes.length ? `運営者の「相談現場メモ」（実際に相談を受けた経験。事実として扱ってよい。個人が特定されない形で、今回の記事に関連するものだけを、本文の中の適切な場所に <div data-box="field"><p>実際の相談では、〜というケースがありました。〜</p></div> の形で1〜2か所入れる。メモに書かれていない内容・数字は足さない。関連するものが無ければ入れない）:
${fieldNotes.map((n, i) => `[${i + 1}] テーマ:${n.theme || "全般"} / 状況:${n.situation} / 起きたこと:${n.what} / 結果・学び:${n.lesson}${n.numbers ? " / 金額・期間:" + n.numbers : ""}`).join("\n")}

` : ""}${internal.length ? `既存記事（内部リンク候補）。下の一覧から、今回の記事の内容に本当に関連するものだけを選び、本文中の自然な文脈で3〜6本紹介する。一覧に無いURLは使わない。無理に入れない:
${internal.map((p) => `- ${p.title} ${p.url}`).join("\n")}` : ""}

${style === "emotion" ? "全体で2500文字以上。各セクションは400字以上の内容にしてください。" : "全体で3000文字以上。各セクションは400字以上の内容にしてください。"}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: SCHEMA },
  });
  return JSON.parse(completion.choices[0].message.content);
}
