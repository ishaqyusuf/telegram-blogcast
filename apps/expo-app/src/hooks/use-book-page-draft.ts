import { useCallback, useEffect, useRef, useState } from "react";
import type { RichDocument } from "@acme/document/core";
import { getBookCacheRepository } from "@/db/book-cache-db";
import type { CachedBookDraft } from "@/lib/book-cache-repository";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { failedBookDraftState, type BookDraftState } from "@/lib/book-draft-state";
import { useAuthContext } from "./use-auth";

export function useBookPageDraft(bookId: number, pageId: number, enabled = true) {
  const { profile } = useAuthContext();
  const scope = bookCacheScopeForUser(profile?.user?.id);
  const key = `${scope}:${bookId}:${pageId}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const [state, setState] = useState<BookDraftState>({ key, draft: null, ready: false });
  const draft = state.key === key ? state.draft : null;
  const timestamp = useRef(0);
  const revision = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const observedRevision = revision.current;
    try {
      const repository = await getBookCacheRepository();
      const next = await repository.readDraft(scope, bookId, pageId);
      if (activeKey.current === key && revision.current === observedRevision) {
        timestamp.current = Math.max(timestamp.current, next?.updatedAt ?? 0);
        setState({ key, draft: next, ready: true });
      }
    } catch (error) {
      if (activeKey.current === key && revision.current === observedRevision) setState((current) => failedBookDraftState(current, key, error instanceof Error ? error.message : "Could not load the saved draft."));
    }
  }, [bookId, enabled, key, pageId, scope]);

  const saveDraft = useCallback(async (input: { document: RichDocument; contentHtml?: string | null; plainText: string; baseVersion?: number | null }) => {
    if (!enabled || activeKey.current !== key) return;
    const observedRevision = ++revision.current;
    const repository = await getBookCacheRepository();
    timestamp.current = Math.max(Date.now(), timestamp.current + 1);
    const row: CachedBookDraft = { pageId, bookId, contentJson: JSON.stringify(input.document), contentHtml: input.contentHtml ?? null, plainText: input.plainText, baseVersion: input.baseVersion ?? null, updatedAt: timestamp.current };
    await repository.saveDraft(scope, row);
    if (activeKey.current === key && revision.current === observedRevision) setState({ key, draft: row, ready: true });
    return row.updatedAt;
  }, [bookId, enabled, key, pageId, scope]);

  const clearDraft = useCallback(async (expectedUpdatedAt?: number) => {
    const version = expectedUpdatedAt ?? draft?.updatedAt;
    if (version === undefined) return;
    ++revision.current;
    const repository = await getBookCacheRepository();
    await repository.clearDraft(scope, bookId, pageId, version);
    if (activeKey.current === key) setState((current) => current.key === key && current.draft?.updatedAt === version ? { key, draft: null, ready: true } : current);
  }, [bookId, draft?.updatedAt, key, pageId, scope]);

  useEffect(() => {
    void reload().catch((error) => console.warn("[BookDraft] load failed", error));
  }, [reload]);

  let parsedDocument: RichDocument | null = null;
  if (draft?.contentJson) {
    try { parsedDocument = JSON.parse(draft.contentJson) as RichDocument; } catch { /* Preserve malformed drafts for recovery rather than deleting them. */ }
  }
  return { draft, parsedDocument, reload, saveDraft, clearDraft, error: state.key === key ? state.error : undefined, isLoading: enabled && (state.key !== key || !state.ready) };
}
