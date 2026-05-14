import { create } from "zustand";

type BrowserCaptureStatus = "idle" | "captured" | "cancelled";

export type BookFetchBrowserCapture = {
  requestedUrl: string;
  finalUrl: string;
  title: string;
  html: string;
  capturedAt: number;
};

type BookFetchBrowserState = {
  status: BrowserCaptureStatus;
  capture: BookFetchBrowserCapture | null;
  setCaptured: (capture: BookFetchBrowserCapture) => void;
  setCancelled: () => void;
  clear: () => void;
};

export const useBookFetchBrowserStore = create<BookFetchBrowserState>((set) => ({
  status: "idle",
  capture: null,
  setCaptured: (capture) =>
    set({
      status: "captured",
      capture,
    }),
  setCancelled: () =>
    set((state) => ({
      status: state.capture ? state.status : "cancelled",
    })),
  clear: () =>
    set({
      status: "idle",
      capture: null,
    }),
}));
