# Plan: Album-Aware Blog Lists And Cards

## Type
Feature

## Status
Done

## Completion Notes
- Search results include album membership and show album badges/add-to-album actions through existing blog cards.
- Home feed groups album-linked audio posts by album and keeps the most recent visible item.
- Audio screen shows album navigation instead of another plus action when the media already belongs to an album.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Blog posts should only show unique by album, already-added blogs should show only the most recent, search result blog cards should show add-album and album badge, and audio screen should show the album instead of another plus action once added.

## Goal Or Problem
Make blog lists and cards aware of album membership so users do not see confusing duplicate album-linked entries and can clearly tell whether a blog/audio item is already in an album.

## Current Context
Blog cards exist under `apps/expo-app/src/components/blog-card/`, search uses `search-screen.tsx`, and audio details use `audio-blog-screen.tsx`. Album add flow is implemented, but the user reports album state is not consistently represented in blog posts/search/audio screens.

## Proposed Approach
Expose album membership metadata where blog lists, search results, and audio detail screens need it. Deduplicate album-linked blog posts by album according to the most recent relevant blog/album entry. Render album badges and add-to-album actions consistently, and replace the plus action with existing album information when the current item is already in an album.

## Implementation Steps
- Audit blog list/search queries and card props to identify whether album membership is already available.
- Extend API query response or client enrichment to include album membership summary for audio blog media.
- Define the "unique by album" rule precisely in code: group album-linked blog/audio items by album and surface the most recent item for each group.
- Apply the grouping rule on the relevant blog posts page without affecting unrelated non-album posts.
- Update search result blog cards to show add-to-album action and album badge when applicable.
- Update audio screen actions so already-added items show album name/badge instead of another plus/add action.
- Invalidate or refresh membership state after adding to album.

## Affected Files Or Areas
- `apps/api/src/trpc/routers/blog.routes.ts`
- `apps/api/src/trpc/routers/album.routes.ts`
- `apps/api/src/queries/blog.ts`
- `apps/expo-app/src/screens/blog-home.tsx`
- `apps/expo-app/src/screens/search-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/components/blog-card/`
- `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`
- `brain/features/blog.md`
- `brain/features/audio.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- The targeted blog posts page displays at most one visible item per album grouping, using the most recent item for that album.
- Non-album blog posts remain visible and are not incorrectly grouped away.
- Search result blog cards show add-to-album action when eligible.
- Search result blog cards show an album badge when the item already belongs to an album.
- Audio screen shows existing album membership instead of a redundant plus/add action for already-added items.
- Adding/removing album membership refreshes badges and actions without requiring app restart.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck if configured.
- Manually create an album with multiple blog/audio entries and verify the blog posts page shows only the most recent for that album.
- Manually search for an audio blog that is not in an album and verify add-to-album is available.
- Manually search for an audio blog already in an album and verify album badge appears.
- Manually open audio detail for an album member and verify the plus action is replaced by album display.

## Brain Update Requirements
- Update `brain/features/blog.md` with album-aware list/card behavior.
- Update `brain/features/audio.md` with audio detail album membership display.
- Update `brain/api/contracts.md` if query response shapes change.

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
- The exact blog posts page intended by "blog posts page" may be home, search, channel chat, or another route.
- Items may belong to multiple albums; UI must choose whether to show one badge, multiple badges, or a summary.
- Grouping by album could hide content unexpectedly if applied too broadly.

## Open Questions
- TODO: Confirm which screen is the "blog posts page" for unique-by-album grouping.
- TODO: Confirm how to display items that belong to multiple albums.

## Linked Task
- Task Title: Album-Aware Blog Lists And Cards
- Task File: brain/tasks/roadmap.md
