import { SITE } from "./config.mjs";
import { ctaHtml } from "./cta.mjs";

const BANNED = ["羅針盤", "航海", "落とし穴", "道しるべ", "橋渡し", "いかがでしたか", "と言えるでしょう", "壁"];
const decode = (s) => s.replace(/&amp;/g, "&");

// タグ内の属性のクォートを " に統一する（GPTが ' を使うことがあるため）
export function normalizeQuotes(html) {
  return html.replace(/<a\s[^>]*>/gi, (tag) => tag.replace(/(href|target|rel)='([^']*)'/gi, '$1="$2"'));
}

// 許可していないURLのリンクは、文字だけ残してリンクを外す（&amp; は & として比較する）
export function sanitizeLinks(html, allowedUrls) {
  const allowed = allowedUrls.map((u) => decode(u).split("#")[0]);
  const removed = [];
  const out = normalizeQuotes(html).replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
    const base = decode(href).split("#")[0];
    if (allowed.includes(base) || base === SITE.contactUrl || base === SITE.companyUrl) return m;
    removed.push(href);
    return inner;
  });
  return { html: out, removed };
}

export function lint(html) {
  const text = html.replace(/<[^>]+>/g, "");
  return {
    chars: text.length,
    banned: BANNED.filter((w) => text.includes(w)),
    tables: (html.match(/<table/g) || []).length,
    lists: (html.match(/<(ul|ol)[ >]/g) || []).length,
    externalLinks: (html.match(/<a [^>]*target="_blank"/g) || []).length,
    marks: (html.match(/<mark/g) || []).length,
    bangs: (text.match(/！/g) || []).length,
    boxes: (html.match(/data-gb-box/g) || []).length,
  };
}

// ============ 装飾（読みやすさ重視）============
const BOX = {
  point: { label: "POINT", color: "#1f4d36", bg: "#f6faf7" },
  caution: { label: "注意！", color: "#8b5a2b", bg: "#fdf7ef" },
  check: { label: "CHECK", color: "#1f4d36", bg: "#f6faf7" },
};

function boxHtml(type, inner) {
  const b = BOX[type];
  const body = inner
    .replace(/<p>/g, '<p style="margin:0 0 8px;line-height:1.8;">')
    .replace(/<ul>/g, '<ul style="margin:0;padding-left:1.4em;line-height:1.9;">');
  return `<div data-gb-box="${type}" style="border:2px solid ${b.color};border-radius:6px;padding:16px 18px;margin:26px 0;background:${b.bg};"><p style="margin:0 0 8px;"><span style="background:${b.color};color:#fff;font-weight:700;font-size:12px;padding:2px 10px;border-radius:3px;">${b.label}</span></p>${body}</div>`;
}

export function decorate(html) {
  let out = html;
  out = out.replace(/<div data-box="(point|caution|check)">([\s\S]*?)<\/div>/g, (_, t, inner) => boxHtml(t, inner));
  out = out.replace(/<mark>/g, '<mark style="background:linear-gradient(transparent 55%,#ffe27a 55%);color:inherit;padding:0 2px;">');
  out = out.replace(/<strong>/g, '<strong style="color:#1a1a1a;">');
  out = out.replace(/<table>/g, '<div style="overflow-x:auto;margin:22px 0;"><table style="border-collapse:collapse;width:100%;font-size:0.95em;">').replace(/<\/table>/g, "</table></div>");
  out = out.replace(/<th>/g, '<th style="border:1px solid #cfd8d2 !important;background:#eaf2ed !important;color:#1a1a1a !important;padding:9px 11px;text-align:left;font-weight:700;vertical-align:top;">');
  out = out.replace(/<td>/g, '<td style="border:1px solid #d9d7d0 !important;background:#fff !important;color:#1a1a1a !important;padding:9px 11px;vertical-align:top;line-height:1.7;">');
  out = out.replace(/<ol>/g, '<ol style="margin:18px 0;padding-left:1.6em;line-height:1.9;">').replace(/<ul>/g, '<ul style="margin:18px 0;padding-left:1.4em;line-height:1.9;">');
  return out;
}

function summaryBox(items) {
  if (!items || !items.length) return "";
  return `<div data-gb-box="summary" style="border:2px solid #1f4d36;border-radius:6px;padding:18px 20px;margin:28px 0;background:#fff;"><p style="margin:0 0 10px;font-weight:700;font-size:1.05em;color:#1f4d36;">この記事のポイント！</p><ul style="margin:0;padding:0;list-style:none;">${items
    .map((t) => `<li style="padding:3px 0 3px 1.7em;position:relative;line-height:1.7;"><span style="position:absolute;left:0;color:#1f4d36;font-weight:700;">✔</span><strong>${t}</strong></li>`)
    .join("")}</ul></div>`;
}

export function assemble({ body, ctas }) {
  const parts = [];
  parts.push(body.intro);
  parts.push(ctaHtml(ctas.slots.intro));
  parts.push(summaryBox(body.summary));
  body.sections.forEach((s, i) => {
    parts.push(`<h2>${s.h2}</h2>\n${s.html}`);
    if (i === 2 || (i === body.sections.length - 1 && body.sections.length < 3)) parts.push(ctaHtml(ctas.slots.mid));
  });
  parts.push(body.closing);
  parts.push(ctaHtml(ctas.slots.end));
  // 本文側の装飾のみ変換（CTA・まとめ枠はすでに装飾済み）
  return parts.map((p) => (p.includes("gb-cta-box") || p.includes('data-gb-box="summary"') ? p : decorate(p))).join("\n\n");
}
