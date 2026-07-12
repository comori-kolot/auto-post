function authHeader({ wpUsername, wpAppPassword }) {
  const token = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString("base64");
  return `Basic ${token}`;
}

async function uploadMedia({ wpUrl, wpUsername, wpAppPassword, imageBuffer, filename }) {
  const res = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader({ wpUsername, wpAppPassword }),
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: imageBuffer,
  });

  if (!res.ok) {
    throw new Error(`WordPressメディアアップロードに失敗しました: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function resolveCategoryId({ wpUrl, wpUsername, wpAppPassword, categoryName }) {
  const headers = { Authorization: authHeader({ wpUsername, wpAppPassword }) };

  const searchRes = await fetch(
    `${wpUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(categoryName)}`,
    { headers }
  );
  if (!searchRes.ok) {
    throw new Error(`WordPressカテゴリ検索に失敗しました: ${searchRes.status} ${await searchRes.text()}`);
  }
  const existing = await searchRes.json();
  const exact = existing.find((c) => c.name === categoryName);
  if (exact) {
    return exact.id;
  }

  const createRes = await fetch(`${wpUrl}/wp-json/wp/v2/categories`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: categoryName }),
  });
  if (!createRes.ok) {
    throw new Error(`WordPressカテゴリ作成に失敗しました: ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json();
  return created.id;
}

async function createPost({
  wpUrl,
  wpUsername,
  wpAppPassword,
  title,
  contentHtml,
  metaDescription,
  slug,
  featuredMediaId,
  categoryId,
  status,
}) {
  const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader({ wpUsername, wpAppPassword }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      content: contentHtml,
      excerpt: metaDescription,
      slug,
      status,
      featured_media: featuredMediaId,
      categories: categoryId ? [categoryId] : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(`WordPress投稿作成に失敗しました: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export async function publishToWordPress({
  wpUrl,
  wpUsername,
  wpAppPassword,
  title,
  contentHtml,
  metaDescription,
  slug,
  imageBuffer,
  categoryName,
  status = "publish",
}) {
  const media = await uploadMedia({
    wpUrl,
    wpUsername,
    wpAppPassword,
    imageBuffer,
    filename: `${slug}-eyecatch.png`,
  });

  const categoryId = categoryName
    ? await resolveCategoryId({ wpUrl, wpUsername, wpAppPassword, categoryName })
    : undefined;

  const post = await createPost({
    wpUrl,
    wpUsername,
    wpAppPassword,
    title,
    contentHtml,
    metaDescription,
    slug,
    featuredMediaId: media.id,
    categoryId,
    status,
  });

  return post;
}
