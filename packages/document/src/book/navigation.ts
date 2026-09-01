export type AdjacentPageTarget = {
  shamelaPageNo?: number | null;
  shamelaUrl?: string | null;
  page?: {
    id: number;
    status: string;
    shamelaUrl?: string | null;
  } | null;
};

export type AdjacentPageAction =
  | { type: "reader"; pageId: number }
  | { type: "capture"; shamelaUrl: string }
  | { type: "boundary" };

export function resolveAdjacentPageAction(
  target: AdjacentPageTarget | null | undefined,
): AdjacentPageAction {
  if (target?.page?.status === "fetched") {
    return { type: "reader", pageId: target.page.id };
  }
  const shamelaUrl = target?.shamelaUrl ?? target?.page?.shamelaUrl;
  return shamelaUrl ? { type: "capture", shamelaUrl } : { type: "boundary" };
}

export function getSwipeBookDirection(
  deltaX: number,
  isRtl: boolean,
): "previous" | "next" | null {
  if (Math.abs(deltaX) < 60) return null;
  const swipedRight = deltaX > 0;
  if (isRtl) return swipedRight ? "next" : "previous";
  return swipedRight ? "previous" : "next";
}
