import { useCallback, useEffect, useState } from "react";
import { eq } from "drizzle-orm";
import { localDb, withLocalDb } from "@/db/local-db";
import { localPageDrafts, type LocalPageDraft } from "@/db/local-schema";
import type { RichDocument } from "@acme/document/core";

export function useBookPageDraft(bookId: number, pageId: number) {
  const [draft, setDraft] = useState<LocalPageDraft | null>(null);

  const reload = useCallback(async () => {
    const rows = await withLocalDb(() =>
      localDb.select().from(localPageDrafts).where(eq(localPageDrafts.pageId, pageId)),
    );
    setDraft(rows[0] ?? null);
  }, [pageId]);

  useEffect(() => {
    reload().catch((error) => console.warn("[BookDraft] load failed", error));
  }, [reload]);

  const saveDraft = useCallback(
    async (input: {
      document: RichDocument;
      contentHtml?: string | null;
      plainText: string;
      baseVersion?: number | null;
    }) => {
      const now = new Date();
      await withLocalDb(() =>
        localDb
          .insert(localPageDrafts)
          .values({
            pageId,
            bookId,
            contentJson: JSON.stringify(input.document),
            contentHtml: input.contentHtml ?? null,
            plainText: input.plainText,
            baseVersion: input.baseVersion ?? null,
            updatedAt: now,
            syncStatus: "pending_update",
          })
          .onConflictDoUpdate({
            target: localPageDrafts.pageId,
            set: {
              contentJson: JSON.stringify(input.document),
              contentHtml: input.contentHtml ?? null,
              plainText: input.plainText,
              baseVersion: input.baseVersion ?? null,
              updatedAt: now,
              syncStatus: "pending_update",
            },
          }),
      );
      await reload();
    },
    [bookId, pageId, reload],
  );

  const clearDraft = useCallback(async () => {
    await withLocalDb(() =>
      localDb.delete(localPageDrafts).where(eq(localPageDrafts.pageId, pageId)),
    );
    setDraft(null);
  }, [pageId]);

  let parsedDocument: RichDocument | null = null;
  if (draft?.contentJson) {
    try {
      parsedDocument = JSON.parse(draft.contentJson) as RichDocument;
    } catch (error) {
      console.warn("[BookDraft] invalid draft JSON", error);
    }
  }

  return {
    draft,
    parsedDocument,
    reload,
    saveDraft,
    clearDraft,
  };
}
