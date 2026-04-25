import type { RichDocument } from "./types";

export type RichEditorMode = "read" | "edit";

export type RichDraftSnapshot = {
  pageId: number | string;
  document: RichDocument;
  plainText: string;
  baseVersion?: number | null;
  updatedAt: string;
  syncStatus: "synced" | "pending_create" | "pending_update";
};

export type RichEditorCommand =
  | { type: "toggle-bold" }
  | { type: "toggle-italic" }
  | { type: "toggle-underline" }
  | { type: "toggle-highlight"; color?: string }
  | { type: "set-heading"; level: 1 | 2 | 3 }
  | { type: "toggle-blockquote" }
  | { type: "toggle-bullets" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "save" };

export type RichEditorEvent =
  | { type: "ready" }
  | { type: "selection-changed"; hasSelection: boolean }
  | { type: "document-changed"; document: RichDocument; plainText: string }
  | { type: "history-state"; canUndo: boolean; canRedo: boolean }
  | { type: "save-requested" };
