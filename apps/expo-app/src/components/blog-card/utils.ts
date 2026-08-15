import { formatDate } from "@acme/utils/dayjs";

import { buildTelegramFileProxy, getMediaFileUrl } from "@/lib/media-source";

import type { BlogCardVariant, BlogItem } from "./types";
import {
  getBlogPresentationType,
  getPrimaryImageSource,
} from "./media-card-behavior";

export {
  getBlogHref,
  getBlogPresentationType,
} from "./media-card-behavior";

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

export function getInlinePreviewText(value?: string | null) {
  return value
    ?.replace(/[\r\n]+/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

export function getPrimaryImageUrl(post: BlogItem) {
  const source = getPrimaryImageSource(post as any);
  return (
    source.url ||
    getMediaFileUrl(source.file as any) ||
    buildTelegramFileProxy(source.telegramFileId)
  );
}

export function getPrimaryDocumentMedia(post: BlogItem) {
  const doc = (post as any).doc;
  if (doc) return doc;

  const media = ((post as any).media ?? []) as {
    mimeType?: string | null;
    file?: {
      mimeType?: string | null;
      fileName?: string | null;
      blobPathname?: string | null;
      blobContentType?: string | null;
    } | null;
  }[];

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
  const presentationType = getBlogPresentationType(post as any);
  const externalMedia = (post as any).externalMedia;
  const hasAudio = !!(post.audio?.telegramFileId || (post.audio as any)?.url);
  const hasImage = !!getPrimaryImageUrl(post);
  const hasDocument = !!getPrimaryDocumentMedia(post);
  const hasText = !!(post.content?.trim() || post.caption?.trim());

  if (presentationType === "video") return "video";
  if (presentationType === "audio" && externalMedia?.externalUrl) return "audio";
  if (presentationType === "pdf" || hasDocument) return "pdf";
  if (hasAudio) return "audio";
  if (hasImage && hasText) return "text+image";
  if (hasImage) return "image";
  if (hasText) return "text";
  return "unknown";
}
