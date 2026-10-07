// 仕上げの校正：AIっぽい表現・造語・比喩・意味の取りにくい言い回しを、一般の人に通じる言葉に直す
import OpenAI from "openai";
import { MODELS } from "./config.mjs";

const BANNED = ["出口", "入口", "地図", "ゴール", "羅針盤", "航海", "落とし穴", "道しるべ", "橋渡し", "舵", "いかがでしたか", "と言えるでしょう"];

const SCHEMA = {
  name: "polish_edits",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["edits"],
    properties: {
      edits: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["find", "replace", "reason"],
          properties: {
            find: { type: "string", description: "記事中にそのまま存在する文字列（HTMLタグを含めない。20〜60文字程度の、そこだけ置換しても文として成立する範囲）" },
            replace: { type: "string", description: "置き換え後。一般の人にすぐ通じる平易な言葉。意味・事実は変えない" },
            reason: { type: "string" },
          },
        },
      },
    },
  },
};

const FIELDS = (body) => [
  ["intro", body.intro],
  ["summary", (body.summary || []).join("\n")],
  ...body.sections.map((s, i) => [`h2_${i}`, s.h2]),
  ...body.sections.map((s, i) => [`section${i}`, s.html]),
  ["closing", body.closing],
];

export function findBanned(body) {
  const text = FIELDS(body).map(([, t]) => t.replace(/<[^>]+>/g, "")).join("\n");
  return BANNED.filter((w) => text.includes(w));
}

export async function polishBody({ body, apiKey, log = () => {} }) {
  const client = new OpenAI({ apiKey });
  const plain = FIELDS(body).map(([k, t]) => `[${k}]\n${t.replace(/<[^>]+>/g, "")}`).join("\n\n");
  const banned = findBanned(body);
  const res = await client.chat.completions.create({
    model: MODELS.article,
    messages: [
      {
        role: "system",
        content: `あなたは、AIが書いた記事の「AIくささ」を取り除く厳しい校閲者です。読者は相続や実家のことを初めて調べる一般の人です。
次のものを見つけ、平易な表現に直す置換案を出してください。
- 造語・比喩・抽象的な言い換え（例：「出口決定」「入口」「地図」「全体像を押さえる」など）。何をすることか分からない言葉
- 意味が取りにくい、回りくどい、声に出すと不自然な言い回し
- 「〜と言えるでしょう」「〜が重要です」などの空疎な決まり文句の連発
直す必要がある箇所だけを出す（最大15件）。事実・数字・URL・固有名詞は変えない。find は記事中の文字列を一字一句そのまま写す。${banned.length ? `\n特に次の語は必ず直す: ${banned.join("、")}` : ""}`,
      },
      { role: "user", content: plain },
    ],
    response_format: { type: "json_schema", json_schema: SCHEMA },
  });
  const { edits } = JSON.parse(res.choices[0].message.content);
  let applied = 0;
  const apply = (text) => {
    let t = text;
    for (const e of edits) {
      if (e.find && t.includes(e.find) && e.find !== e.replace) {
        t = t.replace(e.find, e.replace);
        applied++;
      }
    }
    return t;
  };
  const out = {
    ...body,
    intro: apply(body.intro),
    summary: (body.summary || []).map(apply),
    sections: body.sections.map((s) => ({ ...s, h2: apply(s.h2), html: apply(s.html) })),
    closing: apply(body.closing),
  };
  log(`  校正: ${edits.length}件の提案のうち${applied}か所を修正${edits.length ? "（" + edits.slice(0, 3).map((e) => `「${e.find.slice(0, 18)}」→「${e.replace.slice(0, 18)}」`).join("、") + "…）" : ""}`);
  return out;
}
