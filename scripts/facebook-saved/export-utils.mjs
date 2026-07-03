export function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function canonicalizeUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value, "https://www.facebook.com");
    url.hash = "";

    if (url.hostname === "facebook.com") {
      url.hostname = "www.facebook.com";
    }

    const watchVideoId = url.pathname === "/watch/" && url.searchParams.get("v");
    if (watchVideoId) {
      return `https://www.facebook.com/watch/?v=${watchVideoId}`;
    }

    const reelMatch = url.pathname.match(/^\/reel\/([^/]+)\/?/);
    if (reelMatch) {
      return `https://www.facebook.com/reel/${reelMatch[1]}/`;
    }

    const keptParams = new URLSearchParams();
    for (const key of ["id", "story_fbid", "post_id", "comment_id"]) {
      const param = url.searchParams.get(key);
      if (param) keptParams.set(key, param);
    }

    url.search = keptParams.toString();
    return url.toString();
  } catch {
    return normalizeText(value);
  }
}

export function inferTitle(caption, sourceTitle) {
  const cleanSourceTitle = normalizeText(sourceTitle)
    .replace(/\s*'s post$/i, "")
    .replace(/,\s*view story$/i, "");
  const cleanCaption = normalizeText(caption);

  if (cleanCaption) {
    const sentence = cleanCaption
      .split(/(?<=[.!?؟])\s+/u)
      .find((part) => normalizeText(part).length > 0);
    const title = normalizeText(sentence || cleanCaption);
    return title.length > 180 ? `${title.slice(0, 177).trim()}...` : title;
  }

  return cleanSourceTitle || "Facebook saved item";
}

export function validateSavedItems(items) {
  const errors = [];
  const seen = new Set();
  const validItems = [];

  for (const [index, item] of items.entries()) {
    const normalized = {
      title: normalizeText(item.title),
      link: canonicalizeUrl(item.link),
      url: canonicalizeUrl(item.url || item.link),
      collection: normalizeText(item.collection),
      avatar: normalizeText(item.avatar),
      caption: normalizeText(item.caption),
    };

    if (
      !normalized.title &&
      !normalized.caption &&
      !normalized.link &&
      !normalized.url
    ) {
      errors.push(`Item ${index + 1} is empty.`);
      continue;
    }

    const key = normalized.url || normalized.link;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    validItems.push(normalized);
  }

  return { errors, items: validItems };
}

export function buildExportPayload(items, metadata = {}) {
  const validation = validateSavedItems(items);

  return {
    exportedAt: new Date().toISOString(),
    source: {
      type: "facebook-saved",
      url: metadata.url ?? "https://www.facebook.com/saved/?cref=28",
      title: metadata.title ?? null,
    },
    count: validation.items.length,
    items: validation.items,
    validation: {
      errors: validation.errors,
    },
  };
}

export function getDatedExportPath(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10);
  return `exports/facebook-saved-${ymd}.json`;
}
