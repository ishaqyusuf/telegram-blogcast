import { useCallback, useEffect, useMemo, useState } from "react";
import { eq } from "drizzle-orm";
import { initLocalDb, localDb, withLocalDbRetry } from "@/db/local-db";
import { localPageDrafts, type LocalPageDraft } from "@/db/local-schema";
import type { RichDocument } from "@acme/document/core";

export function useBookPageDraft(
  bookId: number,
  pageId: number,
  enabled = true,
) {
  const [draft, setDraft] = useState<LocalPageDraft | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setDraft(null);
      return;
    }
    await initLocalDb();
    const rows = await withLocalDbRetry(() =>
      localDb.select().from(localPageDrafts).where(eq(localPageDrafts.pageId, pageId)),
    );
    setDraft(rows[0] ?? null);
  }, [enabled, pageId]);

  const saveDraft = useCallback(
    async (input: {
      document: RichDocument;
      contentHtml?: string | null;
      plainText: string;
      baseVersion?: number | null;
    }) => {
      if (!enabled) return;
      await initLocalDb();
      const now = new Date();
      const row = {
        pageId,
        bookId,
        contentJson: JSON.stringify(input.document),
        contentHtml: input.contentHtml ?? null,
        plainText: input.plainText,
        baseVersion: input.baseVersion ?? null,
        updatedAt: now,
        syncStatus: "pending_update",
      };
      await withLocalDbRetry(() =>
        localDb
          .insert(localPageDrafts)
          .values(row)
          .onConflictDoUpdate({
            target: localPageDrafts.pageId,
            set: row,
          }),
      );
      setDraft(row);
    },
    [bookId, enabled, pageId],
  );

  const clearDraft = useCallback(async () => {
    await initLocalDb();
    await withLocalDbRetry(() =>
      localDb.delete(localPageDrafts).where(eq(localPageDrafts.pageId, pageId)),
    );
    setDraft(null);
  }, [pageId]);

  useEffect(() => {
    reload().catch((error) => console.warn("[BookDraft] load failed", error));
  }, [reload]);

  const parsedDocument = useMemo(() => {
    if (!draft?.contentJson) return null;
    try {
      return JSON.parse(draft.contentJson) as RichDocument;
    } catch {
      return null;
    }
  }, [draft?.contentJson]);

  return {
    draft,
    parsedDocument,
    reload,
    saveDraft,
    clearDraft,
  };
}
