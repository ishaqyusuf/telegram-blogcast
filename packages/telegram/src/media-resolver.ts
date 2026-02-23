// packages/telegram/src/media-resolver.ts
//
// Takes a raw Bot API message (from getUpdates after forward) and resolves
// the full media metadata into a shape that maps directly to Prisma models:
//   File, Thumbnail, Media, Author
//
// Audio:
//   - primary File  ← audio.file_id / file_unique_id / file_size / duration
//   - Media.title   ← audio.title
//   - Author.nameAr ← audio.performer (Arabic performer → nameAr)
//   - Author.name   ← audio.performer (non-Arabic → name)
//
// Photo:
//   - primary File  ← largest photo size (file_id / dimensions)
//   - Thumbnail[]   ← all smaller photo sizes as Thumbnail records
//
// Document / Video / Voice:
//   - primary File  ← document/video/voice file_id

// import type { TRPCContext } from "@api/trpc/init";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResolvedFile {
  fileId: string;
  fileUniqueId?: string;
  fileType: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ResolvedThumbnail {
  fileId: string;
  fileUniqueId?: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export interface ResolvedAuthor {
  name?: string;
  nameAr?: string;
}

export interface ResolvedMedia {
  file?: ResolvedFile;
  thumbnails?: ResolvedThumbnail[];
  title?: string;
  author?: ResolvedAuthor;
  mimeType: string;
  type: "audio" | "image" | "video" | "document" | "voice";
}

// ── RTL helper — determines if performer name is Arabic ───────────────────────

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// ── Extract from Bot API message ──────────────────────────────────────────────

export function extractResolvedMedia(msg: any): ResolvedMedia | null {
  // ── Audio ──────────────────────────────────────────────────────────────────
  if (msg.audio) {
    const a = msg.audio;
    const performer: string | undefined = a.performer?.trim() || undefined;

    return {
      type: "audio",
      mimeType: a.mime_type ?? "audio/mpeg",
      title: a.title ?? a.file_name ?? undefined,
      author: performer
        ? isArabic(performer)
          ? { nameAr: performer } // Arabic performer → nameAr
          : { name: performer } // Latin performer  → name
        : undefined,
      file: {
        fileId: a.file_id,
        fileUniqueId: a.file_unique_id,
        fileType: "audio",
        mimeType: a.mime_type ?? "audio/mpeg",
        fileName: a.file_name ?? undefined,
        fileSize: a.file_size ?? undefined,
        duration: a.duration ?? undefined,
      },
      thumbnails: [],
    };
  }

  // ── Voice ──────────────────────────────────────────────────────────────────
  if (msg.voice) {
    const v = msg.voice;
    return {
      type: "voice",
      mimeType: v.mime_type ?? "audio/ogg",
      file: {
        fileId: v.file_id,
        fileUniqueId: v.file_unique_id,
        fileType: "voice",
        mimeType: v.mime_type ?? "audio/ogg",
        fileSize: v.file_size ?? undefined,
        duration: v.duration ?? undefined,
      },
      thumbnails: [],
    };
  }

  // ── Photo ──────────────────────────────────────────────────────────────────
  if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
    // Sorted ascending by size — largest is last
    const sorted = [...msg.photo].sort(
      (a, b) => a.width * a.height - b.width * b.height,
    );
    const primary = sorted[sorted.length - 1]; // largest = primary File
    const smaller = sorted.slice(0, -1); // rest    = Thumbnails

    return {
      type: "image",
      mimeType: "image/jpeg",
      file: {
        fileId: primary.file_id,
        fileUniqueId: primary.file_unique_id,
        fileType: "image",
        mimeType: "image/jpeg",
        fileSize: primary.file_size ?? undefined,
        width: primary.width ?? undefined,
        height: primary.height ?? undefined,
      },
      thumbnails: smaller.map((s) => ({
        fileId: s.file_id,
        fileUniqueId: s.file_unique_id,
        width: s.width ?? undefined,
        height: s.height ?? undefined,
        fileSize: s.file_size ?? undefined,
      })),
    };
  }

  // ── Video ──────────────────────────────────────────────────────────────────
  if (msg.video) {
    const v = msg.video;
    const thumbs: ResolvedThumbnail[] = msg.video.thumbnail
      ? [
          {
            fileId: msg.video.thumbnail.file_id,
            fileUniqueId: msg.video.thumbnail.file_unique_id,
            width: msg.video.thumbnail.width,
            height: msg.video.thumbnail.height,
            fileSize: msg.video.thumbnail.file_size,
          },
        ]
      : [];

    return {
      type: "video",
      mimeType: v.mime_type ?? "video/mp4",
      file: {
        fileId: v.file_id,
        fileUniqueId: v.file_unique_id,
        fileType: "video",
        mimeType: v.mime_type ?? "video/mp4",
        fileName: v.file_name ?? undefined,
        fileSize: v.file_size ?? undefined,
        duration: v.duration ?? undefined,
        width: v.width ?? undefined,
        height: v.height ?? undefined,
      },
      thumbnails: thumbs,
    };
  }

  // ── Document ───────────────────────────────────────────────────────────────
  if (msg.document) {
    const d = msg.document;
    return {
      type: "document",
      mimeType: d.mime_type ?? "application/octet-stream",
      file: {
        fileId: d.file_id,
        fileUniqueId: d.file_unique_id,
        fileType: "document",
        mimeType: d.mime_type ?? "application/octet-stream",
        fileName: d.file_name ?? undefined,
        fileSize: d.file_size ?? undefined,
      },
      thumbnails: [],
    };
  }

  return null;
}

// ── Prisma persistence ────────────────────────────────────────────────────────

/**
 * Persists a ResolvedMedia into Prisma:
 *   - Upserts Author (by nameAr or name)
 *   - Creates File (primary)
 *   - Creates Thumbnail records for each smaller size
 *   - Creates Media linked to blog + file + author
 * Returns the created Media id.
 */
