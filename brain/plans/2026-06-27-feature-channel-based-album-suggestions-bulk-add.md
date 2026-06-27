# Plan: Channel-Based Album Suggestions And Bulk Add

## Type
Feature

## Status
Done

## Completion Notes
- Added keyword/channel album suggestion groups API and preserved same-channel add enforcement.
- Album detail Add tab supports keyword suggestions, mark all/clear, bulk add, one-off add, and simple toast feedback.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Album suggest screen should get all albums with suggest keyword, find more channel-based suggestions, show suggested album names, support blog menu, check/uncheck, mark all/unmark, and add to respective album.

## Goal Or Problem
Make album suggestion an active channel-aware workflow: the user can search/suggest by keyword, see matching albums and candidate blogs, select candidates in bulk, and add selected audio blogs to the appropriate album without crossing channels.

## Current Context
Albums are already channel-aware in `album.addMediaToAlbum` and `album.getSuggestedMedia`. Existing Brain docs say empty albums infer channel from the first added audio media and suggestions are same-channel audio candidates ranked by matching tags. The new request adds keyword-based album discovery, a richer suggestion screen, and bulk selection/actions.

## Proposed Approach
Extend the album suggestion API/UI around a keyword input. Return matching albums with their `channelId`/channel metadata and candidate same-channel audio blogs for that keyword. In the mobile album detail Add tab or suggestion screen, render each suggested album group with album name, blog menu, selection state, mark-all/unmark controls, and an action to add selected candidates to that album.

## Implementation Steps
- Audit `apps/api/src/trpc/routers/album.routes.ts` for current album list, album detail, and suggested media response shapes.
- Add or extend an album suggestion query that accepts a keyword and optional channel context and returns albums plus channel-aware candidate media/blog rows.
- Ensure Album responses expose a channel attribute where needed by clients.
- Keep same-channel enforcement in `album.addMediaToAlbum`; do not rely only on client filtering.
- Add the Add tab/suggest screen UI in album detail, showing grouped suggested album names and candidate blog rows.
- Add check/uncheck state per candidate and mark-all/unmark controls per group.
- Preserve a blog-item menu inside suggestion rows for existing blog actions.
- Add mutation invalidation so album detail, album list, suggestions, and blog card album state refresh after adding.

## Affected Files Or Areas
- `apps/api/src/trpc/routers/album.routes.ts`
- `packages/db/src/schema/audio.schema.prisma`
- `packages/db/src/schema/media.schema.prisma`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/albums-screen.tsx`
- `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`
- `apps/expo-app/src/components/blog-card/`
- `brain/features/audio.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Album suggestion search accepts a keyword and returns matching albums with channel metadata.
- Suggested candidate blogs are audio-only and channel-compatible with the target album.
- The suggestion UI shows the suggested album name for each result group.
- A user can check/uncheck individual candidates, mark all, unmark all, and add selected candidates to the respective album.
- The blog menu remains available from suggestion result rows.
- Cross-channel additions are rejected by the API even if the UI is bypassed.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck if configured.
- Manually search a keyword that matches albums in one channel and verify suggestions exclude other-channel audio.
- Manually mark all, unmark, select a subset, add to album, and verify album tracks update.
- Manually try to add a cross-channel media id through the API and verify rejection.

## Brain Update Requirements
- Update `brain/features/audio.md` with the final album suggestion workflow.
- Update `brain/api/contracts.md` with the keyword/channel suggestion response contract.

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
- Existing albums without channel metadata may need graceful handling until they infer a channel.
- Keyword matching should not become too broad and suggest unrelated albums across channels.
- Bulk add should handle candidates already in the target album without duplicate rows.

## Open Questions
- TODO: Confirm whether keyword matching should use album title only, tags, blog title/content, or all of these.

## Linked Task
- Task Title: Channel-Based Album Suggestions And Bulk Add
- Task File: brain/tasks/roadmap.md
