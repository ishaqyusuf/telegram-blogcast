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
  const date = post.date ? new Date(post.date) : null;
  const format = date?.getFullYear() === new Date().getFullYear()
    ? "MMM DD"
    : "MMM DD, YYYY";
  return formatDate(post.date, format);
}

export function getBlogHref(post: Pick<BlogItem, "id" | "type">) {
  if (post.type === "text") return `/blog-view-text/${post.id}`;
  if (post.type === "audio") return `/blog-view-2/${post.id}`;
  return `/blog-view/${post.id}`;
}

export function getInlinePreviewText(value?: string | null) {
  return value
    ?.replace(/[\r\n]+/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

export function getPrimaryImageUrl(post: BlogItem) {
  if (post.coverImageUrl) return post.coverImageUrl;
  const firstImage = post.img?.[0] as any;
  return firstImage?.url || getMediaFileUrl(firstImage?.file) || buildTelegramFileProxy(firstImage?.fileId);
}

export function getPrimaryDocumentMedia(post: BlogItem) {
  const doc = (post as any).doc;
  if (doc) return doc;

  const media = ((post as any).media ?? []) as Array<{
    mimeType?: string | null;
    file?: {
      mimeType?: string | null;
      fileName?: string | null;
      blobPathname?: string | null;
      blobContentType?: string | null;
    } | null;
  }>;

  return media.find((item) => {
    const mimeType = (item.mimeType || item.file?.mimeType || "").toLowerCase();
    const fileName = item.file?.fileName?.toLowerCase() ?? "";
    const blobPathname = item.file?.blobPathname?.toLowerCase() ?? "";
    const blobContentType = item.file?.blobContentType?.toLowerCase() ?? "";
    return (
      mimeType === "application/pdf" ||
      mimeType.startsWith("document/") ||
      blobContentType === "application/pdf" ||
      fileName.endsWith(".pdf") ||
      blobPathname.endsWith(".pdf")
    );
  });
}

export function getPrimaryDocumentUrl(post: BlogItem) {
  const doc = getPrimaryDocumentMedia(post) as any;
  if (!doc) return null;

  return (
    doc.url ||
    getMediaFileUrl(doc.file) ||
    buildTelegramFileProxy(doc.fileId ?? doc.telegramFileId)
  );
}

export function resolveVariant(post: BlogItem): BlogCardVariant {
  const hasAudio = !!(post.audio?.telegramFileId || (post.audio as any)?.url);
  const hasImage = !!getPrimaryImageUrl(post);
  const hasDocument = !!getPrimaryDocumentMedia(post);
  const hasText = !!(post.content?.trim() || post.caption?.trim());

  if (post.type === "video") return "video";
  if (post.type === "pdf" || hasDocument) return "pdf";
  if (hasAudio) return "audio";
  if (hasImage && hasText) return "text+image";
  if (hasImage) return "image";
  if (hasText) return "text";
  return "unknown";
}
