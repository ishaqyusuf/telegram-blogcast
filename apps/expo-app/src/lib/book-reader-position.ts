export function createReaderPosition() {
  return {
    targetY: null as number | null,
    contentHeight: null as number | null,
    viewportHeight: null as number | null,
    complete: false,
    ready: false,
    contentKey: "",
    lastOffset: 0,
    restoreOffset: null as number | null,
    pageRelativeOffset: null as number | null,
    userDragged: false,
  };
}

type ReaderPosition = ReturnType<typeof createReaderPosition>;

export function updateReaderPositionContent(position: ReaderPosition, contentKey: string, ready: boolean) {
  position.ready ||= ready;
  if (position.contentKey !== contentKey) {
    if (position.contentKey === "fallback" && contentKey === "window" && position.complete) {
      // Native page views are replaced here; preserve the passage, not its old absolute Y.
      if (position.targetY !== null) {
        position.pageRelativeOffset = position.lastOffset - position.targetY;
        position.restoreOffset = null;
      } else {
        position.restoreOffset = position.lastOffset;
      }
      position.complete = false;
      position.userDragged = false;
    }
    position.contentKey = contentKey;
    if (!position.complete) {
      position.targetY = null;
      position.contentHeight = null;
    }
  }
}

export function mountReaderPosition(position: ReaderPosition) {
  if (position.complete) position.restoreOffset = position.lastOffset;
  position.complete = false;
  position.userDragged = false;
  position.targetY = null;
  position.contentHeight = null;
  position.viewportHeight = null;
}

export function beginReaderDrag(position: ReaderPosition, offset: number) {
  position.complete = true;
  position.restoreOffset = null;
  position.pageRelativeOffset = null;
  position.lastOffset = offset;
  position.userDragged = true;
}

export function canPaginateReader(position: ReaderPosition) {
  return position.complete && position.userDragged;
}

export function takeReaderInitialOffset(position: ReturnType<typeof createReaderPosition>) {
  const { contentHeight, viewportHeight } = position;
  const restoring = position.restoreOffset !== null || position.pageRelativeOffset !== null;
  const targetY = position.pageRelativeOffset !== null
    ? position.targetY === null ? null : position.targetY + position.pageRelativeOffset
    : position.restoreOffset ?? position.targetY;
  if (position.complete || targetY === null || contentHeight === null ||
    viewportHeight === null || viewportHeight <= 0 || contentHeight <= 0 ||
    (!restoring && targetY >= contentHeight)) return null;
  position.complete = true;
  position.restoreOffset = null;
  position.pageRelativeOffset = null;
  position.lastOffset = Math.max(0, Math.min(targetY, contentHeight - viewportHeight));
  return position.lastOffset;
}
