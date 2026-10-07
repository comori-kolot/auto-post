function authHeader() {
  const token = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

const base = () => process.env.WP_URL.replace(/\/$/, "");

async function wp(path, init) {
  const res = await fetch(`${base()}/wp-json${path}`, { ...init, headers: { Authorization: authHeader(), ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`WordPress ${path} が失敗しました: ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export async function uploadImage({ buffer, slug }) {
  return wp("/wp/v2/media", {
    method: "POST",
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${slug}-eyecatch.png"` },
    body: buffer,
  });
}

export async function createPost({ title, contentHtml, metaDescription, slug, categoryIds, mediaId, status, postId }) {
  // postId があれば既存の記事（下書き）を更新する
  return wp(postId ? `/wp/v2/posts/${postId}` : "/wp/v2/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      content: contentHtml,
      excerpt: metaDescription,
      slug,
      status,
      featured_media: mediaId || undefined,
      categories: categoryIds,
    }),
  });
}
