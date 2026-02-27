import { formatDate } from "@acme/utils/dayjs";

import { getBaseUrl } from "@/lib/base-url";

import type { BlogCardVariant, BlogItem } from "./types";

export function getInitials(value?: string | null) {
  if (!value) return "AG";
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getCardTitle(post: BlogItem) {
  return post.caption || post.audio?.title || "Alghurobaa";
}

export function getPostDateLabel(post: BlogItem) {
  return formatDate(post.date, "MMM D, YYYY");
}

export function buildTelegramFileProxy(fileId?: string | number | null) {
  if (!fileId) return null;
  try {
    return `${getBaseUrl()}/api/telegram/file/${encodeURIComponent(fileId)}`;
  } catch {
    return null;
  }
}

export function getPrimaryImageUrl(post: BlogItem) {
  if (post.coverImageUrl) return post.coverImageUrl;
  return buildTelegramFileProxy(post.img?.[0]?.fileId);
}

export function resolveVariant(post: BlogItem): BlogCardVariant {
  const hasAudio = !!post.audio?.telegramFileId;
  const hasImage = !!getPrimaryImageUrl(post);
  const hasText = !!post.content?.trim();

  if (post.type === "video") return "video";
  if (hasAudio) return "audio";
  if (hasImage && hasText) return "text+image";
  if (hasImage) return "image";
  if (hasText) return "text";
  return "unknown";
}
