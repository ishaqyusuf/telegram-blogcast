import type { CachedBookDraft } from "./book-cache-repository";

export type BookDraftState = { key: string; draft: CachedBookDraft | null; ready: boolean; error?: string };

export function failedBookDraftState(current: BookDraftState, key: string, error: string): BookDraftState {
  return { key, draft: current.key === key ? current.draft : null, ready: false, error };
}
