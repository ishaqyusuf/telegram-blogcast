import { and, eq, inArray } from "drizzle-orm";
import { initLocalDb, localDb, withLocalDbRetry } from "@/db/local-db";
import {
  localBooks,
  localComments,
  localFootnotes,
  localHighlights,
  localPages,
  localParagraphs,
  localVolumes,
} from "@/db/local-schema";

type DownloadedBookPayload = {
  book: {
    id: number;
    nameAr?: string | null;
    nameEn?: string | null;
    coverColor?: string | null;
    shamelaId?: number | null;
    shamelaUrl?: string | null;
    sourceType?: string | null;
    editable?: boolean | null;
    ownerUserId?: number | null;
    contentHash?: string | null;
  };
  volumes: Array<{
    id: number;
    number: number;
    title?: string | null;
  }>;
  pages: Array<{
    id: number;
    volumeId?: number | null;
    shamelaPageNo: number;
    shamelaUrl?: string | null;
    printedPageNo?: number | null;
    chapterTitle?: string | null;
    topicTitle?: string | null;
    status: string;
    paragraphs?: Array<{
      id: number;
      pid: number;
      text: string;
      footnoteIds?: string | null;
    }>;
    footnotes?: Array<{
      id: number;
      marker: string;
      type?: string | null;
      content: string;
    }>;
  }>;
  highlights?: Array<{
    id: number;
    pageId: number;
    paragraphId?: number | null;
    startOffset?: number | null;
    endOffset?: number | null;
    color?: string | null;
    note?: string | null;
    quoteText?: string | null;
    createdAt?: Date | string | number | null;
    updatedAt?: Date | string | number | null;
  }>;
  comments?: Array<{
    id: number;
    pageId: number;
    paragraphId?: number | null;
    content: string;
    createdAt?: Date | string | number | null;
    updatedAt?: Date | string | number | null;
  }>;
};

function toDate(value: Date | string | number | null | undefined, fallback: Date) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback;
}

export async function saveBookDownloadToLocalDb(payload: DownloadedBookPayload) {
  await initLocalDb();
  const now = new Date();
  const bookId = payload.book.id;
  const pageIds = payload.pages.map((page) => page.id);

  await withLocalDbRetry(async () => {
    if (pageIds.length > 0) {
      await localDb
        .delete(localParagraphs)
        .where(inArray(localParagraphs.pageId, pageIds));
      await localDb
        .delete(localFootnotes)
        .where(inArray(localFootnotes.pageId, pageIds));
    }

    await localDb.delete(localPages).where(eq(localPages.bookId, bookId));
    await localDb.delete(localVolumes).where(eq(localVolumes.bookId, bookId));
    await localDb
      .delete(localHighlights)
      .where(
        and(
          eq(localHighlights.bookId, bookId),
          eq(localHighlights.syncStatus, "synced"),
        ),
      );
    await localDb
      .delete(localComments)
      .where(
        and(
          eq(localComments.bookId, bookId),
          eq(localComments.syncStatus, "synced"),
        ),
      );

    await localDb
      .insert(localBooks)
      .values({
        id: bookId,
        nameAr: payload.book.nameAr ?? null,
        nameEn: payload.book.nameEn ?? null,
        coverColor: payload.book.coverColor ?? null,
        shamelaId: payload.book.shamelaId ?? null,
        shamelaUrl: payload.book.shamelaUrl ?? null,
        sourceType: payload.book.sourceType ?? "user",
        editable: payload.book.editable ?? true,
        ownerUserId: payload.book.ownerUserId ?? null,
        contentHash: payload.book.contentHash ?? null,
        downloadedAt: now,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: localBooks.id,
        set: {
          nameAr: payload.book.nameAr ?? null,
          nameEn: payload.book.nameEn ?? null,
          coverColor: payload.book.coverColor ?? null,
          shamelaId: payload.book.shamelaId ?? null,
          shamelaUrl: payload.book.shamelaUrl ?? null,
          sourceType: payload.book.sourceType ?? "user",
          editable: payload.book.editable ?? true,
          ownerUserId: payload.book.ownerUserId ?? null,
          contentHash: payload.book.contentHash ?? null,
          lastSyncedAt: now,
        },
      });

    if (payload.volumes.length > 0) {
      await localDb.insert(localVolumes).values(
        payload.volumes.map((volume) => ({
          id: volume.id,
          bookId,
          number: volume.number,
          title: volume.title ?? null,
        })),
      );
    }

    if (payload.pages.length > 0) {
      await localDb.insert(localPages).values(
        payload.pages.map((page) => ({
          id: page.id,
          bookId,
          volumeId: page.volumeId ?? null,
          shamelaPageNo: page.shamelaPageNo,
          shamelaUrl: page.shamelaUrl ?? null,
          printedPageNo: page.printedPageNo ?? null,
          chapterTitle: page.chapterTitle ?? null,
          topicTitle: page.topicTitle ?? null,
          status: page.status,
        })),
      );
    }

    const paragraphs = payload.pages.flatMap((page) =>
      (page.paragraphs ?? []).map((paragraph) => ({
        id: paragraph.id,
        pageId: page.id,
        pid: paragraph.pid,
        text: paragraph.text,
        footnoteIds: paragraph.footnoteIds ?? null,
      })),
    );
    if (paragraphs.length > 0) {
      await localDb.insert(localParagraphs).values(paragraphs);
    }

    const footnotes = payload.pages.flatMap((page) =>
      (page.footnotes ?? []).map((footnote) => ({
        id: footnote.id,
        pageId: page.id,
        marker: footnote.marker,
        type: footnote.type ?? null,
        content: footnote.content,
      })),
    );
    if (footnotes.length > 0) {
      await localDb.insert(localFootnotes).values(footnotes);
    }

    if (payload.highlights?.length) {
      await localDb
        .insert(localHighlights)
        .values(
          payload.highlights.map((highlight) => ({
            localId: `server-${highlight.id}`,
            serverId: highlight.id,
            bookId,
            pageId: highlight.pageId,
            paragraphId: highlight.paragraphId ?? null,
            startOffset: highlight.startOffset ?? 0,
            endOffset: highlight.endOffset ?? 0,
            color: highlight.color ?? "#FFD700",
            note: highlight.note ?? null,
            quoteText: highlight.quoteText ?? null,
            createdAt: toDate(highlight.createdAt, now),
            updatedAt: toDate(highlight.updatedAt, now),
            deletedAt: null,
            syncStatus: "synced",
          })),
        )
        .onConflictDoNothing();
    }

    if (payload.comments?.length) {
      await localDb
        .insert(localComments)
        .values(
          payload.comments.map((comment) => ({
            localId: `server-${comment.id}`,
            serverId: comment.id,
            bookId,
            pageId: comment.pageId,
            paragraphId: comment.paragraphId ?? null,
            content: comment.content,
            createdAt: toDate(comment.createdAt, now),
            updatedAt: toDate(comment.updatedAt, now),
            deletedAt: null,
            syncStatus: "synced",
          })),
        )
        .onConflictDoNothing();
    }
  });

  return {
    bookId,
    contentHash: payload.book.contentHash ?? null,
    downloadedAt: now.getTime(),
    lastSyncedAt: now.getTime(),
  };
}
