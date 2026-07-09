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

async function createPost({ wpUrl, wpUsername, wpAppPassword, title, contentHtml, metaDescription, slug, featuredMediaId }) {
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
      status: "publish",
      featured_media: featuredMediaId,
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
}) {
  const media = await uploadMedia({
    wpUrl,
    wpUsername,
    wpAppPassword,
    imageBuffer,
    filename: `${slug}-eyecatch.png`,
  });

  const post = await createPost({
    wpUrl,
    wpUsername,
    wpAppPassword,
    title,
    contentHtml,
    metaDescription,
    slug,
    featuredMediaId: media.id,
  });

  return post;
}
