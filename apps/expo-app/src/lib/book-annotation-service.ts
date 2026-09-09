import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import { eq } from "drizzle-orm";
import { getBookAnnotationRepository, getBookCacheRepository } from "@/db/book-cache-db";
import { initLocalDb, localDb, withLocalDbRetry } from "@/db/local-db";
import { localHighlights, localComments, type LocalHighlight, type LocalComment } from "@/db/local-schema";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { getBookCacheScope } from "./book-cache-session";
import { syncDeviceAnnotations, annotationWireValue } from "./book-annotation-sync";
import { withBookCacheDeadline } from "./book-cache-resource";
import { notifyBookCacheChanged } from "./book-cache-events";
import type { LocalDeviceAnnotation } from "./book-annotation-repository";

export const useBookAnnotationSyncState = create<{ working: boolean; error: string | null; scope: string; bookId: number | null }>(() => ({ working: false, error: null, scope: "guest", bookId: null }));
let running: { key: string; promise: Promise<void>; abort: AbortController } | undefined;
export function cancelBookAnnotationSync() { running?.abort.abort(); }

async function importLegacy(scope: string, bookId: number) {
  const repository = await getBookAnnotationRepository();
  if (scope !== "guest" || await repository.hasLegacyImport(bookId)) return repository;
  await initLocalDb();
  const highlights = await withLocalDbRetry(() => localDb.select().from(localHighlights).where(eq(localHighlights.bookId, bookId)));
  const comments = await withLocalDbRetry(() => localDb.select().from(localComments).where(eq(localComments.bookId, bookId)));
  await repository.importLegacy(bookId, [
    ...highlights.map((row) => ({ localId: `legacy-hl-${row.localId}`, pageId: row.pageId, revision: 1, deleted: Boolean(row.deletedAt), updatedAt: +row.updatedAt, payload: { kind: "highlight" as const, paragraphId: row.paragraphId, paragraphPid: null, quoteText: row.quoteText, startOffset: row.startOffset ?? 0, endOffset: row.endOffset ?? 0, color: row.color, note: row.note } })),
    ...comments.map((row) => ({ localId: `legacy-cm-${row.localId}`, pageId: row.pageId, revision: 1, deleted: Boolean(row.deletedAt), updatedAt: +row.updatedAt, payload: { kind: "comment" as const, paragraphId: row.paragraphId, paragraphPid: null, quoteText: null, content: row.content } })),
  ]);
  return repository;
}

export async function readBookAnnotations(scope: string, bookId: number, pageId?: number) {
  return (await importLegacy(scope, bookId)).list(scope, bookId, pageId);
}
export function readerHighlight(row: LocalDeviceAnnotation): LocalHighlight | null {
  if (row.payload.kind !== "highlight") return null;
  const { kind, paragraphPid, ...payload } = row.payload;
  return { ...payload, localId: row.localId, serverId: null, bookId: row.bookId, pageId: row.pageId, createdAt: new Date(row.updatedAt), updatedAt: new Date(row.updatedAt), deletedAt: row.deleted ? new Date(row.updatedAt) : null, syncStatus: row.dirty ? "pending_create" : "synced" };
}
export function readerComment(row: LocalDeviceAnnotation): LocalComment | null {
  if (row.payload.kind !== "comment") return null;
  return { localId: row.localId, serverId: null, bookId: row.bookId, pageId: row.pageId, paragraphId: row.payload.paragraphId, content: row.payload.content, createdAt: new Date(row.updatedAt), updatedAt: new Date(row.updatedAt), deletedAt: row.deleted ? new Date(row.updatedAt) : null, syncStatus: row.dirty ? "pending_create" : "synced" };
}
export async function annotationAnchor(scope: string, bookId: number, pageId: number, paragraphId?: number | null) {
  const page = await (await getBookCacheRepository()).readPage(scope, bookId, pageId);
  const paragraph = page?.paragraphs.find((row) => row.id === paragraphId);
  return { paragraphId: paragraphId ?? null, paragraphPid: paragraph?.pid ?? null, quoteText: paragraph?.text ?? null };
}

export function syncBookAnnotations(bookId: number, scope = getBookCacheScope()): Promise<void> {
  const key = `${scope}:${bookId}`;
  if (running) return running.key === key ? running.promise : Promise.resolve();
  const abort = new AbortController();
  const promise = (async () => {
    const network = await NetInfo.fetch();
    if (network.isConnected === false || network.isInternetReachable === false || AppState.currentState !== "active" || scope !== getBookCacheScope()) return;
    useBookAnnotationSyncState.setState({ working: true, error: null, scope, bookId });
    const app = AppState.addEventListener("change", (state) => { if (state !== "active") abort.abort(); });
    const net = NetInfo.addEventListener((state) => { if (state.isConnected === false || state.isInternetReachable === false) abort.abort(); });
    const request = <T>(work: (signal: AbortSignal) => Promise<T>) => {
      if (scope !== getBookCacheScope()) { abort.abort(); return Promise.reject(new Error("Annotation profile changed.")); }
      return withBookCacheDeadline(work, abort.signal);
    };
    try {
      const repository = await importLegacy(scope, bookId);
      await syncDeviceAnnotations(repository, {
        capabilities: () => request((signal) => vanillaTrpc.bookAnnotation.capabilities.query(undefined, { signal })),
        push: (items) => request((signal) => vanillaTrpc.bookAnnotation.sync.mutate({ bookId, scope, items }, { signal })).then((rows) => rows.map((row) => ({ ...annotationWireValue(row), bookId: row.bookId }))),
        list: (afterId) => request((signal) => vanillaTrpc.bookAnnotation.list.query({ bookId, scope, afterId }, { signal })).then((result) => ({ ...result, items: result.items.map((row) => ({ ...annotationWireValue(row), bookId: row.bookId })) })),
      }, scope, bookId, abort.signal);
      notifyBookCacheChanged({ kind: "annotations", bookId });
    } catch (error) {
      if (!abort.signal.aborted) useBookAnnotationSyncState.setState({ error: error instanceof Error ? error.message : "Private sync failed; changes remain on this device." });
    } finally { app.remove(); net(); }
  })().catch((error) => {
    if (!abort.signal.aborted) useBookAnnotationSyncState.setState({ scope, bookId, error: error instanceof Error ? error.message : "Private sync failed; changes remain on this device." });
  }).finally(() => { running = undefined; useBookAnnotationSyncState.setState({ working: false }); });
  running = { key, promise, abort };
  return promise;
}
