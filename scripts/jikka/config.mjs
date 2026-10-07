// 「実家じまいに困ったらグリビズ」用の記事自動生成パイプライン設定
export const SHEET_ID = process.env.SHEET_ID || "1ZWuabfpu3fPWHjzpE9izgOcapZ8Q7GFFbNw-PKzJm_8";
export const KW_TAB = "KW戦略";
export const AFFILIATE_TAB = "アフィリエイトリンク一覧";

export const SITE = {
  name: "グリビズ",
  url: "https://greeen-biz.com",
  contactUrl: "https://greeen-biz.com/contact/",
  companyUrl: "https://greeen-biz.com/company/",
  reader:
    "親から実家や土地（山林・農地を含む）を相続した、または近く相続する個人。何から手をつければいいか分からず、費用・期限・手続き・税金に不安がある。",
};

export const MODELS = {
  research: process.env.RESEARCH_MODEL || "gpt-5.5",
  article: process.env.ARTICLE_MODEL || "gpt-5.5",
  image: "gpt-image-2",
  imageSize: "1216x640",
};

// WordPressのカテゴリID（サイトで作成済み）
export const WP_CATEGORY = { parent: 156, katazuke: 157, akiya: 158, sanrin: 159, tetsuzuki: 160 };

// シートの実行メモ先頭の【分類】 → 子カテゴリ
export function categoryIdsFor(group, slug) {
  const ids = [WP_CATEGORY.parent];
  if (group === "実家の片付け") ids.push(WP_CATEGORY.katazuke);
  else if (group === "空き家") ids.push(WP_CATEGORY.akiya);
  else if (group === "相続土地・山林・農地") ids.push(WP_CATEGORY.sanrin);
  else if (group.startsWith("相続の手続き")) ids.push(WP_CATEGORY.tetsuzuki);
  else if (group === "実家の相続・売却") ids.push(/baikyaku/.test(slug) ? WP_CATEGORY.akiya : WP_CATEGORY.tetsuzuki);
  return ids;
}

export const AUTHOR_BOX = {
  title: "この記事を書いた人",
  body:
    "京都大学農学部で森林科学を学び、大学院農学研究科にも在籍。新卒から相続・遺品整理など幅広い業界のマーケティングを支援し、200件以上の相続を支援してきました。山林や農地の相続は、森林を学んだ立場から詳しく解説しています。",
};
