import OpenAI from "openai";
import { MODELS, SITE } from "./config.mjs";

const SCHEMA = {
  name: "article_body",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intro", "summary", "sections", "closing"],
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

export async function writeArticle({ keyword, outline, sources, internal = [], apiKey }) {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: MODELS.article,
    messages: [
      {
        role: "system",
        content: `あなたは${SITE.name}のライターです。読者は「${SITE.reader}」。構成案に沿って記事本文を書きます。\n\n${RULES}`,
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

${internal.length ? `既存記事（内部リンク候補）。下の一覧から、今回の記事の内容に本当に関連するものだけを選び、本文中の自然な文脈で3〜6本紹介する。一覧に無いURLは使わない。無理に入れない:
${internal.map((p) => `- ${p.title} ${p.url}`).join("\n")}` : ""}

全体で3000文字以上。各セクションは400字以上の内容にしてください。`,
      },
    ],
    response_format: { type: "json_schema", json_schema: SCHEMA },
  });
  return JSON.parse(completion.choices[0].message.content);
}
