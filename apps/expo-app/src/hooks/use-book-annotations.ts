import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceAnnotation } from "@acme/utils/book-annotation";
import { getBookAnnotationRepository, getBookCacheRepository } from "@/db/book-cache-db";
import { readBookAnnotations, syncBookAnnotations } from "@/lib/book-annotation-service";
import type { LocalDeviceAnnotation } from "@/lib/book-annotation-repository";
import { commitAnnotationMutation } from "@/lib/book-annotation-mutation";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { notifyBookCacheChanged, subscribeBookCacheChanges } from "@/lib/book-cache-events";
import { useAuthContext } from "./use-auth";

export function useBookAnnotations(bookId: number, pageId: number) {
  const { profile } = useAuthContext();
  const scope = bookCacheScopeForUser(profile?.user?.id);
  const key = `${scope}:${bookId}:${pageId}`;
  const current = useRef(key); current.current = key;
  const sequence = useRef(0);
  const [state, setState] = useState<{ key: string; rows: LocalDeviceAnnotation[] }>({ key, rows: [] });
  const load = useCallback(async () => {
    const request = ++sequence.current;
    const rows = await readBookAnnotations(scope, bookId);
    if (current.current === key && request === sequence.current) setState({ key, rows });
  }, [bookId, scope, key]);
  useEffect(() => {
    void load().catch((error) => console.warn("[Book annotations] local read failed", error));
    void syncBookAnnotations(bookId, scope);
    return subscribeBookCacheChanges((event) => {
      if (event.bookId === bookId && (event.kind === "annotations" || event.kind === "page")) void load().catch((error) => console.warn("[Book annotations] refresh failed", error));
    });
  }, [bookId, scope, load]);
  const afterCommit = useCallback(async () => {
    void syncBookAnnotations(bookId, scope);
    notifyBookCacheChanged({ kind: "annotations", bookId, pageId });
    await load();
  }, [bookId, scope, pageId, load]);
  const save = useCallback(async (payload: DeviceAnnotation["payload"]) => {
    if (current.current !== key) return;
    const repository = await getBookAnnotationRepository();
    const page = payload.kind === "highlight" ? await (await getBookCacheRepository()).readPage(scope, bookId, pageId) : null;
    if (current.current !== key) return;
    await commitAnnotationMutation(
      () => repository.save(scope, bookId, { localId: `${payload.kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`, pageId, deleted: false, payload }, payload.kind === "highlight", page?.paragraphs),
      afterCommit,
      () => console.warn("[Book annotations] saved locally; refresh pending"),
    );
  }, [scope, bookId, pageId, key, afterCommit]);
  const remove = useCallback(async (localId: string) => {
    if (current.current !== key) return;
    const repository = await getBookAnnotationRepository();
    await commitAnnotationMutation(
      () => repository.remove(scope, bookId, localId),
      afterCommit,
      () => console.warn("[Book annotations] removed locally; refresh pending"),
    );
  }, [scope, bookId, key, afterCommit]);
  return { rows: state.key === key ? state.rows : [], scope, save, remove, reload: load };
}
