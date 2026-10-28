# Digital Books full-height scrolling — 2026-10-28

The reading card, shelf filter, bookmarks panel and Explore books heading were siblings above the FlatList. With a cached book on the Samsung, that static content consumed about half the display; vertical drags there could not scroll the grid.

They now form the FlatList's ListHeaderComponent. The toolbar stays fixed; the rest of the body shares one vertical scroll surface. Loading/empty content uses ListEmptyComponent, and row padding preserves the existing two-column grid gutter without doubling the header's own padding. The pre-existing toolbar search action is preserved and excluded from this task's commit.

`node scripts/android-scroll-check.mjs SERIAL books-viewport OUTPUT_DIR` reads native bounds and asserts that Explore books belongs to a vertical scroll container starting within the top fifth of the screen, then swipes the upper body and asserts that the heading moves. It fails on the original Samsung layout (`scrollTop: null`, heading y=1128 unchanged).

- Fixed Samsung: scroll surface y=264 on a 2340-pixel display; heading moved 1063 → 687.
- Fixed Android emulator: y=146 on a 1616-pixel display; heading moved 737 → 434.
- Emulator font scale 1.3 also passed (viewport y=146; heading moved 760 → 449). Font scale was restored to 1.0 and the emulator client restarted; the initial configuration-change run was discarded because it returned to Home before the route was ready.
- Scoped Expo ESLint passed. Optimized ARM64 Android build passed with the updated screen included.

These bounds/movement checks cover the reported half-screen scroll bug. They do not classify perceptual motion blur or prove every reader/transcript route is smooth.

User acceptance on the Samsung: “Both scroll cleanly now” for Digital Books and the main feed, 2026-10-28.
