import OpenAI from "openai";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { MODELS } from "./config.mjs";

const CACHE = "out/landing-cache.json";
const TTL_MS = 14 * 24 * 3600 * 1000;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["officialUrl", "summary", "actions", "freeItems", "cautions"],
  properties: {
    officialUrl: { type: "string", description: "確認した公式サイト（広告主）のURL。見つからなければ空文字" },
    summary: { type: "string", description: "このサービスが、読者（個人）に何をしてくれるかを1〜2文" },
    actions: {
      type: "array",
      description: "公式サイトで、訪問者が実際にできる行動（例：資料請求、電話で相談、来店・面談予約、オンライン相談、無料査定の申込み）。ページに書かれているものだけ",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "evidence"],
        properties: { action: { type: "string" }, evidence: { type: "string", description: "公式サイト上の根拠となる表記" } },
      },
    },
    freeItems: { type: "array", items: { type: "string" }, description: "公式サイトで「無料」と明記されているもの（例：初回相談）。明記が無ければ空" },
    cautions: { type: "array", items: { type: "string" }, description: "対象外の条件・地域・利用できない状況など、広告で誤解させないために注意すべき点" },
  },
};

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE, "utf8"));
  } catch {
    return {};
  }
}

// 広告主の公式ページを検索して、遷移先で実際にできること・注意点を調べる（アフィリンクそのものは踏まない）
export async function researchLanding({ aff, apiKey, log = () => {} }) {
  const key = crypto.createHash("md5").update(aff.name + aff.url).digest("hex");
  const cache = await readCache();
  if (cache[key] && Date.now() - cache[key].at < TTL_MS) {
    log("  遷移先リサーチ: キャッシュを使用");
    return cache[key].data;
  }
  const client = new OpenAI({ apiKey });
  const resp = await client.responses.create({
    model: MODELS.research,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content:
          "あなたは広告審査の担当者です。必ずWeb検索で広告主の公式サイト（サービスの公式ページ）を実際に確認してから回答します。読者（個人）が公式ページに来たときに、実際にできる行動と、広告の文面で誤解を生まないための注意点を調べます。ページに書かれていないことは書かない。",
      },
      {
        role: "user",
        content: `広告案件: ${aff.name}
広告主の説明（A8の案件情報）:\n${aff.benefits.slice(0, 1500)}
成果条件（この行動が発生すると成果になる）: ${aff.reward || "不明"}

上記のサービスの公式サイトを検索で探し、訪問者ができる行動（資料請求、電話での相談、来店・面談の予約、オンライン相談、無料査定の申込みなど）を、ページの表記どおりに列挙してください。`,
      },
    ],
    text: { format: { type: "json_schema", name: "landing_research", strict: true, schema: SCHEMA } },
  });
  const data = JSON.parse(resp.output_text);
  cache[key] = { at: Date.now(), data };
  await fs.mkdir("out", { recursive: true });
  await fs.writeFile(CACHE, JSON.stringify(cache, null, 2));
  return data;
}

// 成果条件（報酬欄）から、読者にとっての行動を推定（例：新規資料請求→資料請求、新規電話問い合わせ→電話相談）
export function actionsFromReward(reward = "") {
  const out = [];
  const map = [
    [/資料請求|資料/, "資料請求"],
    [/電話/, "電話での問い合わせ・相談"],
    [/査定/, "査定の申込み"],
    [/成約|契約|申込|申し込み/, "申込み・契約"],
    [/面談|来店|来訪|予約/, "面談・来店予約"],
    [/会員登録|無料登録/, "無料会員登録"],
  ];
  for (const [re, label] of map) if (re.test(reward)) out.push(label);
  return out;
}
