import { getSwipeBookDirection } from "@acme/document/book";

export {
  getSwipeBookDirection,
  resolveAdjacentPageAction,
} from "@acme/document/book";

export function createReaderSwipeTracker() {
  let start: { routeKey: string; absoluteX: number; absoluteY: number; selecting: boolean } | null = null;
  return {
    begin(routeKey: string, absoluteX: number, absoluteY: number, selecting = false) {
      start = Number.isFinite(absoluteX) && Number.isFinite(absoluteY)
        ? { routeKey, absoluteX, absoluteY, selecting }
        : null;
    },
    blockForSelection() {
      // Keep the whole touch sequence reserved for selection, even if it later collapses.
      if (start) start.selecting = true;
    },
    finish(routeKey: string, absoluteX: number, absoluteY: number, success: boolean, isRtl: boolean) {
      const began = start;
      start = null;
      if (!success || !began || began.selecting || began.routeKey !== routeKey || !Number.isFinite(absoluteX) || !Number.isFinite(absoluteY)) {
        return null;
      }
      // Android resets pan translation on activation; use the full touch-down displacement.
      const dx = absoluteX - began.absoluteX;
      const dy = absoluteY - began.absoluteY;
      // failOffsetY only applies before activation; reject pans that later turn vertical.
      if (Math.abs(dx) <= 1.5 * Math.abs(dy)) return null;
      return getSwipeBookDirection(dx, isRtl);
    },
    cancel() {
      start = null;
    },
  };
}
export type {
  AdjacentPageAction,
  AdjacentPageTarget,
} from "@acme/document/book";
