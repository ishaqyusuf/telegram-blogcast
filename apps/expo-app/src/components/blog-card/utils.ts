import { formatDate } from "@acme/utils/dayjs";

import { buildTelegramFileProxy, getMediaFileUrl } from "@/lib/media-source";

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

export function getChannelName(post: BlogItem) {
  const channel = (post as any).channel;
  return channel?.title || channel?.username || "Unknown channel";
}

export function getChannelHandle(post: BlogItem) {
  const username = (post as any).channel?.username;
  return username ? `@${username}` : null;
}

export function getPostDateLabel(post: BlogItem) {
  return formatDate(post.date, "MMM D, YYYY");
}

export function getBlogHref(post: Pick<BlogItem, "id" | "type">) {
  if (post.type === "text") return `/blog-view-text/${post.id}`;
  if (post.type === "audio") return `/blog-view-2/${post.id}`;
  return `/blog-view/${post.id}`;
}

export function getPrimaryImageUrl(post: BlogItem) {
  if (post.coverImageUrl) return post.coverImageUrl;
  const firstImage = post.img?.[0] as any;
  return firstImage?.url || getMediaFileUrl(firstImage?.file) || buildTelegramFileProxy(firstImage?.fileId);
}

export function resolveVariant(post: BlogItem): BlogCardVariant {
  const hasAudio = !!(post.audio?.telegramFileId || (post.audio as any)?.url);
  const hasImage = !!getPrimaryImageUrl(post);
  const hasText = !!(post.content?.trim() || post.caption?.trim());

  if (post.type === "video") return "video";
  if (hasAudio) return "audio";
  if (hasImage && hasText) return "text+image";
  if (hasImage) return "image";
  if (hasText) return "text";
  return "unknown";
}
