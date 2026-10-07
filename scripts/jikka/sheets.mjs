import { google } from "googleapis";
import { SHEET_ID, KW_TAB, AFFILIATE_TAB } from "./config.mjs";

// ローカルでは GOOGLE_SA_KEY_FILE（鍵ファイルのパス）、クラウドでは GOOGLE_SA_KEY_JSON（鍵の中身）を使う
function getAuth() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  // GitHubのSecretsに鍵のJSONを直接貼れないとき用：JSONをbase64にしたもの
  if (process.env.GOOGLE_SA_KEY_B64) {
    return new google.auth.GoogleAuth({ credentials: JSON.parse(Buffer.from(process.env.GOOGLE_SA_KEY_B64, "base64").toString("utf8")), scopes });
  }
  if (process.env.GOOGLE_SA_KEY_JSON) {
    return new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_SA_KEY_JSON), scopes });
  }
  if (process.env.GOOGLE_SA_KEY_FILE) {
    return new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_SA_KEY_FILE, scopes });
  }
  throw new Error("GOOGLE_SA_KEY_FILE または GOOGLE_SA_KEY_JSON が設定されていません");
}

function api() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(/,/g, "")));

// KW戦略シートの B3:N を読み、記事ごとのオブジェクトにする（行番号つき）
export async function readKeywordRows() {
  const sheets = api();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${KW_TAB}'!B3:N500`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.values || [];
  return rows
    .map((r, i) => {
      const memo = String(r[12] ?? "");
      const m = memo.match(/^【(.+?)】/);
      return {
        rowNumber: i + 3,
        no: r[0],
        slug: String(r[2] ?? "").trim(),
        keyword: String(r[4] ?? "").trim(),
        volume: num(r[6]),
        targetRank: num(r[7]),
        status: String(r[10] ?? "").trim(),
        memo,
        group: m ? m[1] : "",
      };
    })
    .filter((r) => r.slug && r.keyword);
}

export async function pickNextRow({ slug, rowNumber } = {}) {
  const rows = await readKeywordRows();
  if (slug) return rows.find((r) => r.slug === slug);
  if (rowNumber) return rows.find((r) => r.rowNumber === Number(rowNumber));
  return rows.find((r) => r.status === "未着手");
}

// ステータス(L列)と完了日(M列)を更新する
export async function markRow(rowNumber, status, dateStr) {
  const sheets = api();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${KW_TAB}'!L${rowNumber}:M${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status, dateStr ?? ""]] },
  });
}

// A8リンクシート。列の並びは問わず、見出し行の名前で読み取る（タブが無い・空のときは空配列）
//   案件名 / 対象テーマ(カテゴリ・KW) / リンクURL(アフィリンク) / ベネフィット(訴求してよい事実) / NG(使ってはいけない表現) / 有効(×で除外)
const HEADER_MAP = [
  ['id', /^(No|ID|番号)$/i],
  ['name', /(案件|商品|商材|サービス|名称|名前)/],
  ['url', /(URL|リンク|アフィ)/i],
  ['benefits', /(ベネフィット|訴求|特徴|メリット|強み|セールスポイント)/],
  ['actions', /(CV地点|遷移先|できること|アクション)/],
  ['reward', /(報酬|単価)/],
  ['notes', /(補足|備考|メモ)/],
  ['killer', /(CTA案|キラー|フレーズ)/],
  ['themes', /(テーマ|カテゴリ|KW|ジャンル|キーワード)/i],
  ['ng', /(NG|禁止)/i],
  ['enabled', /(有効|使用)/],
];

export async function readAffiliates() {
  const sheets = api();
  let values;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${AFFILIATE_TAB}'!A1:Z300`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    values = res.data.values || [];
  } catch (e) {
    if (/Unable to parse range|not found/i.test(e.message)) return [];
    throw e;
  }
  // 見出し行 = 「URL/リンク」と「案件/名」の両方を含む最初の行
  const headerIdx = values.findIndex((r) => r.some((c) => /(URL|リンク)/i.test(String(c))) && r.some((c) => /(案件|商品|商材|サービス|名)/.test(String(c))));
  if (headerIdx < 0) return [];
  const header = values[headerIdx].map((c) => String(c ?? ''));
  const col = {};
  for (const [key, re] of HEADER_MAP) {
    const i = header.findIndex((h, idx) => re.test(h) && !Object.values(col).includes(idx));
    if (i >= 0) col[key] = i;
  }
  if (col.url == null || col.name == null) return [];
  return values
    .slice(headerIdx + 1)
    .map((r) => ({
      id: col.id != null ? String(r[col.id] ?? '').trim() : '',
      name: String(r[col.name] ?? '').trim(),
      themes: col.themes != null ? String(r[col.themes] ?? '').trim() : '',
      url: String(r[col.url] ?? '').trim(),
      benefits: col.benefits != null ? String(r[col.benefits] ?? '').trim() : '',
      ng: col.ng != null ? String(r[col.ng] ?? '').trim() : '',
      killer: col.killer != null ? String(r[col.killer] ?? '').replace(/s+/g, ' ').trim() : '',
      actions: col.actions != null ? String(r[col.actions] ?? '').replace(/s+/g, ' ').trim() : '',
      reward: col.reward != null ? String(r[col.reward] ?? '').replace(/\s+/g, ' ').trim() : '',
      notes: col.notes != null ? String(r[col.notes] ?? '').replace(/\s+/g, ' ').trim() : '',
      enabled: col.enabled != null ? !/^[×xX✕]$/.test(String(r[col.enabled] ?? '').trim()) : true,
    }))
    .filter((a) => a.url && a.enabled && /^https?:\/\//.test(a.url));
}
