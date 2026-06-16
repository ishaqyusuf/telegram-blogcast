# Plan: Harden Album Add Flow And Same-Channel Discovery

## Type
Feature

## Status
Implemented

## Created Date
2026-06-15

## Last Updated
2026-06-15

## Completion Notes
- `album.addMediaToAlbum` now rejects missing media, non-audio media, mixed-channel candidates, and media from a different channel than an existing album.
- Empty albums infer `channelId` from the first valid audio media selection.
- Albums screen now has an in-app create flow.
- Channel chat bulk add guards empty/no-audio selections before opening the album modal.

## Intake
- Intake File: brain/intake/2026-06-15-blog-audio-organization-import.md
- Intake Item: Add audio blogs to albums, create albums, show album screen, and find/add same-channel media only.

## Goal Or Problem
Make album organization reliable from audio blog menus and channel chat by enforcing same-channel constraints, improving album creation entry points, and completing the find/add same-channel media workflow.

## Current Context
Album schema and router already exist. `album.getAlbums`, `album.getAlbum`, `album.createAlbum`, `album.getSuggestedMedia`, `album.addMediaToAlbum`, `album.updateAlbum`, and `album.reorderTracks` are implemented in `apps/api/src/trpc/routers/album.routes.ts`. Mobile album list/detail and add-to-album modal exist in `apps/expo-app/src/screens/albums-screen.tsx`, `apps/expo-app/src/screens/album-detail-screen.tsx`, and `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`. Suggested media already filters by inferred channel and matching tags, but `addMediaToAlbum` should enforce channel safety.

## Proposed Approach
Keep the existing album architecture and harden the API. Make `addMediaToAlbum` reject media from other channels when the album has a channel, infer a channel when the album is empty, and update mobile UI to expose create/add flows cleanly from album list, audio blog screen, and channel chat.

## Implementation Steps
- Update `album.addMediaToAlbum` to load the target album and all candidate media with blog channel ids inside one transaction.
- If album has `channelId`, reject any media whose `blog.channelId` differs.
- If album has no `channelId`, infer it from the first candidate media and reject mixed-channel candidates.
- Return structured result counts and rejected ids/reasons if useful to the UI.
- Add a visible create-album CTA on `apps/expo-app/src/screens/albums-screen.tsx`.
- Reuse or extract `AddToAlbumModal` so audio blog screen and channel chat share the same behavior.
- Ensure bulk add from channel chat only includes audio media and shows a clear message when selected posts have no audio.
- In album detail, label suggestions as same-channel and keep tag-match rationale visible.
- Invalidate album list/detail/suggestions after add/create/update.

## Affected Files Or Areas
- `apps/api/src/trpc/routers/album.routes.ts`
- `packages/db/src/schema/audio.schema.prisma`
- `packages/db/src/schema/media.schema.prisma`
- `apps/expo-app/src/screens/albums-screen.tsx`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/screens/channel-chat-screen.tsx`
- `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`
- `brain/features/audio.md`

## Acceptance Criteria
- A user can create an album from the albums screen.
- A user can add an audio blog to an existing or newly created album from the audio/blog menu.
- Bulk add from channel chat only adds audio media.
- Adding media from a different channel to an album with an existing channel is rejected by the API.
- Suggested album media only shows audio from the same channel as the album.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck if configured.
- Manually create an album, add audio from one channel, then verify another channel's audio cannot be added.
- Manually verify album suggestions and reorder still work.

## Brain Update Requirements
- Update `brain/features/audio.md` with album organization behavior.
- Update `brain/api/contracts.md` with same-channel album constraints.

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
- Existing albums without `channelId` may contain mixed-channel media; migration or permissive handling may be needed for legacy data.
- Some media may not have a blog or channel; API should reject or clearly skip them.

## Open Questions
- TODO: Decide whether legacy mixed-channel albums should be grandfathered or cleaned up.

## Linked Task
- Task Title: Harden Album Add Flow And Same-Channel Discovery
- Task File: brain/tasks/roadmap.md
