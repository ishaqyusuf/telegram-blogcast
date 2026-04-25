/**
 * use-book-offline.ts
 * Handles downloading a book to SQLite and checking for server-side updates.
 */
import { useCallback, useEffect, useState } from "react";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { localDb, withLocalDb } from "@/db/local-db";
import {
  localBooks,
  localVolumes,
  localPages,
  localParagraphs,
  localFootnotes,
} from "@/db/local-schema";
import { eq } from "drizzle-orm";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import NetInfo from "@react-native-community/netinfo";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBookOffline(bookId: number) {
  const store = useBookOfflineStore();
  const isDownloaded = store.isDownloaded(bookId);
  const localMeta = store.getBookMeta(bookId);
  const progress = store.downloadProgress[bookId] ?? 0;

  const [isDownloading, setIsDownloading] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Track connectivity
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsub;
  }, []);

  // Check if server has newer content when online
  useEffect(() => {
    if (!isDownloaded || !isOnline) return;

    let cancelled = false;
    const check = async () => {
      try {
        const meta = await vanillaTrpc.book.getBookMeta.query({ id: bookId });
        if (!cancelled && meta.contentHash && meta.contentHash !== localMeta?.contentHash) {
          setHasUpdate(true);
        }
      } catch {}
    };
    check();
    return () => { cancelled = true; };
  }, [bookId, isDownloaded, isOnline, localMeta?.contentHash]);

  // ─── Download ──────────────────────────────────────────────────────────────

  const download = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    store.setDownloadProgress(bookId, 0.05);

    try {
      const data = await vanillaTrpc.book.getBookForDownload.query({ bookId });
      store.setDownloadProgress(bookId, 0.2);

      await withLocalDb(async () => {
        // Upsert book record
        await localDb
          .insert(localBooks)
          .values({
            id: data.book.id,
            nameAr: data.book.nameAr,
            nameEn: data.book.nameEn,
            coverColor: data.book.coverColor,
            shamelaId: data.book.shamelaId,
            contentHash: data.book.contentHash,
            lastSyncedAt: new Date(),
            downloadedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: localBooks.id,
            set: {
              nameAr: data.book.nameAr,
              nameEn: data.book.nameEn,
              contentHash: data.book.contentHash,
              lastSyncedAt: new Date(),
            },
          });

        store.setDownloadProgress(bookId, 0.25);

        // Upsert volumes
        for (const vol of data.volumes) {
          await localDb
            .insert(localVolumes)
            .values({ id: vol.id, bookId, number: vol.number, title: vol.title })
            .onConflictDoUpdate({ target: localVolumes.id, set: { title: vol.title } });
        }

        store.setDownloadProgress(bookId, 0.3);

        // Upsert pages + paragraphs + footnotes
        const total = data.pages.length;
        for (let i = 0; i < total; i++) {
          const page = data.pages[i];
          await localDb
            .insert(localPages)
            .values({
              id: page.id,
              bookId,
              volumeId: page.volumeId,
              shamelaPageNo: page.shamelaPageNo,
              shamelaUrl: page.shamelaUrl,
              printedPageNo: page.printedPageNo,
              chapterTitle: page.chapterTitle,
              topicTitle: page.topicTitle,
              status: page.status,
            })
            .onConflictDoUpdate({
              target: localPages.id,
              set: {
                chapterTitle: page.chapterTitle,
                topicTitle: page.topicTitle,
                status: page.status,
                printedPageNo: page.printedPageNo,
              },
            });

          // Replace paragraphs for this page
          if (page.paragraphs.length > 0) {
            await localDb.delete(localParagraphs).where(eq(localParagraphs.pageId, page.id));
            await localDb.insert(localParagraphs).values(
              page.paragraphs.map((p) => ({
                id: p.id,
                pageId: page.id,
                pid: p.pid,
                text: p.text,
                footnoteIds: p.footnoteIds,
              }))
            );
          }

          // Replace footnotes
          if (page.footnotes.length > 0) {
            await localDb.delete(localFootnotes).where(eq(localFootnotes.pageId, page.id));
            await localDb.insert(localFootnotes).values(
              page.footnotes.map((f) => ({
                id: f.id,
                pageId: page.id,
                marker: f.marker,
                type: f.type,
                content: f.content,
              }))
            );
          }

          store.setDownloadProgress(bookId, 0.3 + 0.65 * ((i + 1) / total));
        }
      });

      // Persist download record
      store.setDownloaded({
        bookId,
        contentHash: data.book.contentHash,
        downloadedAt: Date.now(),
        lastSyncedAt: Date.now(),
      });

      setHasUpdate(false);
      store.setDownloadProgress(bookId, 1);
    } catch (e) {
      console.error("[useBookOffline] download error", e);
    } finally {
      setIsDownloading(false);
      setTimeout(() => store.clearDownloadProgress(bookId), 1500);
    }
  }, [bookId, isDownloading]);

  // ─── Remove offline copy ───────────────────────────────────────────────────

  const removeOffline = useCallback(async () => {
    await withLocalDb(async () => {
      await localDb.delete(localPages).where(eq(localPages.bookId, bookId));
      await localDb.delete(localVolumes).where(eq(localVolumes.bookId, bookId));
      await localDb.delete(localBooks).where(eq(localBooks.id, bookId));
    });
    store.removeDownloaded(bookId);
  }, [bookId]);

  return {
    isDownloaded,
    isDownloading,
    hasUpdate,
    isOnline,
    progress,
    download,
    removeOffline,
  };
}

// ─── Read local page (offline reader fallback) ────────────────────────────────

export async function readLocalPage(pageId: number) {
  return withLocalDb(async () => {
    const [page] = await localDb
      .select()
      .from(localPages)
      .where(eq(localPages.id, pageId));

    if (!page) return null;

    const paras = await localDb
      .select()
      .from(localParagraphs)
      .where(eq(localParagraphs.pageId, pageId));

    const fns = await localDb
      .select()
      .from(localFootnotes)
      .where(eq(localFootnotes.pageId, pageId));

    return { page, paragraphs: paras, footnotes: fns };
  });
}
