import { expect, test } from "bun:test";
import {
  beginReaderDrag,
  canPaginateReader,
  createReaderPosition,
  mountReaderPosition,
  takeReaderInitialOffset,
  updateReaderPositionContent,
} from "./book-reader-position";

test("waits for target, content and viewport in either layout order", () => {
  for (const order of [
    ["targetY", "contentHeight", "viewportHeight"],
    ["viewportHeight", "contentHeight", "targetY"],
  ] as const) {
    const position = createReaderPosition();
    const values = { targetY: 900, contentHeight: 2400, viewportHeight: 600 };
    for (const field of order.slice(0, 2)) {
      position[field] = values[field];
      expect(takeReaderInitialOffset(position)).toBeNull();
    }
    position[order[2]] = values[order[2]];
    expect(takeReaderInitialOffset(position)).toBe(900);
  }
});

test("does not reposition after manual scrolling, pagination or relayout", () => {
  const position = { ...createReaderPosition(), targetY: 900, contentHeight: 2400, viewportHeight: 600 };
  expect(takeReaderInitialOffset(position)).toBe(900);
  position.targetY = 1800;
  position.contentHeight = 4000;
  expect(takeReaderInitialOffset(position)).toBeNull();
  const nextRoute = { ...createReaderPosition(), targetY: 1800, contentHeight: 4000, viewportHeight: 600 };
  expect(takeReaderInitialOffset(nextRoute)).toBe(1800);
});

test("clamps short final pages and supports the first page", () => {
  expect(takeReaderInitialOffset({ ...createReaderPosition(), targetY: 900, contentHeight: 1100, viewportHeight: 600 })).toBe(500);
  expect(takeReaderInitialOffset({ ...createReaderPosition(), targetY: 20, contentHeight: 300, viewportHeight: 600 })).toBe(0);
});

test("a manual drag cancels positioning even if measurements arrive later", () => {
  const position = createReaderPosition();
  beginReaderDrag(position, 100);
  Object.assign(position, { targetY: 900, contentHeight: 2400, viewportHeight: 600 });
  expect(takeReaderInitialOffset(position)).toBeNull();
});

test("failed-window fallback preserves manual scroll through same-route recovery", () => {
  const position = createReaderPosition();
  updateReaderPositionContent(position, "fallback", true);
  mountReaderPosition(position);
  Object.assign(position, { targetY: 20, contentHeight: 1400, viewportHeight: 600 });
  beginReaderDrag(position, 350);
  // The query clears isError before the window-copy effect runs.
  updateReaderPositionContent(position, "fallback", false);
  expect(position.ready).toBe(true);
  updateReaderPositionContent(position, "window", true);
  expect(takeReaderInitialOffset(position)).toBeNull();
  position.contentHeight = 2400;
  expect(takeReaderInitialOffset(position)).toBeNull();
  position.targetY = 900;
  expect(position.lastOffset).toBe(350);
  expect(takeReaderInitialOffset(position)).toBe(1230);
  expect(canPaginateReader(position)).toBe(false);
  expect(takeReaderInitialOffset(position)).toBeNull();
});

test("recovery also waits for content height when the target layout arrives first", () => {
  const position = { ...createReaderPosition(), contentKey: "fallback", complete: true,
    targetY: 20, contentHeight: 1400, viewportHeight: 600, lastOffset: 350 };
  updateReaderPositionContent(position, "window", true);
  position.targetY = 900;
  expect(takeReaderInitialOffset(position)).toBeNull();
  position.contentHeight = 2400;
  expect(takeReaderInitialOffset(position)).toBe(1230);
});

test("a new drag during recovery cancels the pending relative restore", () => {
  const position = { ...createReaderPosition(), contentKey: "fallback", complete: true,
    targetY: 20, lastOffset: 350 };
  updateReaderPositionContent(position, "window", true);
  beginReaderDrag(position, 500);
  Object.assign(position, { targetY: 900, contentHeight: 2400, viewportHeight: 600 });
  expect(takeReaderInitialOffset(position)).toBeNull();
  expect(position.lastOffset).toBe(500);
});

test("read-edit-read restores the last offset once after fresh layout", () => {
  const position = { ...createReaderPosition(), targetY: 900, contentHeight: 2400, viewportHeight: 600 };
  expect(takeReaderInitialOffset(position)).toBe(900);
  beginReaderDrag(position, 1150);
  mountReaderPosition(position);
  expect(canPaginateReader(position)).toBe(false);
  expect(takeReaderInitialOffset(position)).toBeNull();
  position.viewportHeight = 600;
  position.contentHeight = 2400;
  expect(takeReaderInitialOffset(position)).toBe(1150);
  expect(takeReaderInitialOffset(position)).toBeNull();
});

test("a new ScrollView still anchors the target if initial positioning was pending", () => {
  const position = createReaderPosition();
  position.targetY = 100;
  mountReaderPosition(position);
  expect(position.targetY).toBeNull();
  Object.assign(position, { targetY: 900, contentHeight: 2400, viewportHeight: 600 });
  expect(takeReaderInitialOffset(position)).toBe(900);
});

test("programmatic initial scrolling cannot paginate before a user drag", () => {
  const position = { ...createReaderPosition(), targetY: 20, contentHeight: 2400, viewportHeight: 600 };
  expect(takeReaderInitialOffset(position)).toBe(20);
  expect(canPaginateReader(position)).toBe(false);
  beginReaderDrag(position, 20);
  expect(canPaginateReader(position)).toBe(true);
});

test("restoring after edited content shrinks clamps to the new scroll range", () => {
  const position = createReaderPosition();
  beginReaderDrag(position, 1800);
  mountReaderPosition(position);
  position.contentHeight = 1100;
  position.viewportHeight = 600;
  expect(takeReaderInitialOffset(position)).toBe(500);
});
