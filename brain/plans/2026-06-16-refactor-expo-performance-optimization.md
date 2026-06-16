# Plan: Expo Performance Optimization Pass

## Type
Refactor

## Status
Proposed

## Created Date
2026-06-16

## Last Updated
2026-06-16

## Intake
- Intake File: brain/intake/2026-06-16-app-redesign-cleanup-dark-mode.md
- Intake Item: optimize

## Goal Or Problem
Improve perceived and measured Expo app performance across startup, high-traffic lists, media screens, and book reading without changing domain behavior.

## Current Context
The Expo app uses Expo Router, NativeWind, Zustand, TanStack React Query, tRPC, `@legendapp/list`, Expo Image, and a global audio player. Core screens include home/discovery, audio detail, albums/playlists, books/reader, channel chat, and import flows. The user asked broadly to "optimize", so this plan focuses on a measurable low-risk performance pass after visual structure and cleanup are stable.

## Proposed Approach
Create a baseline, optimize obvious hot paths, and avoid speculative rewrites. Prioritize list virtualization, render memoization, stable callbacks, image/media loading behavior, query loading states, skeletons, and avoiding expensive work during initial navigation.

## Implementation Steps
- Establish a small performance checklist for `/home`, `/blog-view-2/[blogId]`, `/books`, `/books/[bookId]/reader/[pageId]`, `/channels/[channelId]`, `/albums`, and `/playlists`.
- Measure or manually record baseline startup, first meaningful screen render, home scroll smoothness, audio screen interaction responsiveness, and book page render behavior on the target device/emulator.
- Replace large non-virtualized mapped lists with existing list primitives where appropriate, preferably `@legendapp/list` if already used elsewhere in the app.
- Memoize heavy card rows, media rows, generated-cover calculations, and expensive derived data where rerenders are visible.
- Stabilize callbacks and query option creation in high-traffic screens when they cause avoidable rerenders.
- Use `expo-image` caching/resizing behavior consistently for media thumbnails and covers where applicable.
- Ensure loading states use lightweight skeletons instead of expensive placeholder trees.
- Review global audio bar rendering so route changes and audio progress updates do not cause unnecessary parent rerenders.
- Capture before/after observations and any deferred performance issues.

## Affected Files Or Areas
- `apps/expo-app/src/screens/blog-home.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/screens/books-screen.tsx`
- `apps/expo-app/src/screens/book-reader-screen.tsx`
- `apps/expo-app/src/screens/channel-chat-screen.tsx`
- `apps/expo-app/src/screens/albums-screen.tsx`
- `apps/expo-app/src/screens/playlists-screen.tsx`
- `apps/expo-app/src/components/blog-card/`
- `apps/expo-app/src/components/blog-home/`
- `apps/expo-app/src/components/book/`
- `apps/expo-app/src/components/global-audio-bar/`
- `apps/expo-app/src/store/audio-store.ts`
- `apps/expo-app/src/trpc/`
- `brain/progress.md` or `brain/tasks/done.md`

## Acceptance Criteria
- Baseline and after-pass observations are recorded for the main app flows.
- High-traffic lists use virtualization or documented bounded rendering.
- Obvious rerender hot spots in cards, track rows, book paragraphs, and global audio chrome are reduced without changing behavior.
- Image-heavy surfaces use appropriate thumbnail/caching behavior.
- Loading and empty states stay responsive and do not introduce new layout jank.
- App lint/typecheck pass after optimization.

## Test Plan
- Run `bun run --cwd apps/expo-app lint`.
- Run `bun run typecheck` from the repo root if the workspace typecheck is healthy.
- Manually test startup, `/home` scrolling, audio playback/detail interactions, album/playlist lists, channel chat list, books list, and book reader paging on Android or the primary target device.
- Compare baseline and after-pass observations for obvious regressions.

## Brain Update Requirements
- Update `brain/tasks/done.md` with completed optimizations.
- If a `brain/progress.md` file exists by implementation time, record baseline and after-pass performance observations there; otherwise include them in the completion report.

## Lower-Agent Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Required checks are listed: Yes
- Brain update requirements are listed: Yes
- Ready for handoff: Yes

## Completion Report Requirements
Lower agent must report:
- Changed files
- Checks run
- Brain docs updated
- Unresolved issues
- Any skipped acceptance criteria

## Risks / Edge Cases
- Performance changes can subtly break list pagination, scroll position, audio progress, or reader selection behavior.
- Optimize after the redesign where possible, because visual structure changes can invalidate render baselines.
- Do not introduce a new list or state library unless existing app tools cannot solve the measured issue.

## Open Questions
- Which performance metric matters most to the user remains unclear; use startup, scroll smoothness, audio responsiveness, and reader render time as the first baseline.

## Linked Task
- Task Title: Expo Performance Optimization Pass
- Task File: brain/tasks/roadmap.md
