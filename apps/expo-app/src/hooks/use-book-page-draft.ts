import { useCallback } from "react";
import type { RichDocument } from "@acme/document/core";

export function useBookPageDraft(
  _bookId: number,
  _pageId: number,
  _enabled = true,
) {
  const reload = useCallback(async () => {}, []);
  const saveDraft = useCallback(
    async (_input: {
      document: RichDocument;
      contentHtml?: string | null;
      plainText: string;
      baseVersion?: number | null;
    }) => {},
    [],
  );
  const clearDraft = useCallback(async () => {}, []);

  return {
    draft: null,
    parsedDocument: null,
    reload,
    saveDraft,
    clearDraft,
  };
}
